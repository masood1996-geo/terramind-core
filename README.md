<p align="center">
  <h1 align="center">🌍 TerraMind Core</h1>
  <p align="center"><strong>Global Disaster Intelligence Platform</strong></p>
  <p align="center">
    Real-time aggregation of USGS Earthquakes · NASA EONET Wildfires & Storms · NOAA Weather Alerts · NASA FIRMS Fire Detection
  </p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-5.7+-3178c6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Node.js-22+-339933?logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/License-MIT-blue" alt="MIT License" />
  <img src="https://img.shields.io/badge/Data-4%20Sources-success" alt="4 Data Sources" />
</p>

---

## What Is TerraMind?

TerraMind Core is an open-source disaster intelligence platform that aggregates, normalizes, and visualizes natural disaster events from **four authoritative government data sources** through a unified REST API and interactive web dashboard.

Unlike commercial alternatives (DisasterAWARE at $50k+/year, RiskPulse at $25k+/year), TerraMind provides professional-grade disaster intelligence at **zero cost**, powered entirely by free government APIs.

### Key Features

- **🔗 Multi-Source Aggregation** — USGS earthquakes, NASA EONET wildfires/storms, NOAA NWS severe weather, and NASA FIRMS satellite fire detections in one unified API
- **📊 Unified Schema** — Heterogeneous data normalized into a consistent `GlobalDisasterEvent` format with Zod validation
- **🔴 Real-Time Streaming** — Server-Sent Events (SSE) push live updates without polling
- **🤖 AI GeoScience Assistant** — Chat interface (via Kilo Gateway) that guides satellite data analysis with event-specific recommendations
- **🗺️ Interactive Dashboard** — Premium dark/light theme with Leaflet map, severity filtering, category filtering, and event detail modals
- **🔒 Security-First** — Helmet CSP, rate limiting (60 req/min), Zod input validation, backend-proxied AI
- **🌐 Global Coverage** — Fire detections from 11 regions covering all continents, earthquakes worldwide, US weather alerts

---

## Architecture

