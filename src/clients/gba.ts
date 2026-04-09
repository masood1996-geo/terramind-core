import axios, { AxiosInstance } from 'axios';

// ─── GBA (GlobalBuildingAtlas) Response Types ───────────────────────────────

export interface GBABuildingProperties {
  /** Estimated building height in meters */
  height?: number;
  /** Height estimation variance (uncertainty) */
  var?: number;
  /** Data source identifier (e.g., 'osm', 'ms', 'google') */
  source?: string;
  /** Any additional properties from the WFS response */
  [key: string]: unknown;
}

export interface GBABuildingFeature {
  type: 'Feature';
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
  properties: GBABuildingProperties;
}

export interface GBAFeatureCollection {
  type: 'FeatureCollection';
  features: GBABuildingFeature[];
  totalFeatures?: number;
  numberMatched?: number;
  numberReturned?: number;
}

/**
 * Building exposure summary for a disaster event's affected area.
 */
export interface BuildingExposure {
  /** Total number of buildings found in the query area */
  buildingCount: number;
  /** Average building height in meters (0 if no height data) */
  avgHeight: number;
  /** Maximum building height in meters */
  maxHeight: number;
  /** Estimated total footprint area in square meters */
  totalFootprintArea: number;
  /** Density classification based on building count */
  densityClass: 'urban' | 'suburban' | 'rural' | 'uninhabited';
  /** Query radius used in kilometers */
  queryRadiusKm: number;
  /** Whether the WFS query was successful */
  available: boolean;
  /** Error message if query failed */
  error?: string;
}

// ─── GBA WFS Client ────────────────────────────────────────────────────────

export class GBAClient {
  private readonly http: AxiosInstance;

  /** Default GBA GeoServer WFS endpoint */
  static readonly DEFAULT_WFS_URL = 'https://tubvsig-so2sat-vm1.srv.mwn.de/geoserver/ows';

  /** Maximum features to request per query (to avoid overwhelming the server) */
  static readonly MAX_FEATURES = 500;

  /** Default query radius in kilometers */
  static readonly DEFAULT_RADIUS_KM = 25;

  /** Request timeout in milliseconds */
  static readonly TIMEOUT_MS = 15_000;

  /** Approximate conversion: 1 degree latitude ≈ 111.32 km */
  static readonly KM_PER_DEG_LAT = 111.32;

  constructor(httpClient?: AxiosInstance) {
    const baseUrl = process.env.GBA_WFS_URL || GBAClient.DEFAULT_WFS_URL;
    this.http =
      httpClient ??
      axios.create({
        baseURL: baseUrl,
        timeout: GBAClient.TIMEOUT_MS,
        headers: { Accept: 'application/json' },
      });
  }

  /**
   * Queries building footprints within a radius of a coordinate.
   *
   * Uses the OGC WFS GetFeature request with a BBOX filter.
   * The GBA WFS stores data in EPSG:3857, but we query in EPSG:4326 for
   * ease of use and let GeoServer handle reprojection.
   *
   * @param lat   — Latitude of center point (WGS84)
   * @param lon   — Longitude of center point (WGS84)
   * @param radiusKm — Search radius in kilometers (default: 25)
   * @returns Array of building features within the bbox
   */
  async fetchBuildingsInRadius(
    lat: number,
    lon: number,
    radiusKm: number = GBAClient.DEFAULT_RADIUS_KM,
  ): Promise<GBAFeatureCollection> {
    const bbox = GBAClient.computeBBox(lat, lon, radiusKm);

    const params = {
      service: 'WFS',
      version: '2.0.0',
      request: 'GetFeature',
      // GBA typically serves under a workspace; try common layer names
      typeName: 'GBA:buildings',
      outputFormat: 'application/json',
      srsName: 'EPSG:4326',
      bbox: `${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon},EPSG:4326`,
      count: String(GBAClient.MAX_FEATURES),
    };

    const { data } = await this.http.get<GBAFeatureCollection>('', { params });
    this.validateResponse(data);
    return data;
  }

  /**
   * Computes a building exposure summary for a given location.
   * This is the primary method for TerraMind integration.
   *
   * @param lat      — Latitude (WGS84)
   * @param lon      — Longitude (WGS84)
   * @param radiusKm — Search radius in km (default: 25)
   * @returns BuildingExposure summary
   */
  async getBuildingExposure(
    lat: number,
    lon: number,
    radiusKm: number = GBAClient.DEFAULT_RADIUS_KM,
  ): Promise<BuildingExposure> {
    try {
      const fc = await this.fetchBuildingsInRadius(lat, lon, radiusKm);
      return GBAClient.computeExposure(fc, radiusKm);
    } catch (err: any) {
      console.warn(`[GBAClient] Building exposure query failed: ${err.message}`);
      return {
        buildingCount: 0,
        avgHeight: 0,
        maxHeight: 0,
        totalFootprintArea: 0,
        densityClass: 'uninhabited',
        queryRadiusKm: radiusKm,
        available: false,
        error: err.message,
      };
    }
  }

