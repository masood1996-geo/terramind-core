// ─── Zero-dependency .env loader ────────────────────────────────────────────
import { readFileSync } from 'fs';
import { resolve } from 'path';
try {
  const envPath = resolve(__dirname, '../../.env');
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.substring(0, eqIdx).trim();
      const value = trimmed.substring(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  }
} catch { /* .env file not found — use existing env vars */ }

import express, { Request, Response, NextFunction } from 'express';
import swaggerUi from 'swagger-ui-express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { z } from 'zod';
import { USGSClient } from '../clients/usgs';
import { NASAClient } from '../clients/nasa';
import { NOAAClient } from '../clients/noaa';
import { FIRMSClient } from '../clients/firms';
import { GBAClient, BuildingExposure } from '../clients/gba';
import { OSMClient } from '../clients/osm';
import { normalizeAll, GlobalDisasterEvent } from '../pipeline/normalizer';
import { computeDelta, DeltaResult } from '../pipeline/delta';
import { openApiSpec } from './swagger';

// ─── Configuration ──────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? '4100', 10);
const HOST = process.env.HOST ?? '0.0.0.0';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS ?? 'http://localhost:4100').split(',');
const CACHE_TTL_MS = parseInt(process.env.CACHE_TTL ?? '60000', 10); // default: 60s
const REFRESH_INTERVAL_MS = parseInt(process.env.REFRESH_INTERVAL ?? '120000', 10); // default: 2min

// ─── Express App ────────────────────────────────────────────────────────────

const app: express.Express = express();

// Security headers via Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://unpkg.com"],
      styleSrcAttr: ["'unsafe-inline'"],  // dynamic element.style assignments
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://*.basemaps.cartocdn.com"],
      connectSrc: ["'self'"],
      frameAncestors: ["'self'", "https://huggingface.co", "https://*.hf.space"],
    },
  },
  // Allow embedding in HuggingFace Spaces iframe
  frameguard: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false,
}));

// Trust reverse proxy (required for HuggingFace Spaces, Heroku, etc.)
app.set('trust proxy', 1);

// Rate limiting — 60 requests per minute per IP
app.use('/api/', rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please try again later.' },
}));

// JSON parsing with body size limit
app.use(express.json({ limit: '100kb' }));

// CORS headers — restrict to allowed origins
app.use((_req: Request, res: Response, next: NextFunction) => {
  const origin = _req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!IS_PRODUCTION) {
    // Permissive in development for local tools
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Serve static frontend from /public
app.use(express.static(path.join(__dirname, '../../public')));

// ─── Clients ────────────────────────────────────────────────────────────────

const usgsClient = new USGSClient();
const nasaClient = new NASAClient();
const noaaClient = new NOAAClient();
const firmsClient = new FIRMSClient();
const gbaClient = new GBAClient();
const osmClient = new OSMClient();

// ─── SSE (Server-Sent Events) ───────────────────────────────────────────────

const sseClients = new Set<Response>();

function broadcast(event: { type: string; [key: string]: unknown }) {
  const msg = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(msg);
    } catch {
      sseClients.delete(client);
    }
  }
}

// ─── Server State ───────────────────────────────────────────────────────────

interface SourceHealth {
  name: string;
  status: 'ok' | 'error' | 'disabled';
  count: number;
  responseTimeMs: number;
  error?: string;
}

let previousEvents: GlobalDisasterEvent[] = [];
let previousTimestamp: string | null = null;
let lastDelta: DeltaResult | null = null;
let lastSweepTime: string | null = null;
let sweepInProgress = false;
let lastSweepDurationMs = 0;
let sourceHealthMap: SourceHealth[] = [];
const startTime = Date.now();

// ─── Response Cache ─────────────────────────────────────────────────────────

interface CacheEntry {
  data: unknown;
  expiry: number;
  key: string;
}

let responseCache: CacheEntry | null = null;

function getCacheKey(source?: string, severity?: string): string {
  return `${source ?? 'all'}:${severity ?? 'all'}`;
}

// ─── Query Validation ───────────────────────────────────────────────────────

const EventsQuerySchema = z.object({
  source: z.enum(['usgs', 'nasa-eonet', 'noaa-nws', 'nasa-firms']).optional(),
  severity: z.enum(['minor', 'moderate', 'major', 'critical', 'unknown']).optional(),
  timeRange: z.enum(['hour', 'day', 'week']).optional(),
  nocache: z.string().optional(),
});

