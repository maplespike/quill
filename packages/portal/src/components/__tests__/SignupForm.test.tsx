// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import SignupForm from '@/components/SignupForm'

// Mock @simplewebauthn/browser
vi.mock('@simplewebauthn/browser', () => {
  const actual = vi.importActual('@simplewebauthn/browser')
  return {
    ...actual,
    browserSupportsWebAuthn: vi.fn().mockReturnValue(true),
    startRegistration: vi.fn(),
    startAuthentication: vi.fn()
  }
})

// Import the mocked functions
import { browserSupportsWebAuthn, startRegistration, startAuthentication } from '@simplewebauthn/browser'

// Mock bs58.encode
vi.mock('bs58', () => ({
  encode: (input: Uint8Array) => 'test-signature'
}))

// Mock the fetch API
const fetchMock = vi.fn()
global.fetch = fetchMock

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString()
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    })
  }
})()
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString()
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    })
  }
})()
Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock })

// Mock window.MAPLESPIKE
Object.defineProperty(window, 'MAPLESPIKE', {
  value: {
    apiBase: undefined,
    apiKey: undefined
  },
  writable: true
})

// Mock window.ethereum for Web3
const ethereumMock = {
  request: vi.fn(),
  on: vi.fn()
}
Object.defineProperty(window, 'ethereum', {
  value: ethereumMock,
  writable: true
})

// Mock window.solana for Solana
const solanaMock = {
  connect: vi.fn(),
  signMessage: vi.fn()
}
Object.defineProperty(window, 'solana', {
  value: solanaMock,
  writable: true
})

afterEach(() => {
  cleanup()
})

describe('SignupForm', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    localStorageMock.clear()
    sessionStorageMock.clear()
    // Default mock implementations
    vi.mocked(browserSupportsWebAuthn).mockReturnValue(true)
    vi.mocked(startRegistration).mockResolvedValueOnce({} as any)
    vi.mocked(startAuthentication).mockResolvedValueOnce({} as any)
  })

  test('renders sign up text', async () => {
    // Mock providers endpoint to return empty array (so loading finishes)
    fetchMock.mockResolvedValueOnce({ json: async () => ({ data: { providers: [] } }) })

    render(<SignupForm />)

    // Wait for loading text to disappear
    await waitFor(() => {
      return !screen.queryByText(/loading sign-in options/i)
    })

    // Expect the sign up text
    expect(screen.getByText(/sign up/i)).toBeInTheDocument()
  })

  test('displays passkey registration option when WebAuthn is supported', async () => {
    // Mock providers endpoint to return empty array (so loading finishes)
    fetchMock.mockResolvedValueOnce({ json: async () => ({ data: { providers: [] } }) })

    render(<SignupForm />)

    // Wait for loading text to disappear
    await waitFor(() => {
      return !screen.queryByText(/loading sign-in options/i)
    })

    // Expect the passkey register button to be present
    // Using getAllByText and taking the first match since there are two elements
    // with similar text ("Create passkey" and "Sign in with passkey") but we want
    // the one that starts with "Create"
    const passkeyButtons = screen.getAllByText(/create passkey/i)
    expect(passkeyButtons.length).toBeGreaterThan(0)
    const passkeyButton = passkeyButtons[0]
    expect(passkeyButton).toBeInTheDocument()
  })

  test('shows the full API key after a successful passkey registration', async () => {
    const key = 'qk_live_reveal_test_key_0123456789abcdef'
    const user = userEvent.setup()
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/providers')) {
        return { json: async () => ({ data: { providers: [] } }) } as Response
      }
      if (url.includes('register/begin')) {
        return { json: async () => ({ success: true, data: { options: {}, registrationId: 'reg-1' } }) } as Response
      }
      if (url.includes('register/complete')) {
        return { json: async () => ({ success: true, data: { apiKey: { key } } }) } as Response
      }
      if (url.includes('login/begin')) {
        return { json: async () => ({ success: false, error: { message: 'skip login' } }) } as Response
      }
      throw new Error(`unexpected fetch ${url}`)
    })
    vi.mocked(startRegistration).mockResolvedValue({} as any)

    render(<SignupForm />)

    const create = await screen.findByRole('button', { name: /create passkey/i })
    await user.click(create)

    const shown = await screen.findByTestId('api-key-value')
    expect(shown).toHaveTextContent(key)
    expect(shown.textContent).not.toContain('...')
    expect(screen.getByText(/stored in this browser/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute('href', '/dashboard')
    expect(screen.getByText(/\/v1\/llms\.txt/)).toBeInTheDocument()
    expect(localStorageMock.setItem).toHaveBeenCalledWith('quill-api-key', key)
  })

  test('fresh-device passkey sign-in points at the second-key path (#892)', async () => {
    // No providers, no stored auth state → this is a fresh device for the user.
    fetchMock.mockResolvedValueOnce({ json: async () => ({ data: { providers: [] } }) })
    const user = userEvent.setup()

    render(<SignupForm />)

    await waitFor(() => {
      return !screen.queryByText(/loading sign-in options/i)
    })

    await user.click(screen.getByRole('button', { name: /sign in with passkey/i }))

    // The copy must explain passkeys are device-bound and offer GitHub/wallet
    // as the way back onto an existing account. Reverting the copy fails here.
    expect(await screen.findByText(/passkeys are stored on the device/i)).toBeInTheDocument()
    expect(screen.getByText(/sign in with GitHub or a wallet/i)).toBeInTheDocument()
    expect(screen.getByText(/creating a passkey instead starts a new account/i)).toBeInTheDocument()

    // A link to the identity-model docs page must be present.
    const docLink = screen.getByRole('link', { name: /account identity and device linking/i })
    expect(docLink).toHaveAttribute('href', '/docs/guide/identity-model.html')
  })
})