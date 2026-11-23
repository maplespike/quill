## 1. Fixtures

- [x] 1.1 Replace `mock-data.ts` with labelled synthetic records
- [x] 1.2 Serve them from `routes/mock.ts` with the production-off gate

## 2. Router

- [x] 2.1 Register `GET /v1/fixtures` and `GET /v1/fixtures/:id`
- [x] 2.2 Leave the path auth-exempt and on the Free allow list
- [x] 2.3 Add the bilingual `FIXTURES_DISABLED` code

## 3. Test

- [x] 3.1 Assert labels, the production gate, and that no live module is called