// ─── Core: Fetch & Normalize Events ─────────────────────────────────────────

async function fetchAllEvents(
  sourceFilter?: string,
  timeRange: string = 'hour',
): Promise<{
  events: GlobalDisasterEvent[];
  health: SourceHealth[];
}> {
  const health: SourceHealth[] = [];

  // USGS
  let usgsData: any[] = [];
  if (sourceFilter !== 'nasa-eonet' && sourceFilter !== 'noaa-nws' && sourceFilter !== 'nasa-firms') {
    const t0 = Date.now();
    try {
      usgsData = await usgsClient.fetchRecentEarthquakes(timeRange as any);
      health.push({ name: 'USGS', status: 'ok', count: usgsData.length, responseTimeMs: Date.now() - t0 });
    } catch (err: any) {
      health.push({ name: 'USGS', status: 'error', count: 0, responseTimeMs: Date.now() - t0, error: err.message });
      console.error('[TerraMind] USGS fetch failed:', err.message);
    }
  }

  // NASA EONET
  let nasaData: any[] = [];
  if (sourceFilter !== 'usgs' && sourceFilter !== 'noaa-nws' && sourceFilter !== 'nasa-firms') {
    const t0 = Date.now();
    try {
      nasaData = await nasaClient.fetchDisasterEvents();
      health.push({ name: 'NASA EONET', status: 'ok', count: nasaData.length, responseTimeMs: Date.now() - t0 });
    } catch (err: any) {
      health.push({ name: 'NASA EONET', status: 'error', count: 0, responseTimeMs: Date.now() - t0, error: err.message });
      console.error('[TerraMind] NASA EONET fetch failed:', err.message);
    }
  }

  // NOAA NWS
  let noaaData: any[] = [];
  if (sourceFilter !== 'usgs' && sourceFilter !== 'nasa-eonet' && sourceFilter !== 'nasa-firms') {
    const t0 = Date.now();
    try {
      noaaData = await noaaClient.fetchActiveAlerts();
      health.push({ name: 'NOAA NWS', status: 'ok', count: noaaData.length, responseTimeMs: Date.now() - t0 });
    } catch (err: any) {
      health.push({ name: 'NOAA NWS', status: 'error', count: 0, responseTimeMs: Date.now() - t0, error: err.message });
      console.error('[TerraMind] NOAA NWS fetch failed:', err.message);
    }
  }

  // NASA FIRMS
  let firmsData: any[] = [];
  if (sourceFilter !== 'usgs' && sourceFilter !== 'nasa-eonet' && sourceFilter !== 'noaa-nws') {
    if (firmsClient.isConfigured) {
      const t0 = Date.now();
      try {
        const regions = await firmsClient.fetchGlobalFires();
        firmsData = regions.flatMap(r => r.topDetections);
        health.push({ name: 'NASA FIRMS', status: 'ok', count: firmsData.length, responseTimeMs: Date.now() - t0 });
      } catch (err: any) {
        health.push({ name: 'NASA FIRMS', status: 'error', count: 0, responseTimeMs: Date.now() - t0, error: err.message });
        console.error('[TerraMind] NASA FIRMS fetch failed:', err.message);
      }
    } else {
      health.push({ name: 'NASA FIRMS', status: 'disabled', count: 0, responseTimeMs: 0, error: 'No FIRMS_MAP_KEY set' });
    }
  }

  const events = normalizeAll(usgsData, nasaData, noaaData, firmsData);
  return { events, health };
}

// ─── Routes ─────────────────────────────────────────────────────────────────

/**
 * GET /api/events
 *
 * Returns merged, normalized disaster events from all sources.
 * Supports optional query filters: ?source=usgs|nasa-eonet|noaa-nws|nasa-firms&severity=...
 * Add ?nocache=1 to bypass the response cache.
 */
