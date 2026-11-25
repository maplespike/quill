// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
const mocks = vi.hoisted(() => ({
  loadStripe: vi.fn(),
  createSession: vi.fn(),
  resolveCredential: vi.fn(),
}));
vi.mock('@stripe/stripe-js', () => ({ loadStripe: mocks.loadStripe }));
vi.mock('@stripe/react-stripe-js', () => ({ EmbeddedCheckoutProvider: () => null, EmbeddedCheckout: () => null }));
vi.mock('@/lib/embedded-checkout', () => ({
  publishableKey: () => 'pk_test_design',
  // The component resolves the key through resolvePublishableKey; the mock
  // omitted it, so this suite was red before this change.
  resolvePublishableKey: () => 'pk_test_design',
  keyLookUsable: () => ({ ok: true }),
  createEmbeddedSession: mocks.createSession,
  resolveCredential: mocks.resolveCredential,
}));
import EmbeddedCheckout from '@/components/EmbeddedCheckout';

afterEach(() => { cleanup(); vi.resetAllMocks(); });
describe('Embedded checkout startup', () => {
  test('asks visitors to sign in without loading the payment SDK', async () => {
    Object.defineProperty(window, 'MAPLESPIKE', { value: { apiKey: '' }, writable: true, configurable: true });
    mocks.resolveCredential.mockReturnValue('');
    render(<EmbeddedCheckout />);
    expect(await screen.findByText(/Sign in first/)).toBeInTheDocument();
    expect(mocks.loadStripe).not.toHaveBeenCalled();
    expect(mocks.createSession).not.toHaveBeenCalled();
  });
  test('shows SDK load errors instead of an unhandled rejection', async () => {
    Object.defineProperty(window, 'MAPLESPIKE', { value: { apiKey: 'fixture-key' }, writable: true, configurable: true });
    mocks.resolveCredential.mockReturnValue('fixture-key');
    mocks.loadStripe.mockRejectedValueOnce(new Error('SDK blocked'));
    mocks.createSession.mockResolvedValueOnce({ ok: true, clientSecret: 'fixture-secret' });
    render(<EmbeddedCheckout />);
    await waitFor(() => expect(screen.getByText(/Payment form could not load: SDK blocked/)).toBeInTheDocument());
    expect(mocks.createSession).toHaveBeenCalledOnce();
  });
  test('a credential read from storage starts checkout (the signed-in path)', async () => {
    Object.defineProperty(window, 'MAPLESPIKE', { value: { apiKey: '' }, writable: true, configurable: true });
    mocks.resolveCredential.mockReturnValue('quill_from_local_storage');
    mocks.loadStripe.mockResolvedValueOnce({});
    mocks.createSession.mockResolvedValueOnce({ ok: true, clientSecret: 'cs_secret' });
    render(<EmbeddedCheckout />);
    await waitFor(() => expect(mocks.createSession).toHaveBeenCalledOnce());
    expect(mocks.createSession.mock.calls[0][0]).toMatchObject({ apiKey: 'quill_from_local_storage' });
    expect(screen.queryByText(/Sign in first/)).not.toBeInTheDocument();
  });
});
