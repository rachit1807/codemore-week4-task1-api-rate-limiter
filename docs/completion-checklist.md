# Submission checklist

- [x] Compare fixed window, sliding window and token bucket trade-offs.
- [x] Lightweight backend with public and API-key protected sample endpoints.
- [x] Custom rolling-window middleware with IP/key identity tracking.
- [x] X-RateLimit-Limit, Remaining and Reset; 429 and Retry-After.
- [x] Unit and HTTP integration tests, including concurrent traffic and recovery.
- [x] Dedicated design, storage, configuration and testing documentation.
- [x] README setup, usage and deployment instructions.
- [x] Captured passing test output and load test evidence with actual HTTP 429 responses.
- [x] Required src, tests and docs structure.
- [x] Additional dashboard, admin metrics, CSV export, reset countdown, OpenAPI specification, server-enforced policy and bounded storage.
- [x] Docker configuration and GitHub CI workflow prepared.
- [x] Public GitHub repository published: https://github.com/rachit1807/codemore-week4-task1-api-rate-limiter
- [x] Live HTTPS deployment: https://flowguard-rachit-api.onrender.com
- [x] Hosted key-based quotas and admin authorization verified.
- [ ] Provider-specific anonymous client IP handling: anonymous callers may share proxy quotas; API-key callers have independent configured tiers.

## Verification limits
13 tests passed locally on Node 24. Docker runtime was not available for a container build. GitHub CI will run only once the repository is published. No Redis service or distributed persistence is implemented. The in-memory implementation fully supports the assignment's in-memory option and is limited to one process. This checklist does not claim every conceivable product feature or production certification.