app.get('/api/events', async (req: Request, res: Response) => {
  try {
    // Validate query parameters
    const parsed = EventsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
      });
    }

    const { source: sourceFilter, severity: severityFilter, timeRange, nocache } = parsed.data;
    const cacheKey = getCacheKey(sourceFilter, severityFilter) + `:${timeRange ?? 'hour'}`;

    // Check cache (unless ?nocache=1)
    if (!nocache && responseCache && responseCache.key === cacheKey && Date.now() < responseCache.expiry) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(responseCache.data);
    }

    const sweepStart = Date.now();
    sweepInProgress = true;
    broadcast({ type: 'sweep_start', timestamp: new Date().toISOString() });

    const { events: allEvents, health } = await fetchAllEvents(sourceFilter, timeRange ?? 'hour');
    sourceHealthMap = health;

    // Compute delta
    const delta = computeDelta(allEvents, previousEvents, previousTimestamp);
    previousEvents = allEvents;
    previousTimestamp = new Date().toISOString();
    lastDelta = delta;

    // Apply severity filter
    let events = allEvents;
    if (severityFilter) {
      events = events.filter((e) => e.severity === severityFilter);
    }

    const sweepDuration = Date.now() - sweepStart;
    lastSweepDurationMs = sweepDuration;
    lastSweepTime = new Date().toISOString();
    sweepInProgress = false;

    const response = {
      success: true,
      count: events.length,
      timestamp: new Date().toISOString(),
      sources: {
        usgs: { status: health.find(h => h.name === 'USGS')?.status ?? 'disabled', count: health.find(h => h.name === 'USGS')?.count ?? 0 },
        nasa: { status: health.find(h => h.name === 'NASA EONET')?.status ?? 'disabled', count: health.find(h => h.name === 'NASA EONET')?.count ?? 0 },
        noaa: { status: health.find(h => h.name === 'NOAA NWS')?.status ?? 'disabled', count: health.find(h => h.name === 'NOAA NWS')?.count ?? 0 },
        firms: { status: health.find(h => h.name === 'NASA FIRMS')?.status ?? 'disabled', count: health.find(h => h.name === 'NASA FIRMS')?.count ?? 0 },
      },
      sweep: {
        durationMs: sweepDuration,
        lastSweepTime,
        nextSweepTime: new Date(Date.now() + REFRESH_INTERVAL_MS).toISOString(),
        refreshIntervalMs: REFRESH_INTERVAL_MS,
      },
      delta: delta ?? undefined,
      sourceHealth: health,
      events,
    };

    // Update cache
    responseCache = {
      data: response,
      expiry: Date.now() + CACHE_TTL_MS,
      key: cacheKey,
    };

    res.setHeader('X-Cache', 'MISS');
    res.json(response);

    // Broadcast update to all SSE clients
    broadcast({
      type: 'update',
      timestamp: response.timestamp,
      count: response.count,
      sweep: response.sweep,
      delta: response.delta,
      sourceHealth: response.sourceHealth,
    });

  } catch (error: any) {
    sweepInProgress = false;
    console.error('[TerraMind] Unhandled error:', error);
    res.status(500).json({
      success: false,
      error: IS_PRODUCTION ? 'Internal Server Error' : (error.message ?? 'Internal Server Error'),
    });
  }
});

/**
 * GET /api/stream
 * Server-Sent Events endpoint — pushes live data updates to connected clients.
 */
