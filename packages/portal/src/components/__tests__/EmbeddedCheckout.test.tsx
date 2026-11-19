// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
const mocks = vi.hoisted(() => ({ loadStripe: vi.fn(), createSession: vi.fn() }));
vi.mock('@stripe/stripe-js', () => ({ loadStripe: mocks.loadStripe }));
vi.mock('@stripe/react-stripe-js', () => ({ EmbeddedCheckoutProvider: () => null, EmbeddedCheckout: () => null }));
vi.mock('@/lib/embedded-checkout', () => ({
  publishableKey: () => 'pk_test_design',
  keyLookUsable: () => ({ ok: true }),
  createEmbeddedSession: mocks.createSession,
}));
import EmbeddedCheckout from '@/components/EmbeddedCheckout';

afterEach(() => { cleanup(); vi.resetAllMocks(); });
describe('Embedded checkout startup', () => {
  test('starts a business session when the page query asks for it', async () => {
    Object.defineProperty(window, 'location', {
      value: { search: '?plan=business', hostname: 'quill.maplespike.ca', protocol: 'https:' },
      configurable: true,
    });
    Object.defineProperty(window, 'MAPLESPIKE', { value: { apiKey: 'fixture-key' }, writable: true, configurable: true });
    mocks.loadStripe.mockResolvedValueOnce(null);
    mocks.createSession.mockResolvedValueOnce({ ok: true, clientSecret: 'fixture-secret' });
    render(<EmbeddedCheckout />);
    await waitFor(() => expect(mocks.createSession).toHaveBeenCalledOnce());
    expect(mocks.createSession.mock.calls[0][0].planId).toBe('business');
  });

  test('asks visitors to sign in without loading the payment SDK', async () => {
    Object.defineProperty(window, 'MAPLESPIKE', { value: { apiKey: '' }, writable: true, configurable: true });
    render(<EmbeddedCheckout />);
    expect(await screen.findByText(/Sign in first/)).toBeInTheDocument();
    expect(mocks.loadStripe).not.toHaveBeenCalled();
    expect(mocks.createSession).not.toHaveBeenCalled();
  });
  test('shows SDK load errors instead of an unhandled rejection', async () => {
    Object.defineProperty(window, 'MAPLESPIKE', { value: { apiKey: 'fixture-key' }, writable: true, configurable: true });
    mocks.loadStripe.mockRejectedValueOnce(new Error('SDK blocked'));
    mocks.createSession.mockResolvedValueOnce({ ok: true, clientSecret: 'fixture-secret' });
    render(<EmbeddedCheckout />);
    await waitFor(() => expect(screen.getByText(/Payment form could not load: SDK blocked/)).toBeInTheDocument());
    expect(mocks.createSession).toHaveBeenCalledOnce();
  });
});
