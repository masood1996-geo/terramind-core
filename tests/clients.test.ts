import { describe, it, expect, beforeEach } from 'vitest';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { USGSClient, USGSGeoJSONResponse } from '../src/clients/usgs';
import { NASAClient, EONETResponse } from '../src/clients/nasa';
import { GDACSClient, GDACSFeedResponse } from '../src/clients/gdacs';
import {
  normalizeUSGSFeature,
  normalizeEONETEvent,
  normalizeGDACSFeature,
  normalizeAll,
  GlobalDisasterEventSchema,
} from '../src/pipeline/normalizer';

// ─── Mock Data ──────────────────────────────────────────────────────────────

const mockUSGSResponse: USGSGeoJSONResponse = {
  type: 'FeatureCollection',
  metadata: {
    generated: 1712592000000,
    url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson',
    title: 'USGS All Earthquakes, Past Hour',
    api: '1.10.3',
    count: 2,
    status: 200,
  },
  features: [
    {
      type: 'Feature',
      properties: {
        mag: 5.6,
        place: '45km NNE of Ridgecrest, CA',
        time: 1712592000000,
        updated: 1712592060000,
        tz: null,
        url: 'https://earthquake.usgs.gov/earthquakes/eventpage/ci40917392',
        detail:
          'https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/ci40917392.geojson',
        felt: 120,
        cdi: 5.2,
        mmi: 6.1,
        alert: 'yellow',
        status: 'automatic',
        tsunami: 0,
        sig: 499,
        net: 'ci',
        code: '40917392',
        ids: ',ci40917392,',
        sources: ',ci,',
        types: ',shakemap,dyfi,',
        nst: 45,
        dmin: 0.024,
        rms: 0.15,
        gap: 52,
        magType: 'mw',
        type: 'earthquake',
        title: 'M 5.6 - 45km NNE of Ridgecrest, CA',
      },
      geometry: {
        type: 'Point',
        coordinates: [-117.602, 35.891, 8.5],
      },
      id: 'ci40917392',
    },
    {
      type: 'Feature',
      properties: {
        mag: 1.2,
        place: '3km SE of The Geysers, CA',
        time: 1712591000000,
        updated: 1712591060000,
        tz: null,
        url: 'https://earthquake.usgs.gov/earthquakes/eventpage/nc75001001',
        detail:
          'https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/nc75001001.geojson',
        felt: null,
        cdi: null,
        mmi: null,
        alert: null,
        status: 'automatic',
        tsunami: 0,
        sig: 22,
        net: 'nc',
        code: '75001001',
        ids: ',nc75001001,',
        sources: ',nc,',
        types: ',nearby-cities,',
        nst: 12,
        dmin: 0.008,
        rms: 0.05,
        gap: 85,
        magType: 'md',
        type: 'earthquake',
        title: 'M 1.2 - 3km SE of The Geysers, CA',
      },
      geometry: {
        type: 'Point',
        coordinates: [-122.729, 38.76, 2.1],
      },
      id: 'nc75001001',
    },
  ],
};

const mockNASAResponse: EONETResponse = {
  title: 'EONET Events',
  description: 'Natural events from EONET.',
  link: 'https://eonet.gsfc.nasa.gov/api/v3/events',
  events: [
    {
      id: 'EONET_6422',
      title: 'Wildfire - Southern California',
      description: null,
      link: 'https://eonet.gsfc.nasa.gov/api/v3/events/EONET_6422',
      closed: null,
      categories: [{ id: 'wildfires', title: 'Wildfires' }],
      sources: [
        { id: 'InciWeb', url: 'https://inciweb.nwcg.gov/incident/7935/' },
      ],
      geometry: [
        {
          magnitudeValue: null,
          magnitudeUnit: null,
          date: '2026-04-07T12:00:00Z',
          type: 'Point',
          coordinates: [-118.25, 34.05],
        },
      ],
    },
    {
      id: 'EONET_6430',
      title: 'Tropical Storm Epsilon',
      description: null,
      link: 'https://eonet.gsfc.nasa.gov/api/v3/events/EONET_6430',
      closed: null,
      categories: [{ id: 'severeStorms', title: 'Severe Storms' }],
      sources: [
        {
          id: 'JTWC',
          url: 'https://www.metoc.navy.mil/jtwc/jtwc.html',
        },
      ],
      geometry: [
        {
          magnitudeValue: 55,
          magnitudeUnit: 'kts',
          date: '2026-04-08T06:00:00Z',
          type: 'Point',
          coordinates: [-62.3, 18.7],
        },
        {
          magnitudeValue: 75,
          magnitudeUnit: 'kts',
          date: '2026-04-08T12:00:00Z',
          type: 'Point',
          coordinates: [-63.1, 19.2],
        },
      ],
    },
  ],
};

