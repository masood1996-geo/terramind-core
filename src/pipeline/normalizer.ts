import { z } from 'zod';
import type { USGSFeature } from '../clients/usgs';
import type { EONETEvent } from '../clients/nasa';
import type { NOAAAlert } from '../clients/noaa';
import type { FIRMSDetection } from '../clients/firms';

// ─── Global Disaster Event Schema ───────────────────────────────────────────

export const GlobalDisasterEventSchema = z.object({
  /** Unique identifier: source-prefixed original ID */
  id: z.string(),

  /** Data source identifier */
  source: z.enum(['usgs', 'nasa-eonet', 'noaa-nws', 'nasa-firms']),

  /** Human-readable event title */
  title: z.string(),

  /** Severity level derived from source-specific metrics */
  severity: z.enum(['minor', 'moderate', 'major', 'critical', 'unknown']),

  /** Geographic coordinates [longitude, latitude] */
  coordinates: z.object({
    longitude: z.number(),
    latitude: z.number(),
  }),

  /** ISO 8601 timestamp of the event */
  timestamp: z.string().datetime(),

  /** Original event category / type */
  eventType: z.string(),

  /** Optional additional metadata */
  metadata: z.record(z.unknown()).optional(),
});

export type GlobalDisasterEvent = z.infer<typeof GlobalDisasterEventSchema>;

// ─── Severity Classifiers ───────────────────────────────────────────────────

/**
 * Classifies earthquake severity based on the Richter magnitude scale.
 *
 *   < 3.0  → minor
 *   3.0–4.9 → moderate
 *   5.0–6.9 → major
 *   ≥ 7.0   → critical
 */
function classifyEarthquakeSeverity(
  magnitude: number | null,
): GlobalDisasterEvent['severity'] {
  if (magnitude === null || magnitude === undefined) return 'unknown';
  if (magnitude < 3.0) return 'minor';
  if (magnitude < 5.0) return 'moderate';
  if (magnitude < 7.0) return 'major';
  return 'critical';
}

/**
 * Classifies NASA EONET event severity.
 * Uses magnitude data when available, otherwise defaults based on category.
 */
function classifyEONETSeverity(event: EONETEvent): GlobalDisasterEvent['severity'] {
  // If magnitude data exists in the geometry, use it
  const latestGeometry = event.geometry[event.geometry.length - 1];
  if (latestGeometry?.magnitudeValue !== null && latestGeometry?.magnitudeValue !== undefined) {
    const mag = latestGeometry.magnitudeValue;
    // For wind speed (kts): < 34 minor, 34-63 moderate, 64-95 major, >= 96 critical
    if (latestGeometry.magnitudeUnit === 'kts') {
      if (mag < 34) return 'minor';
      if (mag < 64) return 'moderate';
      if (mag < 96) return 'major';
      return 'critical';
    }
    // Generic magnitude classification
    if (mag < 25) return 'minor';
    if (mag < 50) return 'moderate';
    if (mag < 75) return 'major';
    return 'critical';
  }

  // Default: wildfires are at least moderate, storms are at least moderate
  const categoryId = event.categories[0]?.id;
  if (categoryId === 'wildfires') return 'moderate';
  if (categoryId === 'severeStorms') return 'moderate';
  return 'unknown';
}

// ─── NOAA Severity Classifier ───────────────────────────────────────────────

/**
 * Maps NOAA/NWS severity levels to our internal severity scale.
 */
function classifyNOAASeverity(
  nwsSeverity: string,
): GlobalDisasterEvent['severity'] {
  switch (nwsSeverity) {
    case 'Extreme': return 'critical';
    case 'Severe': return 'major';
    case 'Moderate': return 'moderate';
    case 'Minor': return 'minor';
    default: return 'unknown';
  }
}

// ─── Normalizer Functions ───────────────────────────────────────────────────

/**
 * Normalizes a single USGS earthquake feature into a GlobalDisasterEvent.
 */
