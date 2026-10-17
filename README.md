# FlowGuard — API Rate Limiter
CodeMore Week 4 Task 1. A dependency-free Node.js API with custom rate limiting and an interactive request laboratory.

## Run locally
Requires Node.js 22 or newer.

```sh
cp .env.example .env
npm start
```
Open http://127.0.0.1:3000. Set DEMO_API_KEY, PRO_API_KEY and ADMIN_TOKEN in .env to enable protected routes and metrics. Use long, independently generated values. Never commit .env. Public requests work without keys. No package installation is required.

```sh
npm test
npm run check
```

## Features
- Sliding window log (default), fixed window counter and token bucket, implemented from scratch.
- IP-based free quotas; authenticated API keys with free/pro tiers.
- Public and protected endpoints, standard task-required X-RateLimit headers, HTTP 429 and Retry-After.
- Responsive dashboard, algorithm selection, request inspector, concurrent burst testing, local activity and CSV export.
- Admin-token-protected server metrics with bounded recent history and no stored raw API keys.
- Bounded memory store, expiration cleanup, strict routes, security headers and graceful shutdown.
- Unit and HTTP integration tests, including concurrent traffic and spoofed forwarded-address checks.

## API
| Route | Access | Purpose |
|---|---|---|
| GET / | Public | Dashboard |
| GET /health | Public | Health and uptime |
| GET /api/config | Public | Non-secret runtime configuration |
| GET /api/public | Public or valid X-API-Key | Rate-limited sample |
| GET /api/protected | Valid X-API-Key | Rate-limited protected sample |
| GET /api/metrics | Authorization: Bearer ADMIN_TOKEN | Server counters and recent events |

Append `?algorithm=sliding-window`, `fixed-window` or `token-bucket` to sample requests. Quotas are independent per algorithm, endpoint and identity. POLICY_MODE=lab allows algorithm selection for teaching. Set POLICY_MODE=enforced and RATE_ALGORITHM=sliding-window before publishing to prevent client-selected algorithm switching. The dashboard automatically disables algorithm selection in enforced mode.

```sh
curl -i 'http://127.0.0.1:3000/api/public?algorithm=sliding-window'
curl -i -H "X-API-Key: $PRO_API_KEY" http://127.0.0.1:3000/api/protected
curl -H "Authorization: Bearer $ADMIN_TOKEN" http://127.0.0.1:3000/api/metrics
```
Defaults: 10 free or 30 pro accepted requests per 10 seconds. Repeated requests over quota return 429. Dashboard burst sends 20 concurrent requests; in a fresh sliding/fixed window with the free tier, 10 succeed and 10 are throttled. Token bucket refills continuously, so results depend on elapsed time.

## Submission
Source: src/server.js and src/middleware/rateLimiter.js. Tests: tests/rateLimiter.test.js. Design: docs/rate-limiting-design.md. Captured test output: evidence/test-results.txt. Refresh evidence with `npm test > evidence/test-results.txt 2>&1`.

## Deployment preparation
Use one Node process, start command `npm start`, health path `/health`, HOST=0.0.0.0 and the platform-supplied PORT. Configure secrets in hosting settings. HTTPS should terminate at the platform. This project has not been published or deployed.

Read the design document before deployment: the memory store is single-process and resets on restart. Behind a reverse proxy, socket IPs may identify the proxy; do not enable arbitrary forwarded-header trust. Implement a hosting-specific trusted-proxy policy or use authenticated API-key quotas before relying on per-user IP limits.

## Additional tools
- Admin observability panel: enter ADMIN_TOKEN to retrieve server totals and recent events. The input is cleared immediately after use.
- Live reset countdown and 10-second dashboard request timeouts.
- Download the OpenAPI specification from `/openapi.json` or the dashboard.
- `npm run load-test` runs a bounded 50-request test against its own temporary localhost server. See evidence/load-test-results.txt for captured results.
- GitHub Actions checks syntax and tests on Node 22 and 24 after upload.
- Dockerfile runs as an unprivileged user, excludes .env, enables enforced mode and includes a health check. Docker requires an installed Docker runtime; the image has not been built in this session.

```sh
docker build -t flowguard .
docker run --rm -p 3000:3000 --env-file .env -e HOST=0.0.0.0 -e POLICY_MODE=enforced flowguard
```

MAX_CLIENTS bounds the number of stored policy/identity combinations (default 10000). Duplicate free/pro key configuration is rejected at startup. Request headers and whole requests have timeouts. API-key authorization and admin metrics are verified by the test suite; metrics are deliberately not public.
