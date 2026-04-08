/**
 * NASA FIRMS (Fire Information for Resource Management System) Client
 *
 * Detects active fires/thermal anomalies globally within 3 hours of satellite pass.
 * Uses VIIRS (Visible Infrared Imaging Radiometer Suite) satellite data.
 *
 * Requires a free API key from: https://firms.modaps.eosdis.nasa.gov/api/area/
 * Set FIRMS_MAP_KEY in environment variables.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FIRMSDetection {
  latitude: number;
  longitude: number;
  brightness: number;
  frp: number; // Fire Radiative Power in MW
  confidence: string; // 'h' (high), 'n' (nominal), 'l' (low)
  acq_date: string;
  acq_time: string;
  daynight: string; // 'D' or 'N'
  satellite: string;
  /** Region label from FIRMS fetch — injected after fetch */
  region?: string;
}

export interface FIRMSRegionSummary {
  region: string;
  totalDetections: number;
  highConfidence: number;
  nightDetections: number;
  avgFRP: number;
  topDetections: FIRMSDetection[];
}

// ─── CSV Parser ─────────────────────────────────────────────────────────────

function parseCSV(rawText: string): Record<string, string>[] {
  const lines = rawText.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const vals = line.split(',');
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h.trim()] = vals[i]?.trim() ?? '';
    });
    return obj;
  });
}

// ─── FIRMS Client ───────────────────────────────────────────────────────────

const FIRMS_BASE = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv';

/**
 * Global regions for fire detection — comprehensive coverage.
 * Regions may overlap slightly; dedup happens at the normalizer level via IDs.
 */
const REGIONS: Record<string, { west: number; south: number; east: number; north: number; label: string }> = {
  // Americas
  northAmerica:   { west: -170, south: 15, east: -50,  north: 72,  label: 'North America' },
  centralAmerica: { west: -120, south: 5,  east: -60,  north: 20,  label: 'Central America & Caribbean' },
  southAmerica:   { west: -82,  south: -56, east: -34, north: 15,  label: 'South America' },

  // Europe & Russia
  europe:         { west: -10,  south: 35, east: 40,   north: 72,  label: 'Europe' },
  russia:         { west: 40,   south: 45, east: 180,  north: 75,  label: 'Russia & Central Asia' },

  // Africa & Middle East
  northAfrica:    { west: -18,  south: 10, east: 52,   north: 37,  label: 'North Africa & Middle East' },
  subSahara:      { west: -18,  south: -35, east: 52,  north: 10,  label: 'Sub-Saharan Africa' },

  // Asia
  southAsia:      { west: 60,   south: 5,  east: 98,   north: 37,  label: 'South Asia' },
  eastAsia:       { west: 95,   south: 15, east: 145,  north: 55,  label: 'East Asia' },
  southeastAsia:  { west: 95,   south: -10, east: 145,  north: 20,  label: 'Southeast Asia' },

  // Oceania
  australia:      { west: 110,  south: -50, east: 180, north: -5,  label: 'Australia & Oceania' },
};

export class FIRMSClient {
  private apiKey: string | null;

  constructor() {
    this.apiKey = process.env.FIRMS_MAP_KEY ?? null;
  }

  get isConfigured(): boolean {
    return this.apiKey !== null && this.apiKey.length > 0;
  }

  /**
   * Fetch active fire detections for a bounding box.
   * Returns parsed fire detections or an empty array on failure.
   */
  async fetchFires(opts: {
    west: number;
    south: number;
    east: number;
    north: number;
    days?: number;
    source?: string;
    label?: string;
  }): Promise<FIRMSDetection[]> {
    if (!this.apiKey) return [];

    const { west, south, east, north, days = 1, source = 'VIIRS_SNPP_NRT', label } = opts;
    const url = `${FIRMS_BASE}/${this.apiKey}/${source}/${west},${south},${east},${north}/${days}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'TerraMind/3.0' },
      });
      clearTimeout(timer);

      if (!res.ok) {
        console.error(`[FIRMS] HTTP ${res.status} for ${label || 'region'}`);
        return [];
      }

      const text = await res.text();
      const rows = parseCSV(text);

      return rows.map(r => ({
        latitude: parseFloat(r.latitude) || 0,
        longitude: parseFloat(r.longitude) || 0,
        brightness: parseFloat(r.bright_ti4) || 0,
        frp: parseFloat(r.frp) || 0,
        confidence: r.confidence || 'l',
        acq_date: r.acq_date || '',
        acq_time: r.acq_time || '',
        daynight: r.daynight || 'D',
        satellite: r.satellite || 'VIIRS',
        region: label,
      }));
    } catch (err: any) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        console.error(`[FIRMS] Timeout for ${label || 'region'}`);
      } else {
        console.error(`[FIRMS] Error for ${label || 'region'}:`, err.message);
      }
      return [];
    }
  }

  /**
   * Fetch active fires across all monitored regions.
   * Returns an array of region summaries with aggregated detection data.
   */
  async fetchGlobalFires(): Promise<FIRMSRegionSummary[]> {
    if (!this.apiKey) return [];

    const entries = Object.entries(REGIONS);
    console.log(`[FIRMS] Fetching fires from ${entries.length} global regions...`);

    const results = await Promise.allSettled(
      entries.map(async ([_key, box]) => {
        const fires = await this.fetchFires({ ...box, days: 1, label: box.label });
        return { label: box.label, fires };
      }),
    );

    const summaries = results
      .filter((r): r is PromiseFulfilledResult<{ label: string; fires: FIRMSDetection[] }> =>
        r.status === 'fulfilled',
      )
      .map(r => {
        const { label, fires } = r.value;
        if (fires.length === 0) {
          return { region: label, totalDetections: 0, highConfidence: 0, nightDetections: 0, avgFRP: 0, topDetections: [] };
        }

        const highConf = fires.filter(f => f.confidence === 'h' || f.confidence === 'high');
        const nightFires = fires.filter(f => f.daynight === 'N');

        // Top 20 fires by fire radiative power
        const topDetections = [...fires]
          .filter(f => f.frp > 5)
          .sort((a, b) => b.frp - a.frp)
          .slice(0, 20);

        return {
          region: label,
          totalDetections: fires.length,
          highConfidence: highConf.length,
          nightDetections: nightFires.length,
          avgFRP: fires.reduce((sum, f) => sum + f.frp, 0) / fires.length,
          topDetections,
        };
      });

    const total = summaries.reduce((s, r) => s + r.totalDetections, 0);
    const topFires = summaries.reduce((s, r) => s + r.topDetections.length, 0);
    console.log(`[FIRMS] ${total} total detections, ${topFires} significant fires returned`);

    return summaries;
  }
}
