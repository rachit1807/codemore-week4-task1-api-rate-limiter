# Rate limiting design

## Algorithm selection
Sliding window log is the default because the task calls for a rolling window. It stores accepted request timestamps, discards timestamps at or before now minus the window, and permits a request only if fewer than the quota remain. Rejected requests do not consume quota. It avoids the adjacent-window double burst of fixed counters. Runtime is O(limit) per request and space O(clients × limit), with a maximum configurable quota of 1000 and a store cap of 10000 client-policy combinations.

Fixed window uses aligned epoch intervals and O(1) state per client. It is efficient but can accept nearly twice the limit across adjacent interval boundaries. Token bucket stores fractional tokens and a timestamp, replenishes at limit/windowMs, and deducts one token per accepted request. It permits bursts up to capacity while enforcing the refill rate. All decisions and updates are synchronous within one Node process, making concurrent HTTP requests atomic with respect to limiter state.

## Headers and responses
X-RateLimit-Limit is capacity; X-RateLimit-Remaining is the integer number of immediately available requests after evaluation. X-RateLimit-Reset is a Unix timestamp in seconds: the oldest accepted request expiry for sliding windows, next aligned boundary for fixed windows, and full refill time on accepted bucket responses. On blocked bucket responses it is the next-token availability time. Retry-After is a rounded-up delay in seconds on 429 only. These X- headers follow the assignment's requested convention; the implementation does not claim conformance to a standardized RateLimit field specification.

## Identity and configuration
Anonymous callers share a quota by socket IP. Recognized keys receive their configured tier; unknown supplied keys are rejected. Keys are hashed into store identifiers and never included in metrics. Free and pro keys should be distinct. Sample routes have separate quotas and expose algorithm choice for experimentation. This is a laboratory, not an authentication system or DDoS protection service. Public dashboard users can choose another algorithm; production policies must not allow clients to select their enforcement algorithm.

WINDOW_MS defaults to 10000, FREE_LIMIT to 10, PRO_LIMIT to 30. Limits must be positive integers no larger than 1000, and the window must be 100–3600000 ms. Invalid configuration prevents startup. Keys and admin token are optional locally; protected routes/metrics are disabled until configured. API keys authorize sample routes only; they do not authorize metrics.

## Storage and security
Memory state is process-local, expires lazily and is swept every 30 seconds. When full, the store expires stale entries and rejects new clients with 503 instead of discarding an existing quota. Repeated denied sliding-window requests retain the client entry until a window after the last attempt. Metrics retain at most 100 events without identities or credentials. Dashboard history is limited to 100 rows in page memory and excludes API keys from exports. No secrets are written to browser persistent storage.

Forwarded IP headers are intentionally ignored because untrusted clients can spoof them. On hosted deployments a reverse proxy may make all anonymous visitors share one quota. A provider-specific trusted proxy configuration is required to use forwarded addresses safely. Use TLS, managed secret configuration, and upstream request/connection protection when publishing. Wall-clock adjustments can affect resets; a distributed implementation should use store server time.

## Validation and trade-offs
The included tests use an injected clock to exercise exact rolling-window boundaries and fractional bucket refill. HTTP integration tests send 12 simultaneous requests with a quota of 3 for each algorithm and assert exactly 3 successes and 9 rejections. They validate headers, protected routes, key tiers, unauthorized metrics access, event counts, malformed algorithm handling, methods, static delivery, health and spoofed forwarding headers. See evidence/test-results.txt for actual captured results. These are correctness tests, not a production throughput benchmark.

## Advanced features implemented
Multiple algorithms, API-key tiers, protected sample routes, admin metrics, bounded storage, cleanup, concurrent load simulation, response inspection, CSV exports, health checks, configurable policies, graceful shutdown and mobile layout are included now.

## Further production scope
Redis with atomic Lua decisions and store-server time, multi-instance integration tests, durable analytics, account-backed key issuance/rotation/revocation, route-specific server-controlled policies, trusted proxy configuration, monitoring alerts, and distributed load benchmarks remain future work. They are not implemented or represented as working features. Shared Redis storage requires an actual service and failure-mode decisions before production scaling; a mere Redis connection variable would not provide atomic distributed enforcement.

## Deployment enforcement update
POLICY_MODE=enforced fixes the algorithm to RATE_ALGORITHM. Requests attempting another algorithm receive 400 and cannot obtain a separate bucket. Lab mode remains the local default for educational comparison. The dashboard reads this mode and disables the algorithm control. Separate endpoints still have separate quotas by design.

MAX_CLIENTS is configurable, with a default of 10000. A full store returns 503. Duplicate tier keys and invalid policies prevent startup. HTTP requests have a 15-second request timeout, 10-second header timeout and 5-second keep-alive timeout. The dashboard uses 10-second fetch timeouts. These limits supplement rather than replace edge protection.

The additional tests verify policy-switch rejection, capacity failures, invalid configuration, OpenAPI delivery and HTTP quota recovery. The bounded load script records real 429 responses and latency samples; it targets only a temporary local server. Docker configuration and hosted GitHub Actions are prepared but have not been executed on their external runtimes.
