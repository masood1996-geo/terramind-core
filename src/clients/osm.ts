import { BuildingExposure } from './gba';

export class OSMClient {
  private static readonly OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

  /**
   * Fetches building exposure counts from OpenStreetMap using the Overpass API.
   * This is used as a highly reliable fallback when the GBA WFS is down.
   */
  async getBuildingExposureFallback(lat: number, lon: number, radiusKm: number): Promise<BuildingExposure> {
    const radiusMeters = radiusKm * 1000;
    
    // Query uses the 'count' output which is highly optimized and doesn't download geometries.
    // We only care about ways and relations tagged with 'building' (nodes aren't buildings).
    const query = `[out:json][timeout:25];
      (
        way["building"](around:${radiusMeters},${lat},${lon});
        relation["building"](around:${radiusMeters},${lat},${lon});
      );
      out count;`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(OSMClient.OVERPASS_URL, {
        method: 'POST', // Overpass prefers POST for large queries, though this one is small
        body: 'data=' + encodeURIComponent(query),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'TerraMind/4.1.0 (Disaster Resilience Dashboard)',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Overpass API Error: ${response.status}`);
      }

      const rawText = await response.text();
      const data = JSON.parse(rawText);

      // Overpass 'out count' format looks like:
      // { "elements": [{ "type": "count", "id": 0, "tags": { "ways": "534", "relations": "2", "nodes": "0" } }] }
      const countData = data.elements?.[0]?.tags;
      const count = Number(countData?.ways || 0) + Number(countData?.relations || 0) + Number(countData?.nodes || 0);

      // Infer density class from count
      let densityClass: 'uninhabited' | 'rural' | 'suburban' | 'urban' = 'uninhabited';
      let densityDesc = 'No buildings detected in this radius.';

      if (count > 0 && count < 1000) {
        densityClass = 'rural';
        densityDesc = 'Rural or sparsely populated area.';
      } else if (count >= 1000 && count < 10000) {
        densityClass = 'suburban';
        densityDesc = 'Suburban density with moderate infrastructure.';
      } else if (count >= 10000) {
        densityClass = 'urban';
        densityDesc = 'Highly urbanized area with extensive infrastructure.';
      }

      return {
        buildingCount: count,
        avgHeight: 0,
        maxHeight: 0,
        totalFootprintArea: 0,
        densityClass,
        queryRadiusKm: radiusKm,
        available: true,
      };

    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('OSM Overpass API request timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