export function normalizeUSGSFeature(feature: USGSFeature): GlobalDisasterEvent {
  const [longitude, latitude] = feature.geometry.coordinates;

  const event: GlobalDisasterEvent = {
    id: `usgs-${feature.id}`,
    source: 'usgs',
    title: feature.properties.title ?? feature.properties.place ?? 'Unknown Earthquake',
    severity: classifyEarthquakeSeverity(feature.properties.mag),
    coordinates: { longitude, latitude },
    timestamp: new Date(feature.properties.time).toISOString(),
    eventType: feature.properties.type ?? 'earthquake',
    metadata: {
      magnitude: feature.properties.mag,
      magType: feature.properties.magType,
      depth: feature.geometry.coordinates[2],
      tsunami: feature.properties.tsunami,
      sig: feature.properties.sig,
      alert: feature.properties.alert,
      felt: feature.properties.felt,
      url: feature.properties.url,
    },
  };

  // Validate against schema
  return GlobalDisasterEventSchema.parse(event);
}

/**
 * Normalizes a single NASA EONET event into a GlobalDisasterEvent.
 */
export function normalizeEONETEvent(event: EONETEvent): GlobalDisasterEvent {
  const latestGeometry = event.geometry[event.geometry.length - 1];

  // Extract coordinates — handle both Point and Polygon types
  let longitude = 0;
  let latitude = 0;
  if (latestGeometry) {
    if (latestGeometry.type === 'Point') {
      const coords = latestGeometry.coordinates as number[];
      longitude = coords[0] ?? 0;
      latitude = coords[1] ?? 0;
    } else if (latestGeometry.type === 'Polygon') {
      // Compute centroid of the polygon ring
      const ring = latestGeometry.coordinates as number[][];
      if (ring && ring.length > 0) {
        const sumLng = ring.reduce((sum, pt) => sum + (pt[0] ?? 0), 0);
        const sumLat = ring.reduce((sum, pt) => sum + (pt[1] ?? 0), 0);
        longitude = sumLng / ring.length;
        latitude = sumLat / ring.length;
      }
    }
  }

  const timestamp = latestGeometry?.date
    ? new Date(latestGeometry.date).toISOString()
    : new Date().toISOString();

  const categoryTitle = event.categories[0]?.title ?? 'Unknown';
  const categoryId = event.categories[0]?.id ?? 'unknown';

  const normalized: GlobalDisasterEvent = {
    id: `eonet-${event.id}`,
    source: 'nasa-eonet',
    title: event.title,
    severity: classifyEONETSeverity(event),
    coordinates: { longitude, latitude },
    timestamp,
    eventType: categoryId,
    metadata: {
      categoryTitle,
      closed: event.closed,
      sources: event.sources.map((s) => ({ id: s.id, url: s.url })),
      link: event.link,
      magnitudeValue: latestGeometry?.magnitudeValue,
      magnitudeUnit: latestGeometry?.magnitudeUnit,
    },
  };

  return GlobalDisasterEventSchema.parse(normalized);
}

/**
 * Normalizes a single NOAA/NWS alert into a GlobalDisasterEvent.
 */
export function normalizeNOAAAlert(alert: NOAAAlert): GlobalDisasterEvent {
  const props = alert.properties;

  // Extract coordinates from geometry, or default to US center
  let longitude = -98.5;
  let latitude = 39.8;
  if (alert.geometry && alert.geometry.coordinates) {
    if (alert.geometry.type === 'Polygon') {
      // Compute centroid of the polygon
      const ring = (alert.geometry.coordinates as number[][][])[0];
      if (ring && ring.length > 0) {
        const sumLng = ring.reduce((sum, pt) => sum + (pt[0] ?? 0), 0);
        const sumLat = ring.reduce((sum, pt) => sum + (pt[1] ?? 0), 0);
        longitude = sumLng / ring.length;
        latitude = sumLat / ring.length;
      }
    } else if (alert.geometry.type === 'Point') {
      const coords = alert.geometry.coordinates as number[];
      longitude = coords[0] ?? -98.5;
      latitude = coords[1] ?? 39.8;
    }
  }

  const normalized: GlobalDisasterEvent = {
    id: `noaa-${props.id.split('/').pop() ?? props.id}`,
    source: 'noaa-nws',
    title: props.headline ?? props.event,
    severity: classifyNOAASeverity(props.severity),
    coordinates: { longitude, latitude },
    timestamp: new Date(props.sent).toISOString(),
    eventType: props.event,
    metadata: {
      area: props.areaDesc,
      certainty: props.certainty,
      urgency: props.urgency,
      senderName: props.senderName,
      expires: props.expires,
      description: props.description?.substring(0, 500),
      instruction: props.instruction?.substring(0, 500),
    },
  };

  return GlobalDisasterEventSchema.parse(normalized);
}

