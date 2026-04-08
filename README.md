<div align="center">

**Stop juggling disconnected government feeds.** 
TerraMind fuses USGS Earthquakes, NASA EONET Wildfires, NOAA Weather Alerts, and NASA FIRMS Satellite Fire Detection into one real-time dashboard with an AI-powered GeoScience assistant — all free, all open source.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-3178c6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)
[![AI Powered](https://img.shields.io/badge/AI-GeoScience%20Chat-FF6F00?style=for-the-badge&logo=openai&logoColor=white)]()
[![Data Sources](https://img.shields.io/badge/Sources-4%20Gov%20APIs-blueviolet?style=for-the-badge)]()
[![Live Demo](https://img.shields.io/badge/%F0%9F%A4%97_Demo-Live_on_HuggingFace-orange?style=for-the-badge)](https://huggingface.co/spaces/masood1996/terramind-core)

---

```
  ████████╗███████╗██████╗ ██████╗  █████╗ ███╗   ███╗██╗███╗   ██╗██████╗
  ╚══██╔══╝██╔════╝██╔══██╗██╔══██╗██╔══██╗████╗ ████║██║████╗  ██║██╔══██╗
     ██║   █████╗  ██████╔╝██████╔╝███████║██╔████╔██║██║██╔██╗ ██║██║  ██║
     ██║   ██╔══╝  ██╔══██╗██╔══██╗██╔══██║██║╚██╔╝██║██║██║╚██╗██║██║  ██║
     ██║   ███████╗██║  ██║██║  ██║██║  ██║██║ ╚═╝ ██║██║██║ ╚████║██████╔╝
     ╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═════╝
                    Global Disaster Intelligence Platform
```

</div>
---

## 🎮 Try it Live
> **No installation needed — [try the live demo on Hugging Face](https://huggingface.co/spaces/masood1996/terramind-core)**
>
> Real earthquakes from USGS, real wildfires from NASA EONET, real weather alerts from NOAA — updated every 2 minutes.

---

Commercial disaster platforms charge $25k–$50k/year for what TerraMind does for free. The difference:

| Commercial Platforms | TerraMind Core |
|---------------------|----------------|
| ❌ $50k+/year for DisasterAWARE | ✅ **100% free** — MIT license |
| ❌ Proprietary, closed data | ✅ Open government APIs, full transparency |
| ❌ No satellite imagery guidance | ✅ **AI-powered GeoScience assistant** with band/index recommendations |
| ❌ Separate tools for each hazard type | ✅ **4 sources unified** in one schema |
| ❌ No real-time streaming | ✅ **SSE push** — live updates without polling |
| ❌ Complex setup, vendor lock-in | ✅ **One command** to install and run |
| ❌ Black box severity |  ✅ **Transparent** Richter/FRP/NWS classification |

---

## ⚡ One-Line Install

```bash
git clone https://github.com/masood1996-geo/terramind-core.git && cd terramind-core && node setup.js
```

The interactive setup wizard will:
1. **Guide you** through getting free API keys (with direct links)
2. **Create your `.env`** file automatically
3. **Install dependencies**
4. **Start the server** — dashboard opens at `http://localhost:4100`

> **No API keys needed to start!** USGS, NASA EONET, and NOAA work without any keys. The wizard optionally enables FIRMS fire detection and the AI assistant.

<details>
<summary><strong>Manual Setup (Advanced)</strong></summary>

```bash
git clone https://github.com/masood1996-geo/terramind-core.git
cd terramind-core
cp .env.example .env    # Edit with your FIRMS_MAP_KEY / KILOCODE_API_KEY
pnpm install
pnpm dev                # → http://localhost:4100
```

</details>

### Where to Get API Keys

| Key | Free? | Link | What It Enables |
|-----|-------|------|-----------------|
| **NASA FIRMS MAP_KEY** | ✅ Free | [Get key →](https://firms.modaps.eosdis.nasa.gov/api/area/) | Global satellite fire detection (VIIRS, 375m resolution) |
| **Kilo Gateway API Key** | ✅ Free tier | [Get key →](https://app.kilo.ai) | AI-powered GeoScience chat assistant |

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🌍 **4-Source Aggregation** | USGS earthquakes, NASA EONET wildfires/storms, NOAA weather alerts, NASA FIRMS global fire detections — merged into one feed |
| 📊 **Unified Schema** | Heterogeneous government data normalized into `GlobalDisasterEvent` with Zod validation |
| 🔴 **Real-Time SSE** | Server-Sent Events push live data updates — no polling, no WebSockets |
| 🤖 **AI GeoScience Chat** | Ask about satellite bands, spectral indices, processing workflows — powered by Kilo Gateway with built-in fallback |
| 🗺️ **Interactive Map** | Leaflet + CartoDB Dark Matter basemap with severity-colored markers |
| 📈 **Analytics Charts** | Severity distribution, source breakdown, timeline analysis (Chart.js) |
| 🎨 **Premium UI** | Dark/light theme, glassmorphism cards, micro-animations, mobile responsive |
| 🔍 **Smart Filtering** | Category dropdown, severity chips, text search, source filter — all composable |
| 🛡️ **Security-First** | Helmet CSP, rate limiting (60/min), Zod validation, server-side API key proxy |
| 🌐 **Global Coverage** | Fire detection across 11 regions (all continents), earthquakes worldwide, US weather alerts |
| 📖 **Swagger UI** | Full OpenAPI 3.0 interactive documentation at `/api/docs` |
| 🔬 **Satellite Data Reference** | Built-in help cards with recommended bands, indices, and data portal links per disaster type |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Client (Browser)                              │
│  Leaflet Map · Event Cards · Charts · AI Chat · Theme Switcher       │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTP / SSE
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Express.js API Server                            │
│                                                                      │
│  /api/events ── Merged + filtered disaster events                    │
│  /api/stream ── Server-Sent Events (real-time push)                  │
│  /api/health ── Upstream status + cache metrics                      │
│  /api/delta ─── Change detection (new/removed/escalated)             │
│  /api/ai/chat ─ GeoScience AI proxy (Kilo Gateway → fallback)       │
│  /api/docs ──── Swagger UI (OpenAPI 3.0)                             │
│                                                                      │
│  Helmet CSP · Rate Limit · Zod Validation · Response Cache           │
└────┬───────────┬───────────┬───────────┬────────────────────────────┘
     │           │           │           │
     ▼           ▼           ▼           ▼
┌─────────┐┌─────────┐┌─────────┐┌──────────────┐
│  USGS   ││  NASA   ││  NOAA   ││  NASA FIRMS  │
│Earthquake││ EONET   ││  NWS    ││  Fire Detect │
│GeoJSON  ││ v3 API  ││Alerts   ││  VIIRS/375m  │
│  Feed   ││         ││  API    ││  CSV → JSON  │
└────┬────┘└────┬────┘└────┬────┘└──────┬───────┘
     │          │          │            │
     └──────────┴──────────┴────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Normalization Pipeline                             │
│  Multi-format parsing → Severity classification → Coordinate         │
│  extraction → GlobalDisasterEvent schema → Delta engine              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📡 Data Sources

| Source | API | Data | Coverage | Key? |
|--------|-----|------|----------|------|
| 🟢 **USGS** | [Earthquake GeoJSON Feed](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php) | All earthquakes (hour/day/week) | 🌍 Global | No |
| 🟢 **NASA EONET** | [Earth Observatory Natural Event Tracker v3](https://eonet.gsfc.nasa.gov/docs/v3) | Wildfires & severe storms | 🌍 Global | No |
| 🟢 **NOAA NWS** | [National Weather Service API](https://www.weather.gov/documentation/services-web-api) | Tornado, hurricane, flood, tsunami warnings | 🇺🇸 USA | No |
| 🟡 **NASA FIRMS** | [Fire Information for Resource Management](https://firms.modaps.eosdis.nasa.gov/api/area/) | Satellite fire detections (VIIRS, 375m) | 🌍 Global (11 regions) | Free key |

---

## 🔌 API Reference

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/events` | Merged, normalized disaster events |
| `GET` | `/api/events?source=usgs` | Filter by source (`usgs`, `nasa-eonet`, `noaa-nws`, `nasa-firms`) |
| `GET` | `/api/events?severity=critical` | Filter by severity (`minor`, `moderate`, `major`, `critical`) |
| `GET` | `/api/events?timeRange=week` | Earthquake time window (`hour`, `day`, `week`) |
| `GET` | `/api/stream` | Server-Sent Events — real-time push |
| `GET` | `/api/health` | Health check + upstream source status |
| `GET` | `/api/delta` | Changes since last data sweep |
| `POST` | `/api/ai/chat` | AI GeoScience assistant |
| `GET` | `/api/docs` | Interactive Swagger UI |

<details>
<summary><strong>📋 Response Example (click to expand)</strong></summary>

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

</details>

---

## 📏 Severity Classification

<details>
<summary><strong>Earthquakes (USGS — Richter Scale)</strong></summary>

| Magnitude | Severity |
|-----------|----------|
| < 3.0 | `minor` |
| 3.0 – 4.9 | `moderate` |
| 5.0 – 6.9 | `major` |
| ≥ 7.0 | `critical` |

</details>

<details>
<summary><strong>Storms (NASA EONET — Wind Speed)</strong></summary>

| Wind Speed | Severity |
|------------|----------|
| < 34 kts | `minor` |
| 34 – 63 kts | `moderate` |
| 64 – 95 kts | `major` |
| ≥ 96 kts | `critical` |

</details>

<details>
<summary><strong>Weather Alerts (NOAA NWS)</strong></summary>

| NWS Level | Severity |
|-----------|----------|
| Minor | `minor` |
| Moderate | `moderate` |
| Severe | `major` |
| Extreme | `critical` |

</details>

<details>
<summary><strong>Fire Detection (NASA FIRMS — FRP)</strong></summary>

| FRP Range | Severity |
|-----------|----------|
| < 10 MW | `minor` |
| 10 – 50 MW | `moderate` |
| 50 – 100 MW | `major` |
| ≥ 100 MW | `critical` |

</details>

---

## 🤖 GeoScience AI Assistant

The AI assistant helps developers and geoscientists analyze disaster events using satellite imagery:

- **Event-specific recommendations** — NBR/SWIR for fires, InSAR for earthquakes, NDWI/SAR for floods
- **Pre-filled satellite data portal links** — USGS EarthExplorer, Copernicus, NASA Worldview, Google Earth Engine
- **Chat interface** — Ask about satellite bands, spectral indices, processing workflows
- **Fallback engine** — Built-in knowledge base works even without an API key

| Provider | Setup | Free? |
|----------|-------|-------|
| **Kilo Gateway** | [Get Key](https://app.kilo.ai) | ✅ Free tier available |
| **Built-in Engine** | No key needed | ✅ Always available |

> **💡 Tip:** Without a Kilo API key, the built-in GeoScience knowledge engine provides expert-level guidance on remote sensing workflows. The AI key just adds conversational flexibility.

---

## 📂 Project Structure

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
│   ├── index.html           # Single-page dashboard (dark/light themes)
│   └── index.css            # Complete design system (1000+ lines)
├── tests/
│   └── clients.test.ts      # Unit tests with mocked HTTP
├── setup.js                 # 🚀 Interactive setup wizard
├── .env.example             # Environment template (no secrets)
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## ⚙️ Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `4100` | Server listening port |
| `HOST` | No | `0.0.0.0` | Server bind address |
| `FIRMS_MAP_KEY` | No | — | NASA FIRMS API key → enables global fire detection |
| `KILOCODE_API_KEY` | No | — | Kilo Gateway key → enables AI GeoScience chat |
| `CACHE_TTL` | No | `60000` | Response cache TTL (ms) |
| `REFRESH_INTERVAL` | No | `120000` | Auto-refresh interval (ms) |

---

## 🛡️ Security

- **Helmet CSP** — Strict Content Security Policy headers
- **Rate Limiting** — 60 requests/minute per IP
- **Zod Validation** — Schema validation on all query parameters
- **Body Limit** — 100KB max request body
- **API Key Proxy** — All keys stored server-side, AI requests proxied through backend
- **CORS** — Restricted to configured origins in production
- **Graceful Shutdown** — Clean SSE disconnection on SIGTERM/SIGINT

---

## 🧪 Testing

```bash
pnpm test           # Run all tests
pnpm test:watch     # Watch mode
```

---

## 🔗 Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20+ |
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

## 🗺️ Part of the Masood Sultan AI Ecosystem

| Project | Description |
|---------|-------------|
| **[TerraMind Core](https://github.com/masood1996-geo/terramind-core)** | Global disaster intelligence platform *(this repo)* |
| **[OpenHouse Bot](https://github.com/masood1996-geo/openhouse-bot)** | AI-powered apartment hunting across 50+ portals worldwide |
| **[AI Scraper](https://github.com/masood1996-geo/ai-scraper)** | Self-learning web scraper — point at any website, get structured data |

---

<div align="center">

**Built at the intersection of geoscience and AI 🌍**

*If TerraMind helps your research or disaster response work, consider starring the repo ⭐*

MIT License · Built by [@masood1996-geo](https://github.com/masood1996-geo)

</div>
