import axios, { AxiosInstance } from 'axios';

// ─── NOAA/NWS Alert Response Types ──────────────────────────────────────────

export interface NOAAAlertProperties {
  id: string;
  areaDesc: string;
  geocode: {
    SAME?: string[];
    UGC?: string[];
  };
  affectedZones: string[];
  references: Array<{ identifier: string; sender: string; sent: string }>;
  sent: string;
  effective: string;
  onset: string | null;
  expires: string;
  ends: string | null;
  status: string;
  messageType: string;
  category: string;
  severity: 'Extreme' | 'Severe' | 'Moderate' | 'Minor' | 'Unknown';
  certainty: string;
  urgency: string;
  event: string;
  sender: string;
  senderName: string;
  headline: string | null;
  description: string | null;
  instruction: string | null;
  response: string;
}

export interface NOAAAlertGeometry {
  type: 'Polygon' | 'Point' | null;
  coordinates: number[][][] | number[] | null;
}

export interface NOAAAlert {
  id: string;
  type: 'Feature';
  geometry: NOAAAlertGeometry | null;
  properties: NOAAAlertProperties;
}

export interface NOAAAlertResponse {
  type: 'FeatureCollection';
  features: NOAAAlert[];
  title: string;
  updated: string;
}

// ─── Severity Filter — only severe weather events ───────────────────────────

export const NOAA_TARGET_EVENTS = [
  'Tornado Warning',
  'Tornado Watch',
  'Severe Thunderstorm Warning',
  'Severe Thunderstorm Watch',
  'Hurricane Warning',
  'Hurricane Watch',
  'Tropical Storm Warning',
  'Tropical Storm Watch',
  'Flash Flood Warning',
  'Flood Warning',
  'Tsunami Warning',
  'Tsunami Watch',
  'Extreme Wind Warning',
  'Blizzard Warning',
  'Ice Storm Warning',
  'Winter Storm Warning',
  'Earthquake Warning',
  'Volcano Warning',
] as const;

// ─── NOAA Client ────────────────────────────────────────────────────────────

export class NOAAClient {
  private readonly http: AxiosInstance;

  static readonly BASE_URL = 'https://api.weather.gov';
  static readonly ALERTS_PATH = '/alerts/active';

  constructor(httpClient?: AxiosInstance) {
    this.http =
      httpClient ??
      axios.create({
        baseURL: NOAAClient.BASE_URL,
        timeout: 15_000,
        headers: {
          Accept: 'application/geo+json',
          'User-Agent': '(TerraMind Core, github.com/terramind)',
        },
      });
  }

  /**
   * Fetches active severe weather alerts from NOAA/NWS.
   * Filters to significant warnings only (tornados, hurricanes, floods, etc.)
   * 
   * Note: NOAA API is US-only. The returned data covers only US territories.
   *
   * @returns Array of {@link NOAAAlert} objects for severe events.
   */
  async fetchActiveAlerts(): Promise<NOAAAlert[]> {
    const { data } = await this.http.get<NOAAAlertResponse>(
      NOAAClient.ALERTS_PATH,
      {
        params: {
          status: 'actual',
          message_type: 'alert',
        },
      },
    );

    this.validateResponse(data);

    // Filter to significant weather events only
    return data.features.filter((alert) =>
      NOAA_TARGET_EVENTS.some((target) =>
        alert.properties.event.toLowerCase().includes(target.toLowerCase()),
      ),
    );
  }

  // ── Validation ──────────────────────────────────────────────────────────

  private validateResponse(data: NOAAAlertResponse): void {
    if (!Array.isArray(data.features)) {
      throw new Error(
        '[NOAAClient] Response missing "features" array.',
      );
    }
  }
}
