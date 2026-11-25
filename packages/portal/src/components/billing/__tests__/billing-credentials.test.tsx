// @vitest-environment jsdom
/**
 * Billing islands must find the credential where the portal actually stores
 * it (`quill-api-key`, then `maplespike_token`) — window.MAPLESPIKE.apiKey is
 * empty in every shipped config. Also: the checkout-success poller resolves
 * the order id in the browser, and the dashboard billing tab is Stripe-only.
 */
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import StripeCheckoutButton from '@/components/billing/StripeCheckoutButton'
import ManageSubscriptionButton from '@/components/billing/ManageSubscriptionButton'
import CheckoutSuccessPoller, { resolveOrderId } from '@/components/billing/CheckoutSuccessPoller'
import BillingPlans from '@/components/dashboard/BillingPlans'

const fetchMock = vi.fn()
global.fetch = fetchMock as unknown as typeof fetch

const FAKE_KEY = 'quill_FAKE_tenant_key'
const FAKE_JWT = 'FAKE.jwt.token'

function setLocation(search = '') {
  Object.defineProperty(window, 'location', {
    value: { href: '', protocol: 'https:', hostname: 'quill.maplespike.ca', origin: 'https://quill.maplespike.ca', search },
    writable: true,
    configurable: true,
  })
}

function json(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }))
}

function authHeader(callIndex = 0): string | undefined {
  const init = fetchMock.mock.calls[callIndex]?.[1] as RequestInit | undefined
  return (init?.headers as Record<string, string> | undefined)?.Authorization
}

beforeEach(() => {
  fetchMock.mockReset()
  setLocation()
  window.localStorage.clear()
  window.sessionStorage.clear()
  Object.defineProperty(window, '__LANG', { value: 'en', writable: true, configurable: true })
  Object.defineProperty(window, 'MAPLESPIKE', { value: { apiKey: '' }, writable: true, configurable: true })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('StripeCheckoutButton credential', () => {
  test('uses localStorage quill-api-key when the injected key is empty', async () => {
    window.localStorage.setItem('quill-api-key', FAKE_KEY)
    fetchMock.mockReturnValueOnce(json({ success: true, data: { order_id: 'MS-ABC123', plan_id: 'pro', checkout_url: 'https://checkout.stripe.com/c/pay/cs_test_FAKE' } }))
    render(<StripeCheckoutButton planId="pro" />)
    await userEvent.click(screen.getByRole('button'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(authHeader()).toBe(`Bearer ${FAKE_KEY}`)
    expect(window.location.href).toBe('https://checkout.stripe.com/c/pay/cs_test_FAKE')
  })

  test('falls back to the maplespike_token session JWT', async () => {
    window.localStorage.setItem('maplespike_token', FAKE_JWT)
    fetchMock.mockReturnValueOnce(json({ success: true, data: { order_id: 'MS-ABC124', plan_id: 'pro', checkout_url: 'https://checkout.stripe.com/x' } }))
    render(<StripeCheckoutButton planId="pro" />)
    await userEvent.click(screen.getByRole('button'))
    expect(authHeader()).toBe(`Bearer ${FAKE_JWT}`)
  })

  test('no credential anywhere still sends the visitor to signup, without calling the API', async () => {
    render(<StripeCheckoutButton planId="business" />)
    await userEvent.click(screen.getByRole('button'))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(window.location.href).toContain('/signup?plan=business')
  })
})

describe('ManageSubscriptionButton credential', () => {
  test('reads quill-api-key (not the never-written maplespike_api_key)', async () => {
    window.localStorage.setItem('maplespike_api_key', 'WRONG_KEY_NAME')
    window.localStorage.setItem('quill-api-key', FAKE_KEY)
    fetchMock.mockReturnValueOnce(json({ success: true, data: { portal_url: 'https://billing.stripe.com/p/session/test_FAKE', expires_in_seconds: 3600 } }))
    render(<ManageSubscriptionButton />)
    await userEvent.click(screen.getByRole('button'))
    expect(authHeader()).toBe(`Bearer ${FAKE_KEY}`)
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/billing\/stripe\/portal$/)
  })

  test('the legacy maplespike_api_key alone is not treated as a credential', async () => {
    window.localStorage.setItem('maplespike_api_key', 'WRONG_KEY_NAME')
    render(<ManageSubscriptionButton />)
    await userEvent.click(screen.getByRole('button'))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByText(/API key required/i)).toBeInTheDocument()
  })
})

describe('CheckoutSuccessPoller', () => {
  test('resolveOrderId: prop, then ?order=, then sessionStorage; rejects junk', () => {
    expect(resolveOrderId('MS-PROP01')).toBe('MS-PROP01')
    setLocation('?session_id=cs_test_FAKE&order=MS-URL001')
    expect(resolveOrderId('')).toBe('MS-URL001')
    setLocation('?order=../../etc')
    window.sessionStorage.setItem('last_stripe_order_id', 'MS-SESS01')
    expect(resolveOrderId('')).toBe('MS-SESS01')
    setLocation('')
    window.sessionStorage.clear()
    expect(resolveOrderId(undefined)).toBe('')
  })

  test('static page (no prop): polls the order from ?order= with quill-api-key', async () => {
    setLocation('?session_id=cs_test_FAKE&order=MS-URL002')
    window.localStorage.setItem('quill-api-key', FAKE_KEY)
    fetchMock.mockReturnValue(json({ success: true, data: { order_id: 'MS-URL002', plan_id: 'pro', status: 'paid', amount_cents: 5000, currency: 'CAD' } }))
    render(<CheckoutSuccessPoller />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/billing\/stripe\/order\/MS-URL002$/)
    expect(authHeader()).toBe(`Bearer ${FAKE_KEY}`)
  })

  test('no order id anywhere: shows the missing-id error and never calls the API', async () => {
    window.localStorage.setItem('quill-api-key', FAKE_KEY)
    render(<CheckoutSuccessPoller />)
    await waitFor(() => expect(screen.getByText(/Missing order id/i)).toBeInTheDocument())
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('BillingPlans (dashboard billing tab)', () => {
  test('is Stripe-only: Pro/Business Stripe buttons in CAD, no crypto checkout', async () => {
    const { container } = render(<BillingPlans lang="en" />)
    expect(screen.getByRole('button', { name: 'Buy Pro' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Buy Business' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Manage subscription/i })).toBeInTheDocument()
    expect(container.textContent).toContain('$50 CAD / month')
    expect(container.textContent).toContain('$200 CAD / month')
    expect(container.textContent).toContain('50,000 credits')
    expect(container.textContent).toContain('250,000 credits')
    expect(container.textContent).not.toMatch(/crypto|wallet|transaction hash|USDC/i)
    // Mounting must not hit the legacy plans/order endpoints.
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('French copy', () => {
    const { container } = render(<BillingPlans lang="fr" />)
    expect(container.textContent).toContain('50 $ CA / mois')
    expect(screen.getByRole('button', { name: 'Acheter Pro' })).toBeInTheDocument()
  })
})
