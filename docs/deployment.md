# Deployment

The web app runs at `http://localhost:3000` and proxies `/api` to the API during development. In production, serve `apps/web/dist` with an `index.html` fallback. Proxy `/api` to the API, or set `VITE_API_URL` to the public API origin when building the web app and set `WEB_ORIGIN` to the web origin in the API environment.

## Rate limiting

Nest API routes allow 100 requests per minute per client IP and endpoint, then return HTTP 429 with `Retry-After`. Health and metrics probes are exempt. Better Auth applies its own rate limits to `/api/v1/auth` in every environment, including development.

Both limiters use in-memory storage, so each API instance tracks its own limits; use shared storage or an edge rate limiter when running multiple instances. The API uses Express's direct client IP by default. Configure a trusted proxy before relying on per-client limits behind a reverse proxy.

## Observability

See [observability](observability.md) for logs and metrics.
