# 🌍 TerraMind Core

> **Global Disaster Intelligence Platform**
> Normalizes USGS Earthquake, NASA EONET, NOAA NWS, NASA FIRMS, and GlobalBuildingAtlas data into a unified, queryable API with building exposure analysis.

---

## Architecture

```
terramind-core/
├── src/
│   ├── clients/
│   │   ├── usgs.ts          # USGS GeoJSON earthquake feed client
│   │   ├── nasa.ts          # NASA EONET wildfire & storm client
│   │   ├── noaa.ts          # NOAA NWS severe weather alert client
│   │   ├── firms.ts         # NASA FIRMS satellite fire detection client
│   │   └── gba.ts           # GlobalBuildingAtlas WFS building exposure client
│   ├── pipeline/
│   │   ├── normalizer.ts    # Data normalization → GlobalDisasterEvent
│   │   └── delta.ts         # Change detection / diff engine
│   └── api/
│       ├── server.ts         # Express API server
│       └── swagger.ts        # OpenAPI 3.0 specification
├── public/
│   ├── index.html            # Dashboard (dark/light themes)
│   └── index.css             # Design system
├── tests/
│   └── clients.test.ts       # Unit tests with mocked Axios
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Data Sources

| Source | API | Events |
|--------|-----|--------|
| **USGS** | [Earthquake GeoJSON Feed](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php) | All earthquakes (hour/day/week) |
| **NASA EONET** | [Earth Observatory Natural Event Tracker v3](https://eonet.gsfc.nasa.gov/docs/v3) | Wildfires & severe storms |
| **NOAA NWS** | [National Weather Service API](https://www.weather.gov/documentation/services-web-api) | Tornado, hurricane, flood, tsunami warnings |
| **NASA FIRMS** | [Fire Information for Resource Management](https://firms.modaps.eosdis.nasa.gov/api/area/) | Global satellite fire detections (VIIRS, 375m) |
| **GBA** | [GlobalBuildingAtlas WFS](https://github.com/zhu-xlab/GlobalBuildingAtlas) | Building footprints, heights & exposure analysis |

## GlobalDisasterEvent Schema

```typescript
{
  id: string;           // Source-prefixed unique ID
  source: 'usgs' | 'nasa-eonet' | 'noaa-nws' | 'nasa-firms';
  title: string;        // Human-readable event title
  severity: 'minor' | 'moderate' | 'major' | 'critical' | 'unknown';
  coordinates: { longitude: number; latitude: number };
  timestamp: string;    // ISO 8601
  eventType: string;    // e.g., 'earthquake', 'wildfires'
  metadata?: Record<string, unknown>;
  buildingExposure?: {  // From GlobalBuildingAtlas
    buildingCount: number;
    avgHeight: number;
    maxHeight: number;
    totalFootprintArea: number;
    densityClass: 'urban' | 'suburban' | 'rural' | 'uninhabited';
    queryRadiusKm: number;
    available: boolean;
  };
}
```

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run tests
pnpm test
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/events` | Merged, normalized disaster events |
| `GET` | `/api/events?source=usgs` | Filter by source |
| `GET` | `/api/events?severity=critical` | Filter by severity |
| `GET` | `/api/buildings?lat=35.89&lon=-117.6` | Building exposure around coordinates |
| `GET` | `/api/buildings?lat=35.89&lon=-117.6&radius=10` | Building exposure with custom radius (km) |
| `GET` | `/api/stream` | Server-Sent Events (real-time push) |
| `GET` | `/api/delta` | Change detection since last refresh |
| `GET` | `/api/docs` | Swagger UI documentation |
| `GET` | `/api/health` | Health check |

## Building Exposure (GlobalBuildingAtlas)

TerraMind integrates [GlobalBuildingAtlas](https://github.com/zhu-xlab/GlobalBuildingAtlas) to answer: **"What infrastructure is at risk?"**

When a disaster event is detected, the dashboard can query the GBA WFS for building footprints within the affected area:

- **Building count** — total structures in the disaster zone
- **Height statistics** — average and maximum building heights
- **Density classification** — urban, suburban, rural, or uninhabited
- **Infrastructure risk** — compound assessment based on building count

> No API key required — GBA WFS is completely free (TU Munich GeoServer).

## Severity Classification

### Earthquakes (Richter Scale)
- **minor**: < 3.0
- **moderate**: 3.0 – 4.9
- **major**: 5.0 – 6.9
- **critical**: ≥ 7.0

### Storms (Wind Speed kts)
- **minor**: < 34 kts
- **moderate**: 34 – 63 kts
- **major**: 64 – 95 kts
- **critical**: ≥ 96 kts

### Fire Detection (FRP)
- **minor**: < 10 MW
- **moderate**: 10 – 50 MW
- **major**: 50 – 100 MW
- **critical**: ≥ 100 MW

## License

MIT
