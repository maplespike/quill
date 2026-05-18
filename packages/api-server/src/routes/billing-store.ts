/**
 * MapleSpike — In-Memory Billing Store
 *
 * Shared storage for Stripe, Crypto, and Interac billing records.
 */

export interface BillingSubscription {
  id: string;
  tenantId: string;
  planId: string;
  status: 'active' | 'inactive' | 'canceled' | 'trialing' | 'incomplete';
  provider: 'stripe' | 'crypto' | 'interac';
  providerId: string;
  createdAt: string;
  updatedAt: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
}

export interface StripeCheckoutSession {
  id: string;
  tenantId: string;
  planId: string;
  status: 'pending' | 'completed' | 'expired';
  url: string;
  amount: number;
  currency: string;
  createdAt: string;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
  status: 'received' | 'processed';
  receivedAt: string;
}

export interface CryptoPayment {
  id: string;
  tenantId: string;
  planId: string;
  currency: 'BTC' | 'ETH';
  fiatAmount: number;
  cryptoAmount: string;
  walletAddress: string;
  txHash: string | null;
  status: 'pending' | 'confirmed' | 'failed' | 'expired';
  confirmations: number;
  createdAt: string;
  confirmedAt: string | null;
}

export interface InteracTransfer {
  id: string;
  tenantId: string;
  planId: string;
  recipientEmail: string;
  reference: string;
  amount: number;
  currency: string;
  status: 'pending' | 'confirmed' | 'expired';
  securityQuestion: string;
  note: string;
  createdAt: string;
  confirmedAt: string | null;
}

class BillingStore {
  subscriptions: BillingSubscription[] = [];
  checkoutSessions: StripeCheckoutSession[] = [];
  webhookEvents: WebhookEvent[] = [];
  cryptoPayments: CryptoPayment[] = [];
  interacTransfers: InteracTransfer[] = [];
}

export const billingStore = new BillingStore();
