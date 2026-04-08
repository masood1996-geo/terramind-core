import axios, { AxiosInstance } from 'axios';

// ─── USGS GeoJSON Response Types ────────────────────────────────────────────

export interface USGSFeatureProperties {
  mag: number | null;
  place: string | null;
  time: number;
  updated: number;
  tz: number | null;
  url: string;
  detail: string;
  felt: number | null;
  cdi: number | null;
  mmi: number | null;
  alert: string | null;
  status: string;
  tsunami: number;
  sig: number;
  net: string;
  code: string;
  ids: string;
  sources: string;
  types: string;
  nst: number | null;
  dmin: number | null;
  rms: number;
  gap: number | null;
  magType: string | null;
  type: string;
  title: string;
}

export interface USGSGeometry {
  type: 'Point';
  coordinates: [longitude: number, latitude: number, depth: number];
}

export interface USGSFeature {
  type: 'Feature';
  properties: USGSFeatureProperties;
  geometry: USGSGeometry;
  id: string;
}

export interface USGSMetadata {
  generated: number;
  url: string;
  title: string;
  api: string;
  count: number;
  status: number;
}

export interface USGSGeoJSONResponse {
  type: 'FeatureCollection';
  metadata: USGSMetadata;
  features: USGSFeature[];
  bbox?: number[];
}

// ─── Time Range Types ───────────────────────────────────────────────────────

export type USGSTimeRange = 'hour' | 'day' | 'week';

// ─── USGS Client ────────────────────────────────────────────────────────────

export class USGSClient {
  private readonly http: AxiosInstance;

  /** Base URL for the USGS earthquake feed */
  static readonly BASE_URL = 'https://earthquake.usgs.gov';

  /** Feed paths for different time ranges */
  static readonly FEED_URLS: Record<USGSTimeRange, string> = {
    hour: '/earthquakes/feed/v1.0/summary/all_hour.geojson',
    day: '/earthquakes/feed/v1.0/summary/all_day.geojson',
    week: '/earthquakes/feed/v1.0/summary/all_week.geojson',
  };

  /** @deprecated Use FEED_URLS['hour'] instead */
  static readonly ALL_HOUR_FEED = USGSClient.FEED_URLS.hour;

  constructor(httpClient?: AxiosInstance) {
    this.http =
      httpClient ??
      axios.create({
        baseURL: USGSClient.BASE_URL,
        timeout: 15_000,
        headers: { Accept: 'application/json' },
      });
  }

  /**
   * Fetches all earthquakes from the USGS GeoJSON Summary feed
   * for the specified time range.
   *
   * @param timeRange — 'hour' | 'day' | 'week' (default: 'hour')
   * @returns Parsed array of {@link USGSFeature} objects.
   */
  async fetchRecentEarthquakes(timeRange: USGSTimeRange = 'hour'): Promise<USGSFeature[]> {
    const feedUrl = USGSClient.FEED_URLS[timeRange] ?? USGSClient.FEED_URLS.hour;
    const { data } = await this.http.get<USGSGeoJSONResponse>(feedUrl);

    this.validateResponse(data);
    return data.features;
  }

  /**
   * Fetches raw GeoJSON response (useful for metadata access).
   */
  async fetchRawFeed(timeRange: USGSTimeRange = 'hour'): Promise<USGSGeoJSONResponse> {
    const feedUrl = USGSClient.FEED_URLS[timeRange] ?? USGSClient.FEED_URLS.hour;
    const { data } = await this.http.get<USGSGeoJSONResponse>(feedUrl);

    this.validateResponse(data);
    return data;
  }

  // ── Validation ──────────────────────────────────────────────────────────

  private validateResponse(data: USGSGeoJSONResponse): void {
    if (data.type !== 'FeatureCollection') {
      throw new Error(
        `[USGSClient] Unexpected response type: "${data.type}". Expected "FeatureCollection".`,
      );
    }

    if (!Array.isArray(data.features)) {
      throw new Error(
        '[USGSClient] Response missing "features" array.',
      );
    }
  }
}
