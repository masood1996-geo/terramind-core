import axios, { AxiosInstance } from 'axios';

export type GDACSAlertLevel = 'Green' | 'Orange' | 'Red' | string;

export interface GDACSAffectedCountry {
  iso2?: string;
  iso3?: string;
  countryname?: string;
}

export interface GDACSSeverityData {
  severity?: number;
  severitytext?: string;
  severityunit?: string;
}

export interface GDACSFeatureProperties {
  eventtype: string;
  eventid: number | string;
  episodeid?: number | string;
  eventname?: string;
  name?: string;
  description?: string;
  htmldescription?: string;
  url?: {
    geometry?: string;
    report?: string;
    details?: string;
  };
  alertlevel?: GDACSAlertLevel;
  alertscore?: number;
  episodealertlevel?: GDACSAlertLevel;
  episodealertscore?: number;
  istemporary?: string | boolean;
  iscurrent?: string | boolean;
  country?: string;
  fromdate?: string;
  todate?: string;
  datemodified?: string;
  iso3?: string;
  source?: string;
  sourceid?: string;
  affectedcountries?: GDACSAffectedCountry[];
  severitydata?: GDACSSeverityData;
}

export interface GDACSGeometry {
  type: 'Point' | 'Polygon' | 'MultiPolygon';
  coordinates: unknown;
}

export interface GDACSFeature {
  type: 'Feature';
  bbox?: number[];
  geometry: GDACSGeometry;
  properties: GDACSFeatureProperties;
}

export interface GDACSFeedResponse {
  type: 'FeatureCollection';
  features: GDACSFeature[];
}

export class GDACSClient {
  private readonly http: AxiosInstance;

  static readonly BASE_URL = 'https://www.gdacs.org';
  static readonly FEED_PATH = '/contentdata/xml/gdacs_app_feed.json';

  constructor(httpClient?: AxiosInstance) {
    this.http =
      httpClient ??
      axios.create({
        baseURL: GDACSClient.BASE_URL,
        timeout: 15_000,
        headers: { Accept: 'application/json' },
      });
  }

  /**
   * Fetches the public GDACS application feed as GeoJSON.
   *
   * The feed contains recent and ongoing global disaster alerts with GDACS
   * alert levels, report links, affected countries, and centroids/polygons.
   */
  async fetchActiveAlerts(): Promise<GDACSFeature[]> {
    const { data } = await this.http.get<GDACSFeedResponse>(GDACSClient.FEED_PATH);

    this.validateResponse(data);
    return data.features.filter((feature) => feature.properties.iscurrent !== 'false');
  }

  async fetchRawFeed(): Promise<GDACSFeedResponse> {
    const { data } = await this.http.get<GDACSFeedResponse>(GDACSClient.FEED_PATH);

    this.validateResponse(data);
    return data;
  }

  private validateResponse(data: GDACSFeedResponse): void {
    if (data.type !== 'FeatureCollection') {
      throw new Error(
        `[GDACSClient] Unexpected response type: "${data.type}". Expected "FeatureCollection".`,
      );
    }

    if (!Array.isArray(data.features)) {
      throw new Error('[GDACSClient] Response missing "features" array.');
    }
  }
}
