# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in TerraMind Core, please report it responsibly:

1. **Do NOT** open a public issue
2. Email the maintainers directly with:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
3. We will respond within 48 hours

## Security Measures

TerraMind Core implements the following security controls:

### Transport Layer
- Helmet.js CSP headers restrict script/style/image sources
- CORS restricted to configured origins in production
- Rate limiting: 60 requests/minute per IP

### Input Validation
- Zod schema validation on all API query parameters
- Request body size limited to 100KB
- AI chat input validated for type and presence

### API Key Protection
- All API keys stored server-side in `.env` (excluded from git)
- AI chat requests proxied through backend to prevent client-side key exposure
- `.env.example` contains only placeholder values

### Graceful Degradation
- Individual data source failures do not crash the server
- AI endpoint has multi-tier fallback (API → built-in engine)
- All external requests have configurable timeouts

## Supported Versions

| Version | Supported |
|---------|-----------|
| 4.x     | ✅ Active |
| < 4.0   | ❌ EOL    |