// ─── FIRMS Severity Classifier ──────────────────────────────────────────────

/**
 * Classifies fire severity based on Fire Radiative Power (FRP in MW).
 *
 *   < 10  → minor
 *   10–50 → moderate
 *   50–100 → major
 *   ≥ 100  → critical
 */
function classifyFIRMSSeverity(frp: number): GlobalDisasterEvent['severity'] {
  if (frp >= 100) return 'critical';
  if (frp >= 50) return 'major';
  if (frp >= 10) return 'moderate';
  return 'minor';
}

/**
 * Normalizes a single FIRMS fire detection into a GlobalDisasterEvent.
 */
export function normalizeFIRMSDetection(fire: FIRMSDetection, index: number): GlobalDisasterEvent {
  const timestamp = fire.acq_date && fire.acq_time
    ? new Date(`${fire.acq_date}T${fire.acq_time.padStart(4, '0').replace(/(\d{2})(\d{2})/, '$1:$2')}:00Z`).toISOString()
    : new Date().toISOString();

  const regionLabel = fire.region || 'Unknown Region';
  const frpLabel = fire.frp >= 100 ? 'Intense' : fire.frp >= 50 ? 'Large' : fire.frp >= 10 ? 'Moderate' : 'Small';

  const normalized: GlobalDisasterEvent = {
    id: `firms-${fire.acq_date}-${fire.latitude.toFixed(3)}-${fire.longitude.toFixed(3)}-${index}`,
    source: 'nasa-firms',
    title: `${frpLabel} Fire (${fire.frp.toFixed(0)} MW) — ${regionLabel}`,
    severity: classifyFIRMSSeverity(fire.frp),
    coordinates: { longitude: fire.longitude, latitude: fire.latitude },
    timestamp,
    eventType: 'fire',
    metadata: {
      frp: fire.frp,
      brightness: fire.brightness,
      confidence: fire.confidence,
      daynight: fire.daynight === 'N' ? 'Night' : 'Day',
      satellite: fire.satellite,
      region: regionLabel,
    },
  };

  return GlobalDisasterEventSchema.parse(normalized);
}

// ─── Batch Normalizer ───────────────────────────────────────────────────────

/**
 * Takes raw USGS features, NASA EONET events, NOAA alerts, and FIRMS
 * detections and produces a single unified array of GlobalDisasterEvent
 * objects, sorted by timestamp (most recent first).
 *
 * Individual events that fail normalization are skipped with a warning
 * rather than crashing the entire batch.
 */
export function normalizeAll(
  usgsFeatures: USGSFeature[],
  eonetEvents: EONETEvent[],
  noaaAlerts: NOAAAlert[] = [],
  firmsDetections: FIRMSDetection[] = [],
): GlobalDisasterEvent[] {
  const normalizedUSGS = usgsFeatures.flatMap((f) => {
    try {
      return [normalizeUSGSFeature(f)];
    } catch (err: any) {
      console.warn(`[normalizer] Skipped USGS event ${f.id}:`, err.message);
      return [];
    }
  });

  const normalizedEONET = eonetEvents.flatMap((e) => {
    try {
      return [normalizeEONETEvent(e)];
    } catch (err: any) {
      console.warn(`[normalizer] Skipped EONET event ${e.id}:`, err.message);
      return [];
    }
  });

  const normalizedNOAA = noaaAlerts.flatMap((a) => {
    try {
      return [normalizeNOAAAlert(a)];
    } catch (err: any) {
      console.warn(`[normalizer] Skipped NOAA alert ${a.id}:`, err.message);
      return [];
    }
  });

  const normalizedFIRMS = firmsDetections.flatMap((f, i) => {
    try {
      return [normalizeFIRMSDetection(f, i)];
    } catch (err: any) {
      console.warn(`[normalizer] Skipped FIRMS detection:`, err.message);
      return [];
    }
  });

  const allEvents = [...normalizedUSGS, ...normalizedEONET, ...normalizedNOAA, ...normalizedFIRMS];

  // Sort by timestamp descending (most recent first)
  allEvents.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  return allEvents;
}

