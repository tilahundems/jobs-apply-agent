# Observability

The API exposes metrics and emits structured logs.
It does not connect to Loki, Prometheus, or Grafana; the central observability
stack collects from it.

## Logs

The API writes structured JSON logs to stdout using `pino` via `nestjs-pino`.
Production infrastructure is responsible for collecting those logs and sending
them to the central Loki instance. The application does not connect to Loki
directly.

Each request gets a correlation ID. An incoming `x-request-id` header is reused
when it is a safe token; otherwise the API generates one and returns it in the
`x-request-id` response header. Request logs include `requestId`, `method`,
`route`, `statusCode`, and `durationMs`. Authorization, cookie, password, and
token fields are redacted, and request bodies are not logged by default.

Set `LOG_LEVEL` to control verbosity (defaults to `info`). The service name and
version are derived from `apps/api/package.json`, and `environment` comes from
`NODE_ENV`.

## Metrics

The API exposes Prometheus metrics at:

```text
GET /metrics
```

The central Prometheus instance scrapes this endpoint. The following snippet
belongs to the external Prometheus server configuration and is documentation
only — it is not part of this repository:

```yaml
scrape_configs:
  - job_name: example-api
    static_configs:
      - targets:
          - app.internal:4000
```

Metrics include default Node.js runtime collectors (CPU, memory, heap, garbage
collection, event loop) plus `http_requests_total`,
`http_request_duration_seconds`, and `http_requests_in_flight`. HTTP metrics use
low-cardinality `method`, `route`, and `status_code` labels; parameterized routes
are normalized (for example `/users/:id`) and unmatched routes fall back to
`unmatched`. Restrict `/metrics` by network or reverse proxy in production.
