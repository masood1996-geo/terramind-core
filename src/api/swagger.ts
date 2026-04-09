/**
 * OpenAPI 3.0 specification for the TerraMind Core API.
 */
export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'TerraMind Core API',
    description:
      'Global disaster event aggregation platform. Normalizes USGS Earthquake, NASA EONET, NOAA NWS, NASA FIRMS, and GlobalBuildingAtlas data into a unified schema with building exposure analysis.',
    version: '4.0.0',
    contact: {
      name: 'TerraMind Core',
      url: 'https://github.com/terramind-core',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: 'http://localhost:{port}',
      description: 'Local development server',
      variables: {
        port: {
          default: '4100',
          description: 'Server port',
        },
      },
    },
  ],
  paths: {
    '/api/events': {
      get: {
        operationId: 'getDisasterEvents',
        summary: 'Get global disaster events',
        description:
          'Returns a merged, normalized array of recent earthquake (USGS) and natural disaster (NASA EONET) events, sorted by timestamp descending.',
        tags: ['Events'],
        parameters: [
          {
            name: 'source',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              enum: ['usgs', 'nasa-eonet', 'noaa-nws', 'nasa-firms'],
            },
            description:
              'Filter events by data source. Omit to return all sources.',
          },
          {
            name: 'severity',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              enum: ['minor', 'moderate', 'major', 'critical', 'unknown'],
            },
            description: 'Filter events by severity level.',
          },
        ],
        responses: {
          '200': {
            description: 'Successful response with disaster events.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    count: { type: 'integer', example: 42 },
                    timestamp: {
                      type: 'string',
                      format: 'date-time',
                      example: '2026-04-08T16:00:00.000Z',
                    },
                    events: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/GlobalDisasterEvent',
                      },
                    },
                  },
                },
              },
            },
          },
          '500': {
            description: 'Internal server error.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    error: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/buildings': {
      get: {
        operationId: 'getBuildingExposure',
        summary: 'Get building exposure around coordinates',
        description:
          'Queries GlobalBuildingAtlas WFS for building footprints within a radius of the given coordinates. Returns a building exposure summary including count, average height, density classification, and total footprint area.',
        tags: ['Buildings'],
        parameters: [
          {
            name: 'lat',
            in: 'query',
            required: true,
            schema: { type: 'number', minimum: -90, maximum: 90 },
            description: 'Latitude (WGS84)',
            example: 35.89,
          },
          {
            name: 'lon',
            in: 'query',
            required: true,
            schema: { type: 'number', minimum: -180, maximum: 180 },
            description: 'Longitude (WGS84)',
            example: -117.60,
          },
          {
            name: 'radius',
            in: 'query',
            required: false,
            schema: { type: 'number', minimum: 1, maximum: 50, default: 25 },
            description: 'Search radius in kilometers (default: 25, max: 50)',
          },
        ],
        responses: {
          '200': {
            description: 'Building exposure summary.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    source: { type: 'string', example: 'GlobalBuildingAtlas' },
                    query: {
                      type: 'object',
                      properties: {
                        lat: { type: 'number' },
                        lon: { type: 'number' },
                        radiusKm: { type: 'number' },
                      },
                    },
                    exposure: {
                      $ref: '#/components/schemas/BuildingExposure',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Invalid query parameters.',
          },
        },
      },
    },
    '/api/health': {
      get: {
        operationId: 'healthCheck',
        summary: 'Health check',
        description: 'Returns the health status of the TerraMind Core API.',
        tags: ['System'],
        responses: {
          '200': {
            description: 'Service is healthy.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    uptime: { type: 'number', example: 12345.67 },
                    version: { type: 'string', example: '4.0.0' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      GlobalDisasterEvent: {
        type: 'object',
        required: [
          'id',
          'source',
          'title',
          'severity',
          'coordinates',
          'timestamp',
          'eventType',
        ],
        properties: {
          id: {
            type: 'string',
            description: 'Unique identifier: source-prefixed original ID',
            example: 'usgs-ci40917392',
          },
          source: {
            type: 'string',
            enum: ['usgs', 'nasa-eonet', 'noaa-nws', 'nasa-firms'],
            description: 'Data source identifier',
          },
          title: {
            type: 'string',
            description: 'Human-readable event title',
            example: 'M 3.2 - 10km SSE of Ridgecrest, CA',
          },
          severity: {
            type: 'string',
            enum: ['minor', 'moderate', 'major', 'critical', 'unknown'],
            description: 'Computed severity level',
          },
          coordinates: {
            type: 'object',
            properties: {
              longitude: { type: 'number', example: -117.6 },
              latitude: { type: 'number', example: 35.5 },
            },
            required: ['longitude', 'latitude'],
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'ISO 8601 timestamp of the event',
          },
          eventType: {
            type: 'string',
            description: 'Original event category / type',
            example: 'earthquake',
          },
          metadata: {
            type: 'object',
            description: 'Optional additional metadata',
            additionalProperties: true,
          },
          buildingExposure: {
            $ref: '#/components/schemas/BuildingExposure',
          },
        },
      },
      BuildingExposure: {
        type: 'object',
        description: 'Building infrastructure exposure summary from GlobalBuildingAtlas',
        properties: {
          buildingCount: {
            type: 'integer',
            description: 'Total buildings in the affected area',
            example: 12847,
          },
          avgHeight: {
            type: 'number',
            description: 'Average building height in meters',
            example: 8.2,
          },
          maxHeight: {
            type: 'number',
            description: 'Maximum building height in meters',
            example: 45.3,
          },
          totalFootprintArea: {
            type: 'number',
            description: 'Total building footprint area in square meters',
            example: 125000,
          },
          densityClass: {
            type: 'string',
            enum: ['urban', 'suburban', 'rural', 'uninhabited'],
            description: 'Urban density classification',
          },
          queryRadiusKm: {
            type: 'number',
            description: 'Search radius used in kilometers',
            example: 25,
          },
          available: {
            type: 'boolean',
            description: 'Whether building data was successfully retrieved',
          },
          error: {
            type: 'string',
            description: 'Error message if data retrieval failed',
          },
        },
      },
    },
  },
  tags: [
    {
      name: 'Events',
      description: 'Global disaster event endpoints',
    },
    {
      name: 'Buildings',
      description: 'GlobalBuildingAtlas building exposure endpoints',
    },
    {
      name: 'System',
      description: 'System health and status endpoints',
    },
  ],
};