const mockGDACSResponse: GDACSFeedResponse = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      bbox: [123.9891, -8.4704, 123.9891, -8.4704],
      geometry: {
        type: 'Point',
        coordinates: [123.9891, -8.4704],
      },
      properties: {
        eventtype: 'EQ',
        eventid: 1537227,
        episodeid: 1701999,
        name: 'Earthquake in Indonesia',
        description: 'Earthquake in Indonesia',
        alertlevel: 'Green',
        alertscore: 1,
        episodealertlevel: 'Green',
        episodealertscore: 0,
        istemporary: 'false',
        iscurrent: 'true',
        country: 'Indonesia',
        fromdate: '2026-04-24T16:10:57',
        todate: '2026-04-24T16:10:57',
        datemodified: '2026-04-24T16:51:24',
        iso3: 'IDN',
        source: 'NEIC',
        url: {
          report: 'https://www.gdacs.org/report.aspx?eventid=1537227&episodeid=1701999&eventtype=EQ',
          details: 'https://www.gdacs.org/gdacsapi/api/events/geteventdata?eventtype=EQ&eventid=1537227',
        },
        affectedcountries: [
          { iso2: 'ID', iso3: 'IDN', countryname: 'Indonesia' },
        ],
        severitydata: {
          severity: 4.5,
          severitytext: 'Magnitude 4.5M, Depth:172.359km',
          severityunit: 'M',
        },
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [-72.5, 18.9],
      },
      properties: {
        eventtype: 'TC',
        eventid: 'TC1001230',
        episodeid: '1',
        name: 'Tropical Cyclone Example',
        alertlevel: 'Red',
        iscurrent: 'true',
        fromdate: '2026-04-24T10:00:00',
        country: 'Haiti',
        source: 'GDACS',
      },
    },
  ],
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('USGSClient', () => {
  let mock: MockAdapter;
  let client: USGSClient;

  beforeEach(() => {
    const instance = axios.create({ baseURL: USGSClient.BASE_URL });
    mock = new MockAdapter(instance);
    client = new USGSClient(instance);
  });

  it('should fetch and return earthquake features', async () => {
    mock.onGet(USGSClient.ALL_HOUR_FEED).reply(200, mockUSGSResponse);

    const features = await client.fetchRecentEarthquakes();

    expect(features).toHaveLength(2);
    expect(features[0].id).toBe('ci40917392');
    expect(features[0].properties.mag).toBe(5.6);
    expect(features[0].geometry.coordinates).toEqual([-117.602, 35.891, 8.5]);
  });

  it('should return the raw GeoJSON feed with metadata', async () => {
    mock.onGet(USGSClient.ALL_HOUR_FEED).reply(200, mockUSGSResponse);

    const raw = await client.fetchRawFeed();

    expect(raw.type).toBe('FeatureCollection');
    expect(raw.metadata.count).toBe(2);
    expect(raw.metadata.title).toBe('USGS All Earthquakes, Past Hour');
  });

  it('should throw on invalid response type', async () => {
    mock.onGet(USGSClient.ALL_HOUR_FEED).reply(200, {
      type: 'InvalidType',
      features: [],
      metadata: {},
    });

    await expect(client.fetchRecentEarthquakes()).rejects.toThrow(
      'Unexpected response type',
    );
  });

  it('should throw on missing features array', async () => {
    mock.onGet(USGSClient.ALL_HOUR_FEED).reply(200, {
      type: 'FeatureCollection',
      metadata: {},
    });

    await expect(client.fetchRecentEarthquakes()).rejects.toThrow(
      'missing "features" array',
    );
  });

  it('should handle network errors gracefully', async () => {
    mock.onGet(USGSClient.ALL_HOUR_FEED).networkError();

    await expect(client.fetchRecentEarthquakes()).rejects.toThrow();
  });
});

describe('NASAClient', () => {
  let mock: MockAdapter;
  let client: NASAClient;

  beforeEach(() => {
    const instance = axios.create({ baseURL: NASAClient.BASE_URL });
    mock = new MockAdapter(instance);
    client = new NASAClient(instance);
  });

  it('should fetch wildfire and storm events', async () => {
    mock.onGet(NASAClient.EVENTS_PATH).reply(200, mockNASAResponse);

    const events = await client.fetchDisasterEvents();

    expect(events).toHaveLength(2);
    expect(events[0].id).toBe('EONET_6422');
    expect(events[0].categories[0].id).toBe('wildfires');
    expect(events[1].categories[0].id).toBe('severeStorms');
  });

  it('should return raw EONET response with metadata', async () => {
    mock.onGet(NASAClient.EVENTS_PATH).reply(200, mockNASAResponse);

    const raw = await client.fetchRawEvents();

    expect(raw.title).toBe('EONET Events');
    expect(raw.events).toHaveLength(2);
  });

  it('should throw on missing events array', async () => {
    mock.onGet(NASAClient.EVENTS_PATH).reply(200, { title: 'Bad' });

    await expect(client.fetchDisasterEvents()).rejects.toThrow(
      'missing "events" array',
    );
  });

  it('should handle network errors gracefully', async () => {
    mock.onGet(NASAClient.EVENTS_PATH).networkError();

    await expect(client.fetchDisasterEvents()).rejects.toThrow();
  });
});

