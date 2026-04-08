/**
 * OpenAPI 3.0 specification for the TerraMind Core API.
 */
export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'TerraMind Core API',
    description:
      'Global disaster event aggregation platform. Normalizes USGS Earthquake, NASA EONET, NOAA NWS, and NASA FIRMS data into a unified schema.',
    version: '3.0.0',
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
                    version: { type: 'string', example: '1.0.0' },
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
            enum: ['usgs', 'nasa-eonet'],
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
      name: 'System',
      description: 'System health and status endpoints',
    },
  ],
};
