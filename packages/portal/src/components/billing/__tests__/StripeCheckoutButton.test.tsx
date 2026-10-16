// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import StripeCheckoutButton from '@/components/billing/StripeCheckoutButton'

// Mock fetch
const fetchMock = vi.fn()
global.fetch = fetchMock

// Mock window.location
let locationMock = {
  href: '',
  protocol: 'https:',
  hostname: 'quill.maplespike.ca',
  origin: 'https://quill.maplespike.ca',
}
// Replace window.location with our mock
beforeEach(() => {
  vi.resetAllMocks()
  // Update the mock location's properties
  locationMock.href = ''
  locationMock.protocol = 'https:'
  locationMock.hostname = 'quill.maplespike.ca'
  locationMock.origin = 'https://quill.maplespike.ca'
  // Define window.location property
  Object.defineProperty(window, 'location', {
    value: locationMock,
    writable: true,
    configurable: true,
  })

  // Mock window.__LANG
  Object.defineProperty(window, '__LANG', {
    value: 'en',
    writable: true,
    configurable: true,
  })

  // Mock window.MAPLESPIKE
  Object.defineProperty(window, 'MAPLESPIKE', {
    value: {
      apiBase: undefined,
      apiKey: 'test_key'
    },
    writable: true,
    configurable: true,
  })

  // Mock window.sessionStorage
  window.sessionStorage = {
    length: 0,
    key: vi.fn(),
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  }
})

afterEach(() => {
  // Clean up the DOM and reset mocks
  vi.resetAllMocks()
})

describe('StripeCheckoutButton', () => {
  test('renders the explicit French route locale and keeps the signup handoff French', async () => {
    Object.defineProperty(window, 'MAPLESPIKE', { value: { apiKey: null }, writable: true, configurable: true })
    const { container } = render(<StripeCheckoutButton planId="pro" lang="fr" />)
    await userEvent.click(within(container).getByRole('button', { name: 'Acheter Pro' }))
    expect(locationMock.href).toBe('/fr/signup?plan=pro&return=/fr/pricing')
  })

  test('redirects to signup when no API key is provided', async () => {
    // Mock MAPLESPIKE with no apiKey
    Object.defineProperty(window, 'MAPLESPIKE', {
      value: {
        apiBase: undefined,
        apiKey: null
      },
      writable: true,
      configurable: true,
    })

    const { container } = render(<StripeCheckoutButton planId="pro" />)
    const button = within(container).getByRole('button', { name: /buy pro/i })
    await userEvent.click(button)

    // Expect redirect to signup page
    expect(locationMock.href).toBe('/signup?plan=pro&return=/pricing')
  })

  test('redirects to checkout URL on successful Stripe checkout', async () => {
    const mockResponse = {
      success: true,
      data: {
        order_id: 'order_123',
        plan_id: 'pro',
        checkout_url: 'https://checkout.stripe.com/pay/cs_test',
        stripe_checkout_session_id: 'cs_test',
        expires_at: Date.now() + 3600,
        amount_cents: 2000,
        currency: 'usd'
      }
    }
    fetchMock.mockResolvedValueOnce({
      json: async () => mockResponse
    })

    const { container } = render(<StripeCheckoutButton planId="pro" apiKey="test_key" />)
    const button = within(container).getByRole('button', { name: /buy pro/i })
    await userEvent.click(button)

    // Expect redirect to checkout URL
    expect(locationMock.href).toBe('https://checkout.stripe.com/pay/cs_test')
    // Expect order ID to be stored in sessionStorage
    expect(window.sessionStorage.setItem).toHaveBeenCalledWith('last_stripe_order_id', 'order_123')
    expect(window.sessionStorage.setItem).toHaveBeenCalledWith('last_stripe_plan_id', 'pro')
  })

  test('shows error message when Stripe checkout returns 402 UPGRADE_REQUIRED', async () => {
    const mockResponse = {
      success: false,
      error: {
        code: 'QUOTA_EXHAUSTED',
        message: 'Upgrade required to Pro plan'
      }
    }
    fetchMock.mockResolvedValueOnce({
      json: async () => mockResponse
    })

    const { container } = render(<StripeCheckoutButton planId="pro" apiKey="test_key" />)
    const button = within(container).getByRole('button', { name: /buy pro/i })
    await userEvent.click(button)

    // Wait for the alert to appear
    const alertElement = await screen.findByRole('alert')
    // Expect the alert to be in the document
    expect(alertElement).toBeInTheDocument()
    // Expect the alert to contain the error message (case-insensitive)
    expect(alertElement).toHaveTextContent(/upgrade required to pro plan/i)
  })
})