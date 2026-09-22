# Onboarding Psychology Audit — MapleSpike SaaS admin experience

**Date:** 2026-09-22
**Scope:** first-visit → signup → first authenticated session → first API call → dashboard (`quill.maplespike.ca`)
**Method:** live HTTP walkthrough + source inspection of the deployed revision (`57aeeb60`-era portal + api-server)
**Issue:** #731 · **Follow-ups filed:** #890, #891, #892

## Live flow evidence

Walked on 2026-09-22 (~02:30 UTC) against production:

```
GET https://quill.maplespike.ca/          -> 200
GET https://quill.maplespike.ca/signup    -> 200
GET https://quill.maplespike.ca/pricing   -> 200
GET https://quill.maplespike.ca/dashboard -> 200
GET https://api.maplespike.ca/v1/llms.txt -> 200  (free tier, no key)
GET https://api.maplespike.ca/v1/gov/search?q=health -> 402 (free tier boundary)
```

Source-verified flow (files cited at their deployed revision):

- `/signup` composition: six feature cards (modules, verified citations, MCP tools, SDKs, real-time data, OpenAPI) rendered before any "how it works" framing — `packages/portal/src/pages/signup.astro:19-60`.
- Auth methods offered by `packages/portal/src/components/SignupForm.tsx` (661 lines): passkey registration (primary), GitHub OAuth, Solana wallet signing.
- Passkey registration sequence (`SignupForm.tsx:160-214`): `register/begin` → browser credential → `register/complete` → `apiKey` returned → **`localStorage.setItem('quill-api-key', apiKey.key)`** → immediate `login/begin` + `login/complete` for a JWT.
- OAuth path repeats the silent store: `pages/auth/callback.astro:121`.
- Key consumers: `pages/api-explorer.astro:187` (prefills the field), `pages/workspace.astro:474`, `components/dashboard/AgentChat.tsx:51`.
- Dashboard markup (`pages/dashboard.astro`) renders a titled section with usage/billing panels; **no empty-state or first-run copy exists anywhere in the dashboard pages** (grep for `empty|first|welcome|getting started|no usage` returns only one billing string: `dashboard/billing.astro:124`).
- Free-tier boundary verified live: `register`/`llms`/discovery/astral/Stripe-webhook are free; data routes answer 402 (allowlist SSOT: `packages/api-server/src/feature-gates.ts`, decision #803).

## Frictions observed

1. **Silent credential mint (highest impact).** The API key — the entire payoff of signing up — is written to `localStorage` and never displayed. `SignupForm.tsx:172-177` has no UI after the store call; the user's next question ("what do I call, and with what?") has no in-flow answer. The key is only discoverable by opening the API explorer (which prefills it) or devtools. Psychologically this is a payoff-free completion: the user performed a high-effort ceremony (biometric passkey creation) and received no visible reward, which is precisely the moment trust is either banked or lost.

2. **No next step after authentication.** After registration the user is left authenticated with no "first call" moment: no copyable curl, no "your key is ready" confirmation, no link to the free-tier surface. An unfinished action with no completion cue (Zeigarnik) leaves the session dangling — the user must invent the next step, and most will not.

3. **Device-bound identity with no recovery story.** `handlePasskeyLogin` (`SignupForm.tsx:227-234`) requires a `userId` and, on a device without the credential, returns "No passkey account found on this device. Create a passkey first to get your API key." Following that instruction **mints a second account** — a silent account fork. GitHub and wallet alternatives exist, but the passkey-first framing never states the trade-off. One lost laptop therefore reads as "my account is gone", the strongest trust-destroying event in an auth experience.

4. **The 402 wall explains nothing.** A new free tenant's first data call returns 402 while the free-tier map lives only in server code and the usage endpoint (`/v1/usage`) is Business-only — so the user cannot see what is included or what they have consumed. An ambiguous failure at the first real attempt produces learned helplessness and reads as a broken product rather than a tier boundary, undermining the "free tier works" promise that was made explicitly.

5. **Marketing precedes mechanism.** `/signup` leads with six feature cards (~70 lines of markup) before any three-step "how it works". A visitor arriving from `/pricing` has already accepted the *what*; what they need at the moment of highest intent is the *how*, delivered short. Cognitive load peaks exactly where it should be lowest.

**Strengths worth preserving:** every surface answered 200 with no console-visible breakage; the fresh-device error is explicit rather than a raw server error; the entire portal is bilingual (EN/FR) at parity; free-tier auth paths (passkey, wallet, OAuth) are genuinely usable without payment.

## Recommendations

Ordered by expected trust-per-unit-effort. Each is independently shippable; the first two cover ~80% of the observed drop.

1. **Reveal the key at signup (#890).** After `register/complete` (and the OAuth callback), render a blocking reveal card: the key with a copy button, one copyable curl for a free endpoint (`/v1/llms.txt`), and one line stating the key is also stored in this browser. The data already exists at the call site; this is a UI step, not a backend change.
2. **First-call panel on the dashboard (#890, second half).** For tenants with zero recorded usage, show a single "make your first call" panel with the curl, the free-tier map, and the docs link. Reuse the `meta.usage` block already embedded in API responses.
3. **Make failure self-explanatory (#891).** Put the free-tier surface, a docs link, and the upgrade path in the 402 body, and let a tenant read its own usage (open `/v1/usage` to the key's own tenant, or always include `meta.usage`). The gate code already knows the allowlist; the failure path can therefore explain itself without new state.
4. **Publish the identity model (#892).** One docs page plus a signup-line: passkeys are device-bound; add GitHub or a wallet as a second key; how to re-link a new device; what happens to keys if a device is lost. Point the fresh-device error at the second-key path rather than only at creating another passkey.
5. **Reorder the signup page.** A compact "3 steps to your first call" strip above the feature cards, so intent converts before the feature inventory begins.
