## ADDED Requirements

### Requirement: Quota flag gates Cloudflare writes
Every D1, KV, and R2 write reads `quota:<service>` before it writes. The value `ok` permits Cloudflare. The value `over`, a missing key, an unknown value, and a failed read use the in-cluster store and do not call Cloudflare.

#### Scenario: Flag is ok
- **WHEN** `quota:kv` is `ok` and the value is under the KV cap
- **THEN** the write goes to Cloudflare and the in-cluster store is unchanged

#### Scenario: Flag is over
- **WHEN** `quota:kv` is `over`
- **THEN** the write goes to the in-cluster store and Cloudflare is not called

#### Scenario: Flag is missing
- **WHEN** the quota key is absent
- **THEN** the write goes to the in-cluster store

#### Scenario: Flag read fails
- **WHEN** the quota read throws
- **THEN** the write goes to the in-cluster store

### Requirement: Flag cache
The process reuses a flag for the configured TTL. The default is 60 seconds. The TTL is at least 1 second and at most 300 seconds. After the TTL, the next write reads the key again.

#### Scenario: TTL expiry
- **WHEN** a flag was cached as `ok` and the TTL has elapsed and the key is now `over`
- **THEN** the next write uses the in-cluster store

### Requirement: Size caps and TTLs
A D1 row over 32 KiB, a KV value over 32 KiB, or an R2 object over 1 MiB is rejected. Neither store receives it. KV writes set `expirationTtl` between 60 seconds and 48 hours. Cached values that omit a TTL expire in 1 hour. D1 audit retention does not exceed 7 days.

#### Scenario: Size cap
- **WHEN** a KV put exceeds 32 KiB
- **THEN** the call throws and neither store changes

#### Scenario: Ephemeral TTL
- **WHEN** an in-cluster KV value is stored with a 60 second TTL and that time elapses
- **THEN** a later get returns null

### Requirement: In-cluster storage wins when Cloudflare is closed
Postgres and SQLite selection is unchanged. When a D1 binding is present and `quota:d1` is not `ok`, the request uses the in-process store. Annotation storage does not receive the D1 binding in that case.

#### Scenario: SQLite stays on the PVC
- **WHEN** `QUILL_STORAGE` is `sqlite` and a D1 binding is also present and `quota:d1` is `ok`
- **THEN** the audit write goes to SQLite and D1 is not called