  // ── Static Helpers ───────────────────────────────────────────────────────

  /**
   * Computes a bounding box from a center point and radius.
   */
  static computeBBox(
    lat: number,
    lon: number,
    radiusKm: number,
  ): { minLat: number; maxLat: number; minLon: number; maxLon: number } {
    const dLat = radiusKm / GBAClient.KM_PER_DEG_LAT;
    // Longitude degrees per km varies with latitude
    const kmPerDegLon = GBAClient.KM_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
    const dLon = kmPerDegLon > 0 ? radiusKm / kmPerDegLon : radiusKm / GBAClient.KM_PER_DEG_LAT;

    return {
      minLat: lat - dLat,
      maxLat: lat + dLat,
      minLon: lon - dLon,
      maxLon: lon + dLon,
    };
  }

  /**
   * Computes a BuildingExposure summary from a feature collection.
   */
  static computeExposure(
    fc: GBAFeatureCollection,
    radiusKm: number,
  ): BuildingExposure {
    const features = fc.features || [];
    const count = features.length;

    if (count === 0) {
      return {
        buildingCount: 0,
        avgHeight: 0,
        maxHeight: 0,
        totalFootprintArea: 0,
        densityClass: 'uninhabited',
        queryRadiusKm: radiusKm,
        available: true,
      };
    }

    // Compute height statistics
    let totalHeight = 0;
    let maxHeight = 0;
    let heightCount = 0;

    for (const f of features) {
      const h = f.properties?.height;
      if (h != null && typeof h === 'number' && h > 0) {
        totalHeight += h;
        if (h > maxHeight) maxHeight = h;
        heightCount++;
      }
    }

    const avgHeight = heightCount > 0 ? totalHeight / heightCount : 0;

    // Estimate total footprint area (rough: sum polygon areas)
    let totalArea = 0;
    for (const f of features) {
      totalArea += GBAClient.estimatePolygonArea(f.geometry);
    }

    // Classify density based on building count relative to query area
    const queryAreaKm2 = Math.PI * radiusKm * radiusKm;
    const densityPerKm2 = count / queryAreaKm2;

    let densityClass: BuildingExposure['densityClass'];
    if (densityPerKm2 > 100) densityClass = 'urban';
    else if (densityPerKm2 > 20) densityClass = 'suburban';
    else if (densityPerKm2 > 1) densityClass = 'rural';
    else densityClass = 'uninhabited';

    // If we hit the feature limit, the actual count is likely higher
    const effectiveCount = count >= GBAClient.MAX_FEATURES
      ? (fc.numberMatched ?? fc.totalFeatures ?? count)
      : count;

    return {
      buildingCount: effectiveCount,
      avgHeight: Math.round(avgHeight * 10) / 10,
      maxHeight: Math.round(maxHeight * 10) / 10,
      totalFootprintArea: Math.round(totalArea),
      densityClass,
      queryRadiusKm: radiusKm,
      available: true,
    };
  }

  /**
   * Rough polygon area estimation in square meters using the Shoelace formula.
   * Assumes WGS84 coordinates and converts to approximate metric area.
   */
  static estimatePolygonArea(geometry: GBABuildingFeature['geometry']): number {
    try {
      let ring: number[][];
      if (geometry.type === 'Polygon') {
        ring = (geometry.coordinates as number[][][])[0] || [];
      } else if (geometry.type === 'MultiPolygon') {
        ring = ((geometry.coordinates as number[][][][])[0] || [])[0] || [];
      } else {
        return 0;
      }

      if (ring.length < 3) return 0;

      // Shoelace formula in degrees, then convert
      let area = 0;
      for (let i = 0; i < ring.length; i++) {
        const j = (i + 1) % ring.length;
        area += ring[i][0] * ring[j][1];
        area -= ring[j][0] * ring[i][1];
      }
      area = Math.abs(area) / 2;

      // Convert from deg² to approximate m² (at equator, 1 deg ≈ 111,320m)
      const avgLat = ring.reduce((s, p) => s + (p[1] || 0), 0) / ring.length;
      const mPerDegLat = 111320;
      const mPerDegLon = 111320 * Math.cos((avgLat * Math.PI) / 180);
      return area * mPerDegLat * mPerDegLon;
    } catch {
      return 0;
    }
  }

  // ── Validation ──────────────────────────────────────────────────────────

  private validateResponse(data: GBAFeatureCollection): void {
    if (data.type !== 'FeatureCollection') {
      throw new Error(
        `[GBAClient] Unexpected response type: "${data.type}". Expected "FeatureCollection".`,
      );
    }

    if (!Array.isArray(data.features)) {
      throw new Error(
        '[GBAClient] Response missing "features" array.',
      );
    }
  }
}
