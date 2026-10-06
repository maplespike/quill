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
global.fetch = vi.fn()

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
    fetch.mockResolvedValueOnce({ json: async () => ({ data: { providers: [] } }) })

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
    fetch.mockResolvedValueOnce({ json: async () => ({ data: { providers: [] } }) })

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
})