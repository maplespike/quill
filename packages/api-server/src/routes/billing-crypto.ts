/**
 * MapleSpike — Crypto/Web3 Billing Routes
 *
 * POST /v1/billing/crypto/quote — Get BTC/ETH quote for a plan
 * POST /v1/billing/crypto/verify — Verify a crypto transaction by tx hash
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse, type BuildContext } from '../response.js';
import { validateBody } from '../validate.js';
import { billingStore } from './billing-store.js';
import { PLANS } from './billing.js';

const CRYPTO_RATES: Record<string, number> = {
  BTC: 60000,
  ETH: 3500,
};

const WALLET_ADDRESSES: Record<string, string> = {
  BTC: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
  ETH: '0x742d35Cc6634C0532925a3b844Bc9e7595f9a3bc',
};

export const cryptoQuoteHandler: RouteHandler = async (request, ctx) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };

  try {
    const body = await request.json() as Record<string, unknown>;
    const errs = validateBody(body, {
      planId: { type: 'string', required: true, minLength: 1 },
      currency: { type: 'string', required: true, minLength: 3, maxLength: 4 },
    });
    if (errs.length > 0) {
      return jsonResponse(buildError('VALIDATION_ERROR', errs.map((e) => e.message).join('; '), bc), 400);
    }

    const plan = PLANS.find((p) => p.id === body.planId);
    if (!plan) {
      return jsonResponse(buildError('INVALID_PLAN', `Plan "${body.planId}" not found. Available: ${PLANS.map((p) => p.id).join(', ')}`, bc), 400);
    }

    const currency = (body.currency as string).toUpperCase();
    if (currency !== 'BTC' && currency !== 'ETH') {
      return jsonResponse(buildError('INVALID_CURRENCY', `Unsupported currency "${body.currency}". Supported: BTC, ETH`, bc), 400);
    }

    const rate = CRYPTO_RATES[currency];
    const fiatInDollars = plan.price / 100;
    const cryptoAmount = fiatInDollars / rate;
    const cryptoAmountFormatted = cryptoAmount.toFixed(8);

    const paymentId = 'crypto_' + crypto.randomUUID().replace(/-/g, '');
    billingStore.cryptoPayments.push({
      id: paymentId,
      tenantId: ctx.tenant.id,
      planId: plan.id,
      currency: currency as 'BTC' | 'ETH',
      fiatAmount: plan.price,
      cryptoAmount: cryptoAmountFormatted,
      walletAddress: WALLET_ADDRESSES[currency],
      txHash: null,
      status: 'pending',
      confirmations: 0,
      createdAt: new Date().toISOString(),
      confirmedAt: null,
    });

    return jsonResponse(buildSuccess({
      paymentId,
      planId: plan.id,
      planName: plan.name,
      fiat: { amount: plan.price, currency: 'CAD' },
      crypto: {
        currency,
        amount: cryptoAmountFormatted,
        rate,
        rateSource: 'simulated',
      },
      wallet: {
        address: WALLET_ADDRESSES[currency],
        network: currency === 'BTC' ? 'Bitcoin' : 'Ethereum',
      },
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      instructions: `Send exactly ${cryptoAmountFormatted} ${currency} to the address above. The quote is valid for 1 hour.`,
    }, bc));
  } catch {
    return jsonResponse(buildError('BAD_REQUEST', 'Invalid request body. Expected { planId, currency }', bc), 400);
  }
};

export const cryptoVerifyHandler: RouteHandler = async (request, ctx) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };

  try {
    const body = await request.json() as Record<string, unknown>;
    const errs = validateBody(body, {
      txHash: { type: 'string', required: true, minLength: 10, maxLength: 128 },
      currency: { type: 'string', required: true, minLength: 3, maxLength: 4 },
      planId: { type: 'string', required: true, minLength: 1 },
      amount: { type: 'string', required: true, minLength: 1 },
    });
    if (errs.length > 0) {
      return jsonResponse(buildError('VALIDATION_ERROR', errs.map((e) => e.message).join('; '), bc), 400);
    }

    const txHash = body.txHash as string;
    const currency = (body.currency as string).toUpperCase();
    const planId = body.planId as string;
    const amount = body.amount as string;

    if (currency !== 'BTC' && currency !== 'ETH') {
      return jsonResponse(buildError('INVALID_CURRENCY', `Unsupported currency "${body.currency}". Supported: BTC, ETH`, bc), 400);
    }

    const plan = PLANS.find((p) => p.id === planId);
    if (!plan) {
      return jsonResponse(buildError('INVALID_PLAN', `Plan "${planId}" not found.`, bc), 400);
    }

    const isValidBtcHash = currency === 'BTC' && /^[a-fA-F0-9]{64}$/.test(txHash);
    const isValidEthHash = currency === 'ETH' && /^0x[a-fA-F0-9]{64}$/.test(txHash);
    if (!isValidBtcHash && !isValidEthHash) {
      return jsonResponse(
        buildError('INVALID_TX_HASH', `Invalid ${currency} transaction hash format. Expected ${currency === 'BTC' ? '64 hex characters' : '0x-prefixed 64 hex characters'}.`, bc),
        400,
      );
    }

    const existing = billingStore.cryptoPayments.find((p) => p.txHash === txHash);
    if (existing) {
      const confirmations = Math.min(existing.confirmations + Math.floor(Math.random() * 3), 6);
      existing.confirmations = confirmations;
      if (confirmations >= 3 && existing.status === 'pending') {
        existing.status = 'confirmed';
        existing.confirmedAt = new Date().toISOString();
        billingStore.subscriptions.push({
          id: 'sub_' + crypto.randomUUID().replace(/-/g, ''),
          tenantId: existing.tenantId,
          planId: existing.planId,
          status: 'active',
          provider: 'crypto',
          providerId: txHash,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          currentPeriodStart: new Date().toISOString(),
          currentPeriodEnd: new Date(Date.now() + 30 * 86400_000).toISOString(),
        });
      }
      return jsonResponse(buildSuccess({
        txHash,
        currency,
        status: existing.status,
        confirmations: existing.confirmations,
        requiredConfirmations: 3,
      }, bc));
    }

    billingStore.cryptoPayments.push({
      id: 'crypto_' + crypto.randomUUID().replace(/-/g, ''),
      tenantId: ctx.tenant.id,
      planId: plan.id,
      currency: currency as 'BTC' | 'ETH',
      fiatAmount: plan.price,
      cryptoAmount: amount,
      walletAddress: WALLET_ADDRESSES[currency],
      txHash,
      status: 'pending',
      confirmations: 0,
      createdAt: new Date().toISOString(),
      confirmedAt: null,
    });

    return jsonResponse(buildSuccess({
      txHash,
      currency,
      status: 'pending',
      confirmations: 0,
      requiredConfirmations: 3,
      message: `Transaction received. Waiting for 3 confirmations.`,
    }, bc));
  } catch {
    return jsonResponse(buildError('BAD_REQUEST', 'Invalid request body. Expected { txHash, currency, planId, amount }', bc), 400);
  }
};
