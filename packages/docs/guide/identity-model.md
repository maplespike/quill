---
last-reviewed: 2026-11-10
status: active
---

# Identity model: passkeys, second keys, and new devices

Quill accounts use **passkeys as the primary sign-in**. A passkey is a
credential created on one device (a laptop, phone, or hardware security key).
It is the strongest, lowest-friction option — but it is **bound to the device
that created it**, so it does not follow you to a new device on its own.

This page explains how identity works at Quill, how to add a second key, how to
use your account on a new device, and what happens to your API keys if a device
is lost.

## Passkeys are device-bound

When you create a passkey, the browser stores the private key on that device
(protected by your screen lock, Touch ID, Windows Hello, or a security key). The
server only ever holds the matching public key. That is what makes passkeys
phishing-resistant — and it is also why a passkey created on one device is not
automatically available on another.

If you open Quill on a device that has no passkey for your account, sign-in with
a passkey will report that **no passkey was found on this device**. That is
expected: it means this device has no credential yet, not that your account is
gone.

## Add a second key (recommended)

The easiest way to avoid getting locked out of a single device is to register a
second sign-in method on the same account. Quill supports more than one:

- **GitHub sign-in** — continue with GitHub from the sign-up page. Use the same
  GitHub account you used before so you land back on the same Quill account.
- **Wallet sign-in** — connect the same wallet (Ethereum or Solana) you registered
  with, and sign the challenge to prove the same key.
- **Another passkey** — on a second device that already has access, or from the
  account page, create an additional passkey tied to that device.

Any of these keeps you on the **same account and the same API keys**. Adding a
second key does not create a new account.

## Use your account on a new device

On a new device, choose one of these instead of creating a brand-new passkey:

1. **Sign in with GitHub or your wallet** — if you registered one of those as a
   second key, use it here. You are back on the same account immediately.
2. **Add a passkey for this device** — once signed in by another method, register
   a passkey on this device so future sign-ins are one tap.

> Creating a passkey on a fresh device when you already have an account, without
> signing in to that account first, starts a **new** account. It will not have
> your existing API keys or usage history. If you already have an account, sign
> in with a second key first, then add a passkey.

## What happens if a device is lost

- **Your account and API keys are not lost.** They live with the account, not the
  device. Sign in on another device with GitHub, your wallet, or another passkey.
- **The lost device's passkey cannot be used without its screen lock** or security
  key, so it is not a direct risk on its own. If you are concerned, sign in from a
  trusted device and sign out other sessions, or rotate your API key.
- **Re-link a replacement device** by signing in with a second key and registering
  a new passkey on it, as described above.

## Related

- [Authentication](./authentication.md) — the API-facing auth methods (API keys, JWT, OAuth, passkeys, wallets).
- [Quickstart](./quickstart.md) — make your first authenticated request.
- [Billing & Limits](./billing.md) — what the free tier includes.
