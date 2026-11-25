## ADDED Requirements

### Requirement: Cache hits carry the same edge headers as a miss

The Node listener MUST apply the same CORS headers and the same security headers on a Redis cache hit as on a cache miss for the same request origin.

#### Scenario: Second GET /v1/health is a cache hit

- **WHEN** a client sends `GET /v1/health` twice with `Origin: https://quill.maplespike.ca` and the second response is served from the response cache
- **THEN** both responses are 200
- **AND** the second response has `X-Cache-Status: HIT`
- **AND** the CORS headers and the security headers are identical on both responses
- **AND** `Access-Control-Allow-Origin` is `https://quill.maplespike.ca`

#### Scenario: A cache hit does not reuse another origin

- **WHEN** a cached `GET /v1/health` is requested with an origin that is not on the allow list
- **THEN** `Access-Control-Allow-Origin` is `null`
- **AND** the security headers still match a hit for an allowed origin

### Requirement: Early returns use the same helper

A rate-limit response, a listener error, an OPTIONS preflight, and the public `/metrics` rejection MUST carry the CORS and security headers.

#### Scenario: Rate limit

- **WHEN** the listener rejects a request with 429
- **THEN** the CORS headers and the security headers match a successful response for the same origin
- **AND** `Retry-After` is present

#### Scenario: Server error

- **WHEN** the listener catches an error before it writes a response
- **THEN** the response is 500
- **AND** the response includes the CORS and security headers

#### Scenario: Preflight

- **WHEN** a client sends `OPTIONS /v1/health` with an allowed origin
- **THEN** the response is 204
- **AND** the response includes the CORS headers, `Access-Control-Max-Age`, and the security headers