```
terramind-core/
├── src/
│   ├── clients/
│   │   ├── usgs.ts          # USGS GeoJSON earthquake feed client
│   │   ├── nasa.ts          # NASA EONET wildfire & storm client
│   │   ├── noaa.ts          # NOAA NWS severe weather alert client
│   │   └── firms.ts         # NASA FIRMS satellite fire detection (global)
│   ├── pipeline/
│   │   ├── normalizer.ts    # Multi-source → GlobalDisasterEvent schema
│   │   └── delta.ts         # Change detection / diff engine
│   └── api/
│       ├── server.ts         # Express API server (560 lines)
│       └── swagger.ts        # OpenAPI 3.0 specification
├── public/
│   ├── index.html           # Single-page dashboard
│   └── index.css            # Complete design system (dark/light themes)
├── tests/
│   └── clients.test.ts      # Unit tests with mocked HTTP
├── .env.example             # Environment template (no secrets)
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## Data Sources

| Source | API | Data | Coverage |
|--------|-----|------|----------|
| **USGS** | [Earthquake GeoJSON Feed](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php) | All earthquakes (hour/day/week) | 🌍 Global |
| **NASA EONET** | [Earth Observatory Natural Event Tracker v3](https://eonet.gsfc.nasa.gov/docs/v3) | Wildfires & severe storms | 🌍 Global |
| **NOAA NWS** | [National Weather Service API](https://www.weather.gov/documentation/services-web-api) | Tornado, hurricane, flood, tsunami warnings | 🇺🇸 United States |
| **NASA FIRMS** | [Fire Information for Resource Management](https://firms.modaps.eosdis.nasa.gov/api/area/) | Satellite fire detections (VIIRS, 375m) | 🌍 Global (11 regions) |

> **Note:** USGS, NASA EONET, and NOAA require **no API keys**. NASA FIRMS requires a free MAP_KEY (get one at the link above).

---

## Quick Start

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/terramind-core.git
cd terramind-core

# Install dependencies
pnpm install

# Configure environment (optional — works without keys)
cp .env.example .env
# Edit .env with your FIRMS_MAP_KEY and/or KILOCODE_API_KEY

# Start development server
pnpm dev

# Open dashboard
# → http://localhost:4100

# Run tests
pnpm test
```

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/events` | Merged, normalized disaster events from all sources |
| `GET` | `/api/events?source=usgs` | Filter by source (`usgs`, `nasa-eonet`, `noaa-nws`, `nasa-firms`) |
| `GET` | `/api/events?severity=critical` | Filter by severity (`minor`, `moderate`, `major`, `critical`) |
| `GET` | `/api/events?timeRange=week` | Earthquake time window (`hour`, `day`, `week`) |
| `GET` | `/api/stream` | Server-Sent Events — real-time push updates |
| `GET` | `/api/health` | Health check + upstream source status |
| `GET` | `/api/delta` | Changes since last data sweep |
| `POST` | `/api/ai/chat` | AI GeoScience assistant (message + eventContext) |
| `GET` | `/api/docs` | Interactive Swagger UI documentation |

### Response Example

```json
{
  "success": true,
  "count": 42,
  "timestamp": "2026-04-08T22:00:00.000Z",
  "sources": {
    "usgs": { "status": "ok", "count": 15 },
    "nasa": { "status": "ok", "count": 3 },
    "noaa": { "status": "ok", "count": 12 },
    "firms": { "status": "ok", "count": 12 }
  },
  "events": [
    {
      "id": "usgs-ci40917392",
      "source": "usgs",
      "title": "M 5.6 - 45km NNE of Ridgecrest, CA",
      "severity": "major",
      "coordinates": { "longitude": -117.602, "latitude": 35.891 },
      "timestamp": "2026-04-08T16:00:00.000Z",
      "eventType": "earthquake",
      "metadata": {
        "magnitude": 5.6,
        "magType": "mw",
        "depth": 8.5,
        "tsunami": 0,
        "sig": 499
      }
    }
  ]
}
```

---

## GlobalDisasterEvent Schema

```typescript
{
  id: string;                    // Source-prefixed unique ID (e.g., "usgs-ci40917392")
  source: 'usgs' | 'nasa-eonet' | 'noaa-nws' | 'nasa-firms';
  title: string;                 // Human-readable event title
  severity: 'minor' | 'moderate' | 'major' | 'critical' | 'unknown';
  coordinates: {
    longitude: number;
    latitude: number;
  };
  timestamp: string;             // ISO 8601
  eventType: string;             // e.g., 'earthquake', 'fire', 'Tornado Warning'
  metadata?: Record<string, unknown>;  // Source-specific fields
}
```

---

## Severity Classification

### Earthquakes (USGS — Richter Scale)
| Magnitude | Severity |
|-----------|----------|
| < 3.0 | `minor` |
| 3.0 – 4.9 | `moderate` |
| 5.0 – 6.9 | `major` |
| ≥ 7.0 | `critical` |

### Storms (NASA EONET — Wind Speed)
| Wind Speed | Severity |
|------------|----------|
| < 34 kts | `minor` |
| 34 – 63 kts | `moderate` |
| 64 – 95 kts | `major` |
| ≥ 96 kts | `critical` |

### Weather Alerts (NOAA NWS)
| NWS Level | Severity |
|-----------|----------|
| Minor | `minor` |
| Moderate | `moderate` |
| Severe | `major` |
| Extreme | `critical` |

### Fire Detection (NASA FIRMS — FRP in MW)
| FRP Range | Severity |
|-----------|----------|
| < 10 MW | `minor` |
| 10 – 50 MW | `moderate` |
| 50 – 100 MW | `major` |
| ≥ 100 MW | `critical` |

---

## Dashboard Features

- **Interactive Map** — Leaflet with CartoDB Dark Matter basemap, severity-colored markers
- **Event Cards / Table View** — Switchable layouts with full event details
- **Analytics Charts** — Severity distribution, source breakdown, timeline (Chart.js)
- **Severity Filtering** — Quick-filter chips (Critical, Major, Moderate, Minor)
- **Category Dropdown** — Filter by disaster type (Earthquake, Fire, Storm, Flood, etc.)
- **Search** — Real-time text search across event titles
- **Dark / Light Theme** — Premium design with localStorage persistence
- **Event Detail Modal** — Two tabs: Overview + GeoScience satellite data analysis
- **Help Section** — Satellite data reference cards + AI chat for analysis guidance

---

## GeoScience AI Assistant

The AI assistant helps developers and geoscientists analyze disaster events using satellite imagery:

- **Event-specific recommendations** — NBR/SWIR for fires, InSAR for earthquakes, NDWI/SAR for floods
- **Pre-filled satellite data portal links** — USGS EarthExplorer, Copernicus, NASA Worldview, Google Earth Engine
- **Chat interface** — Ask questions about satellite bands, spectral indices, processing workflows
- **Fallback engine** — Built-in knowledge base works even without API key

> **AI Backend:** [Kilo Gateway](https://kilocode.ai) (optional, free tier available). Without an API key, the built-in GeoScience knowledge engine provides expert-level guidance.

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `4100` | Server listening port |
| `HOST` | No | `0.0.0.0` | Server bind address |
| `FIRMS_MAP_KEY` | No* | (none) | NASA FIRMS API key — enables global fire detection |
| `KILOCODE_API_KEY` | No* | (none) | Kilo Gateway JWT — enables AI assistant |
| `CACHE_TTL` | No | `60000` | Response cache TTL in ms |
| `REFRESH_INTERVAL` | No | `120000` | Auto-refresh interval in ms |

> *The platform works without these keys — USGS, NASA EONET, and NOAA NWS require no API keys.

---

## Security

- **Helmet CSP** — Strict Content Security Policy headers
- **Rate Limiting** — 60 requests/minute per IP
- **Input Validation** — Zod schema validation on all query parameters
- **Body Size Limit** — 100KB max request body
- **API Key Protection** — All keys stored server-side, AI requests proxied through backend
- **CORS** — Restricted to configured origins in production
- **Graceful Shutdown** — Clean SSE disconnection on SIGTERM/SIGINT

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 22+ |
| Language | TypeScript (strict mode) |
| HTTP | Express.js 4.x |
| Validation | Zod 3.x |
| Security | Helmet + express-rate-limit |
| Frontend | Vanilla HTML/CSS/JS (zero framework deps) |
| Mapping | Leaflet.js 1.9 + CartoDB basemaps |
| Charts | Chart.js 4.x |
| AI | Kilo Gateway (OpenAI-compatible) |
| Testing | Vitest + axios-mock-adapter |
| API Docs | Swagger UI (OpenAPI 3.0) |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[MIT](LICENSE) — free for commercial and research use.