app.get('/api/stream', (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // Send initial state
  res.write(`data: ${JSON.stringify({
    type: 'connected',
    timestamp: new Date().toISOString(),
    lastSweepTime,
    sweepInProgress,
    nextSweepTime: lastSweepTime
      ? new Date(new Date(lastSweepTime).getTime() + REFRESH_INTERVAL_MS).toISOString()
      : null,
    refreshIntervalMs: REFRESH_INTERVAL_MS,
    sseClients: sseClients.size + 1,
  })}\n\n`);

  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

/**
 * GET /api/health
 * Health check endpoint — includes upstream connectivity status.
 */
app.get('/api/health', async (_req: Request, res: Response) => {
  const overall = sourceHealthMap.every(h => h.status === 'ok' || h.status === 'disabled') ? 'ok' : 'degraded';

  res.status(overall === 'ok' ? 200 : 503).json({
    status: overall,
    uptime: process.uptime(),
    version: '4.1.0',
    timestamp: new Date().toISOString(),
    cache: {
      active: responseCache !== null && Date.now() < (responseCache?.expiry ?? 0),
      ttl: CACHE_TTL_MS,
    },
    sweep: {
      lastSweepTime,
      lastSweepDurationMs,
      sweepInProgress,
      nextSweepTime: lastSweepTime
        ? new Date(new Date(lastSweepTime).getTime() + REFRESH_INTERVAL_MS).toISOString()
        : null,
      refreshIntervalMs: REFRESH_INTERVAL_MS,
    },
    sourceHealth: sourceHealthMap,
    sseClients: sseClients.size,
    firmsEnabled: firmsClient.isConfigured,
  });
});

/**
 * GET /api/delta
 * Returns the latest delta (what changed since last refresh).
 */
app.get('/api/delta', (_req: Request, res: Response) => {
  if (!lastDelta) {
    return res.status(404).json({ success: false, error: 'No delta computed yet — need at least 2 refreshes.' });
  }
  res.json({ success: true, delta: lastDelta });
});

// ─── Building Exposure (GlobalBuildingAtlas) ─────────────────────────────────

/**
 * GET /api/buildings
 *
 * Queries the GlobalBuildingAtlas WFS for building footprints around
 * a coordinate pair. Returns building exposure summary (count, heights,
 * density classification).
 *
 * Query params:
 *   lat    — Latitude (required)
 *   lon    — Longitude (required)
 *   radius — Search radius in km (default: 25, max: 50)
 */
const BuildingsQuerySchema = z.object({
  lat: z.string().transform(Number).pipe(z.number().min(-90).max(90)),
  lon: z.string().transform(Number).pipe(z.number().min(-180).max(180)),
  radius: z.string().transform(Number).pipe(z.number().min(1).max(50)).optional(),
});

// Building exposure cache (keyed by lat-lon-radius, 5min TTL)
const buildingCache = new Map<string, { data: BuildingExposure; expiry: number }>();
const BUILDING_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

app.get('/api/buildings', async (req: Request, res: Response) => {
  try {
    const parsed = BuildingsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters. Required: ?lat=NUMBER&lon=NUMBER[&radius=NUMBER]',
        details: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
      });
    }

    const { lat, lon, radius } = parsed.data;
    const radiusKm = radius ?? 25;
    const cacheKey = `${lat.toFixed(3)}:${lon.toFixed(3)}:${radiusKm}`;

    // Check cache
    const cached = buildingCache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) {
      res.setHeader('X-Cache', 'HIT');
      return res.json({
        success: true,
        source: 'GlobalBuildingAtlas',
        query: { lat, lon, radiusKm },
        exposure: cached.data,
      });
    }

    // Try GBA first
    let exposure;
    let fallbackSource = 'GlobalBuildingAtlas';
    try {
      exposure = await gbaClient.getBuildingExposure(lat, lon, radiusKm);
      // GBAClient catches errors internally and returns available = false
      if (!exposure.available) {
        throw new Error(exposure.error || 'GBA returned available=false');
      }
    } catch (gbaError: any) {
      console.warn(`[TerraMind] GBA failed (${gbaError.message}), falling back to OpenStreetMap...`);
      fallbackSource = 'OpenStreetMap';
      exposure = await osmClient.getBuildingExposureFallback(lat, lon, radiusKm);
    }

    // Cache result
    buildingCache.set(cacheKey, { data: exposure, expiry: Date.now() + BUILDING_CACHE_TTL });

    // Periodic cache cleanup (keep under 500 entries)
    if (buildingCache.size > 500) {
      const now = Date.now();
      for (const [key, val] of buildingCache) {
        if (now > val.expiry) buildingCache.delete(key);
      }
    }

    res.setHeader('X-Cache', 'MISS');
    res.json({
      success: true,
      source: fallbackSource,
      query: { lat, lon, radiusKm },
      exposure,
    });
  } catch (error: any) {
    console.error('[TerraMind] Buildings query failed entirely:', error.message);
    res.status(500).json({
      success: false,
      error: IS_PRODUCTION ? 'Building data unavailable from all sources' : error.message,
    });
  }
});

// ─── GeoScience AI Assistant ──────────────────────────────────────────────────