describe('GDACSClient', () => {
  let mock: MockAdapter;
  let client: GDACSClient;

  beforeEach(() => {
    const instance = axios.create({ baseURL: GDACSClient.BASE_URL });
    mock = new MockAdapter(instance);
    client = new GDACSClient(instance);
  });

  it('should fetch active GDACS alerts', async () => {
    mock.onGet(GDACSClient.FEED_PATH).reply(200, mockGDACSResponse);

    const alerts = await client.fetchActiveAlerts();

    expect(alerts).toHaveLength(2);
    expect(alerts[0].properties.eventtype).toBe('EQ');
    expect(alerts[0].properties.alertlevel).toBe('Green');
  });

  it('should throw on invalid GDACS feed shape', async () => {
    mock.onGet(GDACSClient.FEED_PATH).reply(200, {
      type: 'FeatureCollection',
    });

    await expect(client.fetchActiveAlerts()).rejects.toThrow(
      'missing "features" array',
    );
  });
});

describe('Normalizer', () => {
  it('should normalize a USGS feature into a valid GlobalDisasterEvent', () => {
    const feature = mockUSGSResponse.features[0];
    const normalized = normalizeUSGSFeature(feature);

    expect(normalized.id).toBe('usgs-ci40917392');
    expect(normalized.source).toBe('usgs');
    expect(normalized.severity).toBe('major'); // mag 5.6 → major
    expect(normalized.coordinates.longitude).toBe(-117.602);
    expect(normalized.coordinates.latitude).toBe(35.891);
    expect(normalized.eventType).toBe('earthquake');

    // Validate against Zod schema
    const result = GlobalDisasterEventSchema.safeParse(normalized);
    expect(result.success).toBe(true);
  });

  it('should classify earthquake severity correctly', () => {
    const features = mockUSGSResponse.features;

    const major = normalizeUSGSFeature(features[0]);
    expect(major.severity).toBe('major'); // mag 5.6

    const minor = normalizeUSGSFeature(features[1]);
    expect(minor.severity).toBe('minor'); // mag 1.2
  });

  it('should normalize a NASA EONET event into a valid GlobalDisasterEvent', () => {
    const event = mockNASAResponse.events[0];
    const normalized = normalizeEONETEvent(event);

    expect(normalized.id).toBe('eonet-EONET_6422');
    expect(normalized.source).toBe('nasa-eonet');
    expect(normalized.severity).toBe('moderate'); // wildfire default
    expect(normalized.coordinates.longitude).toBe(-118.25);
    expect(normalized.coordinates.latitude).toBe(34.05);
    expect(normalized.eventType).toBe('wildfires');

    const result = GlobalDisasterEventSchema.safeParse(normalized);
    expect(result.success).toBe(true);
  });

  it('should normalize a GDACS alert into a valid GlobalDisasterEvent', () => {
    const alert = mockGDACSResponse.features[0];
    const normalized = normalizeGDACSFeature(alert);

    expect(normalized.id).toBe('gdacs-EQ-1537227-1701999');
    expect(normalized.source).toBe('gdacs');
    expect(normalized.severity).toBe('minor'); // Green alert level
    expect(normalized.coordinates.longitude).toBe(123.9891);
    expect(normalized.coordinates.latitude).toBe(-8.4704);
    expect(normalized.eventType).toBe('earthquake');
    expect(normalized.metadata?.alertLevel).toBe('Green');

    const result = GlobalDisasterEventSchema.safeParse(normalized);
    expect(result.success).toBe(true);
  });

  it('should map Red GDACS alerts to critical severity', () => {
    const alert = mockGDACSResponse.features[1];
    const normalized = normalizeGDACSFeature(alert);

    expect(normalized.severity).toBe('critical');
    expect(normalized.eventType).toBe('tropical-cyclone');
  });

  it('should classify storm severity based on wind speed (kts)', () => {
    const storm = mockNASAResponse.events[1];
    const normalized = normalizeEONETEvent(storm);

    // Latest geometry has 75 kts → major (64-95 range)
    expect(normalized.severity).toBe('major');
  });

  it('should use the latest geometry point for coordinates', () => {
    const storm = mockNASAResponse.events[1];
    const normalized = normalizeEONETEvent(storm);

    // Storm has two geometry entries; should use the latest
    expect(normalized.coordinates.longitude).toBe(-63.1);
    expect(normalized.coordinates.latitude).toBe(19.2);
  });

  it('should merge and sort events by timestamp (most recent first)', () => {
    const merged = normalizeAll(
      mockUSGSResponse.features,
      mockNASAResponse.events,
      [],
      [],
      mockGDACSResponse.features,
    );

    expect(merged.length).toBe(6);

    // Verify descending timestamp order
    for (let i = 1; i < merged.length; i++) {
      const prev = new Date(merged[i - 1].timestamp).getTime();
      const curr = new Date(merged[i].timestamp).getTime();
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
  });

  it('should produce valid GlobalDisasterEvent objects for all events', () => {
    const merged = normalizeAll(
      mockUSGSResponse.features,
      mockNASAResponse.events,
      [],
      [],
      mockGDACSResponse.features,
    );

    for (const event of merged) {
      const result = GlobalDisasterEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    }
  });
});
