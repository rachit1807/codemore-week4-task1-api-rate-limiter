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
- [ ] Publish public GitHub repository (next user-directed phase).
- [ ] Optional live deployment and hosting-specific proxy validation (next phase).

## Verification limits
13 tests passed locally on Node 24. Docker runtime was not available for a container build. GitHub CI will run only once the repository is published. No Redis service or distributed persistence is implemented. The in-memory implementation fully supports the assignment's in-memory option and is limited to one process. This checklist does not claim every conceivable product feature or production certification.