app.post('/api/ai/chat', async (req: Request, res: Response) => {
  const { message, eventContext } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ success: false, error: 'Missing "message" field' });
  }

  const apiKey = process.env.KILOCODE_API_KEY;

  const systemPrompt = `You are TerraMind GeoScience Assistant — an expert in remote sensing, satellite imagery, geospatial data analysis, and urban exposure assessment. You help developers and geoscientists understand how to use satellite data and building infrastructure data to analyze disaster events.

Your expertise includes:
- Landsat 8/9 bands and indices (NDVI, NBR, NDWI, NDSI, etc.)
- Sentinel-2 MSI bands and spectral indices
- MODIS and VIIRS thermal data
- SAR/InSAR for surface deformation (Sentinel-1)
- Google Earth Engine, USGS EarthExplorer, Copernicus Open Access Hub
- Change detection methodologies (pre/post event analysis)
- Building exposure analysis using GlobalBuildingAtlas (GBA) data
- Urban density classification and infrastructure impact assessment

TerraMind integrates the GlobalBuildingAtlas (GBA) dataset which provides global building footprints, heights, and LoD1 3D models. When users ask about building impact, exposure, or infrastructure, reference the GBA data available through the /api/buildings endpoint.

When answering:
1. Be specific about which satellite, which bands, which indices
2. Provide direct links to data portals when possible
3. Suggest exact processing steps
4. When relevant, mention building exposure data from GBA to contextualize disaster impact
5. Keep answers concise but actionable

${eventContext ? `Current event context:\n${eventContext}` : ''}`;

  // Try Kilo Gateway API first
  if (apiKey) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30_000);
      const response = await fetch('https://api.kilo.ai/api/gateway/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'kilo-auto/free',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message },
          ],
          max_tokens: 2048,
          temperature: 0.3,
        }),
      });
      clearTimeout(timer);
      if (response.ok) {
        const data = await response.json() as any;
        const choice = data?.choices?.[0]?.message;
        // Some models return content=null with reasoning field
        const answer = choice?.content || choice?.reasoning || 'No response.';
        return res.json({ success: true, answer, model: data?.model || 'kilo-auto/free' });
      }
      console.warn('[AI] Kilo Gateway returned', response.status, '— using built-in engine');
    } catch (err: any) {
      console.warn('[AI] Kilo Gateway unavailable:', err.message, '— using built-in engine');
    }
  }

  // Fallback: Built-in GeoScience knowledge engine
  const answer = generateGeoResponse(message, eventContext || '');
  res.json({ success: true, answer, model: 'terramind-geoscience-local' });
});

function generateGeoResponse(question: string, context: string): string {
  const q = question.toLowerCase();
  const ctx = context.toLowerCase();
  const isFire = ctx.includes('fire') || ctx.includes('wildfire');
  const isQuake = ctx.includes('earthquake') || ctx.includes('seismic');
  const isFlood = ctx.includes('flood') || ctx.includes('tsunami');

  if (q.includes('burn') || q.includes('nbr') || q.includes('swir') || (q.includes('fire') && !q.includes('flood'))) {
    return `**Burn Scar / Fire Analysis:**\n\n**Sentinel-2:** NBR = (B8A − B12) / (B8A + B12)\n**Landsat 8/9:** NBR = (B5 − B7) / (B5 + B7)\n\n**dNBR = NBR_pre − NBR_post**\n- Low severity: 0.1–0.27\n- Moderate: 0.27–0.66  \n- High: > 0.66\n\n**SWIR False Color:** B12-B8A-B4 (Sentinel-2) or B7-B5-B4 (Landsat)\nActive fire appears bright red/orange.\n\nUse Level-2A surface reflectance. Sentinel-2 revisit: 5 days.`;
  }
  if (q.includes('earthquake') || q.includes('insar') || q.includes('deformation') || isQuake) {
    return `**Earthquake / Deformation Analysis:**\n\n**InSAR with Sentinel-1:**\n1. Download pre/post SLC pairs from ASF DAAC (https://search.asf.alaska.edu)\n2. Co-register image pair\n3. Generate interferogram (phase difference)\n4. Apply Goldstein filter → Phase unwrap (SNAPHU)\n5. Geocode → Convert to displacement\n\n**Coherence maps:** Building collapse = coherence loss\n**Software:** ESA SNAP, ISCE2, GMTSAR\n\nSentinel-1 C-band SAR, 6-12 day revisit, free data.`;
  }
  if (q.includes('flood') || q.includes('water') || q.includes('ndwi') || isFlood) {
    return `**Flood Mapping:**\n\n**Optical:** NDWI = (B3 − B8) / (B3 + B8) | MNDWI = (B3 − B11) / (B3 + B11)\nWater: NDWI > 0\n\n**SAR (works through clouds!):**\nSentinel-1 GRD VV polarization\nFlood = σ° < -15 to -18 dB (specular reflection)\n\n**Steps:**\n1. Get pre-flood + during-flood Sentinel-1 GRD\n2. Calibrate to sigma nought\n3. Speckle filter (Refined Lee)\n4. Threshold change map\n5. Mask permanent water (JRC Global Surface Water)`;
  }
  if (q.includes('volcan') || q.includes('lava') || q.includes('so2')) {
    return `**Volcanic Monitoring:**\n\n**Thermal:** Landsat B10 (TIR, 10.9μm, 100m) for lava flows\n**Gas:** Sentinel-5P TROPOMI for SO₂ column density\n**Deformation:** Sentinel-1 InSAR for magma inflation/deflation\n**SWIR hotspot:** Sentinel-2 B11/B12 detect sub-pixel thermal anomalies\n\n**Ash RGB:** EUMETSAT TIR channels for volcanic cloud tracking\n\n**Resources:**\n- MIROVA: https://www.mirovaweb.it\n- Smithsonian GVP: https://volcano.si.edu`;
  }
  if (q.includes('sentinel') || q.includes('landsat') || q.includes('band')) {
    return `**Satellite Band Reference:**\n\n**Sentinel-2:** B2(Blue), B3(Green), B4(Red) @10m | B8(NIR) @10m | B11(SWIR1), B12(SWIR2) @20m\n**Landsat 8/9:** B2-B4 @30m | B5(NIR) @30m | B6(SWIR1), B7(SWIR2) @30m | B10(TIR) @100m\n**Sentinel-1:** C-band SAR, VV/VH, 5×20m\n\n**Free Portals:**\n- Copernicus: https://browser.dataspace.copernicus.eu\n- EarthExplorer: https://earthexplorer.usgs.gov\n- NASA Worldview: https://worldview.earthdata.nasa.gov\n- GEE: https://code.earthengine.google.com`;
  }
  return `I can help with satellite data analysis. Try asking:\n\n• "Which bands for burn scar mapping?"\n• "How to detect flood extent with SAR?"\n• "InSAR for earthquake deformation"\n• "Sentinel-2 vs Landsat bands"\n\nThe Satellite Data Access links above will take you directly to data portals with pre-filled coordinates for this event.`;
}

