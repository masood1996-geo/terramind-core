import axios, { AxiosInstance } from 'axios';

// ─── NASA EONET v3 Response Types ───────────────────────────────────────────

export interface EONETCategory {
  id: string;
  title: string;
}

export interface EONETSource {
  id: string;
  url: string;
}

export interface EONETMagnitude {
  id: string;
  value: number;
  unit: string;
}

export interface EONETGeometry {
  magnitudeValue: number | null;
  magnitudeUnit: string | null;
  date: string;
  type: 'Point' | 'Polygon';
  coordinates: number[] | number[][];
}

export interface EONETEvent {
  id: string;
  title: string;
  description: string | null;
  link: string;
  closed: string | null;
  categories: EONETCategory[];
  sources: EONETSource[];
  geometry: EONETGeometry[];
}

export interface EONETResponse {
  title: string;
  description: string;
  link: string;
  events: EONETEvent[];
}

// ─── Target category IDs for filtering ──────────────────────────────────────

export const EONET_WILDFIRE_CATEGORY = 'wildfires';
export const EONET_SEVERE_STORM_CATEGORY = 'severeStorms';
export const EONET_TARGET_CATEGORIES = [
  EONET_WILDFIRE_CATEGORY,
  EONET_SEVERE_STORM_CATEGORY,
] as const;

export type TargetCategory = (typeof EONET_TARGET_CATEGORIES)[number];

// ─── NASA EONET Client ──────────────────────────────────────────────────────

export class NASAClient {
  private readonly http: AxiosInstance;

  static readonly BASE_URL = 'https://eonet.gsfc.nasa.gov';

  /** Endpoint filtered to wildfires and severe storms, open events only */
  static readonly EVENTS_PATH = '/api/v3/events';

  constructor(httpClient?: AxiosInstance) {
    this.http =
      httpClient ??
      axios.create({
        baseURL: NASAClient.BASE_URL,
        timeout: 15_000,
        headers: { Accept: 'application/json' },
      });
  }

  /**
   * Fetches wildfires and severe storms from NASA EONET v3.
   * Filters to open events in the target categories.
   *
   * @param days — Number of days to look back (default: 7)
   * @returns Array of {@link EONETEvent} limited to wildfires & severe storms.
   */
  async fetchDisasterEvents(days: number = 7): Promise<EONETEvent[]> {
    const { data } = await this.http.get<EONETResponse>(
      NASAClient.EVENTS_PATH,
      {
        params: {
          category: EONET_TARGET_CATEGORIES.join(','),
          status: 'open',
          days,
        },
      },
    );

    this.validateResponse(data);
    return data.events;
  }

  /**
   * Fetches the raw EONET response (useful for metadata access).
   */
  async fetchRawEvents(days: number = 7): Promise<EONETResponse> {
    const { data } = await this.http.get<EONETResponse>(
      NASAClient.EVENTS_PATH,
      {
        params: {
          category: EONET_TARGET_CATEGORIES.join(','),
          status: 'open',
          days,
        },
      },
    );

    this.validateResponse(data);
    return data;
  }

  // ── Validation ──────────────────────────────────────────────────────────

  private validateResponse(data: EONETResponse): void {
    if (!Array.isArray(data.events)) {
      throw new Error(
        '[NASAClient] Response missing "events" array.',
      );
    }
  }
}