/**
 * GET /api/docs
 * Serves Swagger UI for API documentation.
 */
app.use(
  '/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(openApiSpec, {
    customCss: `
      .swagger-ui .topbar { display: none; }
      .swagger-ui .info .title { font-size: 2rem; }
    `,
    customSiteTitle: 'TerraMind Core — API Docs',
  }),
);

// ─── Fallback: serve dashboard for non-API routes ────────────────────────────

app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../../public/index.html'));
});

// ─── Start Server ───────────────────────────────────────────────────────────

const server = app.listen(PORT, HOST, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════════════╗');
  console.log('  ║                                                      ║');
  console.log('  ║   🌍  TerraMind Core v4.1.0                         ║');
  console.log('  ║   Global Disaster Intelligence Platform              ║');
  console.log('  ║                                                      ║');
  console.log(`  ║   → Dashboard:  http://localhost:${PORT}                ║`);
  console.log(`  ║   → API:        http://localhost:${PORT}/api/events     ║`);
  console.log(`  ║   → Buildings:  http://localhost:${PORT}/api/buildings  ║`);
  console.log(`  ║   → SSE:        http://localhost:${PORT}/api/stream     ║`);
  console.log(`  ║   → Docs:       http://localhost:${PORT}/api/docs       ║`);
  console.log(`  ║   → Health:     http://localhost:${PORT}/api/health     ║`);
  console.log('  ║                                                      ║');
  console.log(`  ║   Cache: ${CACHE_TTL_MS / 1000}s | Rate: 60/min | FIRMS: ${firmsClient.isConfigured ? '✅' : '❌'}   ║`);
  console.log('  ║   GBA: ✅ GlobalBuildingAtlas WFS                    ║');
  console.log('  ║                                                      ║');
  console.log('  ╚══════════════════════════════════════════════════════╝');
  console.log('');
});

// ─── Graceful Shutdown ──────────────────────────────────────────────────────

function shutdown(signal: string) {
  console.log(`\n[TerraMind] Received ${signal}. Shutting down gracefully...`);
  // Close all SSE connections
  for (const client of sseClients) {
    try { client.end(); } catch { /* ignore */ }
  }
  sseClients.clear();
  server.close(() => {
    console.log('[TerraMind] Server closed.');
    process.exit(0);
  });
  // Force exit after 10s if connections don't close
  setTimeout(() => process.exit(1), 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export { app };
