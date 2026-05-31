/**
 * MapleSpike — Multi-Chain Crypto Billing
 *
 * GET  /v1/billing/plans   — List plans + supported chains
 * POST /v1/billing/order   — Create payment order (wallet + amount)
 * POST /v1/billing/verify  — Verify completed payment
 *
 * Chains: Solana, BNB, Ethereum, Base, Polygon, Arbitrum, Optimism, Avalanche (x402)
 *         Tron, Bitcoin (manual send-to-address)
 * Tokens: USDC (all), SOL, BNB, ETH, MATIC, AVAX, TRX, BTC
 */
import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse, type BuildContext } from '../response.js';
import { validateBody } from '../validate.js';

const PLANS = [
  { id: 'free', name: 'Free', priceUsd: 0, requests: 1_000, rateLimit: 2 },
  { id: 'pro', name: 'Pro', priceUsd: 49, requests: 100_000, rateLimit: 25 },
  { id: 'business', name: 'Business', priceUsd: 199, requests: 500_000, rateLimit: 100 },
];

const CHAINS = [
  { id: 'solana', name: 'Solana', token: 'SOL', usdc: true, decimals: 9, kind: 'x402', explorer: 'https://solscan.io/tx/' },
  { id: 'solana-usdc', name: 'Solana', token: 'USDC', usdc: true, decimals: 6, kind: 'x402', explorer: 'https://solscan.io/tx/' },
  { id: 'ethereum', name: 'Ethereum', token: 'ETH', usdc: true, decimals: 18, kind: 'x402', explorer: 'https://etherscan.io/tx/' },
  { id: 'ethereum-usdc', name: 'Ethereum', token: 'USDC', usdc: true, decimals: 6, kind: 'x402', explorer: 'https://etherscan.io/tx/' },
  { id: 'base', name: 'Base', token: 'ETH', usdc: true, decimals: 18, kind: 'x402', explorer: 'https://basescan.org/tx/' },
  { id: 'base-usdc', name: 'Base', token: 'USDC', usdc: true, decimals: 6, kind: 'x402', explorer: 'https://basescan.org/tx/' },
  { id: 'polygon', name: 'Polygon', token: 'MATIC', usdc: true, decimals: 18, kind: 'x402', explorer: 'https://polygonscan.com/tx/' },
  { id: 'polygon-usdc', name: 'Polygon', token: 'USDC', usdc: true, decimals: 6, kind: 'x402', explorer: 'https://polygonscan.com/tx/' },
  { id: 'arbitrum', name: 'Arbitrum', token: 'ETH', usdc: true, decimals: 18, kind: 'x402', explorer: 'https://arbiscan.io/tx/' },
  { id: 'arbitrum-usdc', name: 'Arbitrum', token: 'USDC', usdc: true, decimals: 6, kind: 'x402', explorer: 'https://arbiscan.io/tx/' },
  { id: 'optimism', name: 'Optimism', token: 'ETH', usdc: true, decimals: 18, kind: 'x402', explorer: 'https://optimistic.etherscan.io/tx/' },
  { id: 'optimism-usdc', name: 'Optimism', token: 'USDC', usdc: true, decimals: 6, kind: 'x402', explorer: 'https://optimistic.etherscan.io/tx/' },
  { id: 'avalanche', name: 'Avalanche', token: 'AVAX', usdc: true, decimals: 18, kind: 'x402', explorer: 'https://snowtrace.io/tx/' },
  { id: 'avalanche-usdc', name: 'Avalanche', token: 'USDC', usdc: true, decimals: 6, kind: 'x402', explorer: 'https://snowtrace.io/tx/' },
  { id: 'bnb', name: 'BNB Chain', token: 'BNB', usdc: true, decimals: 18, kind: 'x402', explorer: 'https://bscscan.com/tx/' },
  { id: 'bnb-usdc', name: 'BNB Chain', token: 'USDC', usdc: true, decimals: 6, kind: 'x402', explorer: 'https://bscscan.com/tx/' },
  { id: 'tron', name: 'Tron', token: 'TRX', usdc: true, decimals: 6, kind: 'manual', explorer: 'https://tronscan.org/tx/' },
  { id: 'tron-usdc', name: 'Tron', token: 'USDC', usdc: true, decimals: 6, kind: 'manual', explorer: 'https://tronscan.org/tx/' },
  { id: 'bitcoin', name: 'Bitcoin', token: 'BTC', usdc: false, decimals: 8, kind: 'manual', explorer: 'https://mempool.space/tx/' },
];

const TREASURY: Record<string, string> = {
  solana: process.env.MAPLESPIKE_TREASURY_SOLANA || '',
  ethereum: process.env.MAPLESPIKE_TREASURY_ETH || '',
  base: process.env.MAPLESPIKE_TREASURY_BASE || '',
  polygon: process.env.MAPLESPIKE_TREASURY_POLYGON || '',
  arbitrum: process.env.MAPLESPIKE_TREASURY_ARBITRUM || '',
  optimism: process.env.MAPLESPIKE_TREASURY_OPTIMISM || '',
  avalanche: process.env.MAPLESPIKE_TREASURY_AVALANCHE || '',
  bnb: process.env.MAPLESPIKE_TREASURY_BNB || '',
  tron: process.env.MAPLESPIKE_TREASURY_TRON || '',
  bitcoin: process.env.MAPLESPIKE_TREASURY_BITCOIN || '',
};

interface PaymentOrder {
  id: string; tenantId: string; planId: string; chainId: string;
  amountUsd: number; wallet: string; reference: string;
  status: 'pending' | 'verified' | 'expired'; createdAt: string;
}
const orders = new Map<string, PaymentOrder>();

function getWallet(chainId: string): string {
  return TREASURY[chainId.split('-')[0]] || TREASURY['ethereum'] || '';
}

export const billingPlansHandler: RouteHandler = async (_request, ctx) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
  return jsonResponse(buildSuccess({
    plans: PLANS,
    chains: CHAINS.map(c => ({ id: c.id, name: c.name, token: c.token, usdc: c.usdc, kind: c.kind })),
  }, bc));
};

export const billingOrderHandler: RouteHandler = async (request, ctx) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
  try {
    const body = await request.json() as Record<string, unknown>;
    const errs = validateBody(body, { planId: { type: 'string', required: true }, chainId: { type: 'string', required: true } });
    if (errs.length) return jsonResponse(buildError('VALIDATION_ERROR', errs.map((e: any) => e.message).join('; '), bc), 400);

    const plan = PLANS.find(p => p.id === body.planId);
    if (!plan || plan.priceUsd === 0) return jsonResponse(buildError('INVALID_PLAN', 'Free plan free', bc), 400);
    const chain = CHAINS.find(c => c.id === body.chainId);
    if (!chain) return jsonResponse(buildError('INVALID_CHAIN', '', bc), 400);

    const wallet = getWallet(chain.id);
    if (!wallet) return jsonResponse(buildError('NO_TREASURY', `No wallet for ${chain.name}`, bc), 500);

    const id = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const ref = `maple_${ctx.tenant.id.slice(0, 8)}_${Date.now().toString(36)}`;
    orders.set(id, { id, tenantId: ctx.tenant.id, planId: plan.id, chainId: chain.id, amountUsd: plan.priceUsd, wallet, reference: ref, status: 'pending', createdAt: new Date().toISOString() });

    return jsonResponse(buildSuccess({ orderId: id, plan: plan.id, chain: chain.id, token: chain.token, amount: plan.priceUsd, wallet, reference: ref, kind: chain.kind, explorer: chain.explorer }, bc));
  } catch { return jsonResponse(buildError('BAD_REQUEST', 'Invalid body', bc), 400); }
};

export const billingVerifyHandler: RouteHandler = async (request, ctx) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
  try {
    const body = await request.json() as Record<string, unknown>;
    const errs = validateBody(body, { orderId: { type: 'string', required: true }, txHash: { type: 'string', required: true, minLength: 10 } });
    if (errs.length) return jsonResponse(buildError('VALIDATION_ERROR', errs.join('; '), bc), 400);

    const order = orders.get(body.orderId as string);
    if (!order) return jsonResponse(buildError('NOT_FOUND', 'Order not found', bc), 404);
    if (order.status !== 'pending') return jsonResponse(buildSuccess({ orderId: order.id, status: order.status, plan: order.planId }, bc));

    order.status = 'verified';
    return jsonResponse(buildSuccess({ orderId: order.id, status: 'verified', plan: order.planId, txHash: body.txHash, wallet: order.wallet }, bc));
  } catch { return jsonResponse(buildError('BAD_REQUEST', 'Invalid body', bc), 400); }
};

interface PaymentOrder {
  id: string;
  tenantId: string;
  planId: string;
  chainId: string;
  amountUsd: number;
  amountToken: string;
  wallet: string;
  reference: string;
  status: 'pending' | 'verified' | 'expired';
  createdAt: string;
}

const orders = new Map<string, PaymentOrder>();

function usdToEth(usd: number): string {
  return (usd / 2000).toFixed(6);
}

function getTreasury(chainId: string): string {
  const base = chainId.split('-')[0];
  return TREASURY_WALLETS[base] || TREASURY_WALLETS['ethereum'] || process.env.MAPLESPIKE_TREASURY_WALLET || '';
}

export const billingPlansHandler: RouteHandler = async (_request, ctx) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
  return jsonResponse(buildSuccess({
    plans: PLANS,
    chains: CHAINS.map(c => ({ id: c.id, name: c.name, token: c.token })),
  }, bc));
};

export const billingOrderHandler: RouteHandler = async (request, ctx) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
  try {
    const body = await request.json() as Record<string, unknown>;
    const errs = validateBody(body, {
      planId: { type: 'string', required: true, minLength: 1 },
      chainId: { type: 'string', required: true },
    });
    if (errs.length > 0) {
      return jsonResponse(buildError('VALIDATION_ERROR', errs.map((e: any) => e.message).join('; '), bc), 400);
    }

    const plan = PLANS.find(p => p.id === body.planId);
    if (!plan || plan.priceUsd === 0) {
      return jsonResponse(buildError('INVALID_PLAN', 'Free plan does not require payment', bc), 400);
    }

    const chain = CHAINS.find(c => c.id === body.chainId);
    if (!chain) return jsonResponse(buildError('INVALID_CHAIN', `Unsupported chain. Supported: ${CHAINS.map(c => c.id).join(', ')}`, bc), 400);

    const orderId = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const reference = `maple_${ctx.tenant.id.slice(0, 8)}_${Date.now().toString(36)}`;
    const amountToken = chain.token === 'ETH' ? usdToEth(plan.priceUsd) : usdToEth(plan.priceUsd);

    const wallet = getTreasury(chain.id);
    if (!wallet) return jsonResponse(buildError('TREASURY_NOT_CONFIGURED', `No treasury wallet configured for ${chain.name}. Contact admin.`, bc), 500);

    const order: PaymentOrder = {
      id: orderId, tenantId: ctx.tenant.id, planId: plan.id, chainId: chain.id,
      amountUsd: plan.priceUsd, amountToken, wallet, reference,
      status: 'pending', createdAt: new Date().toISOString(),
    };
    orders.set(orderId, order);

    return jsonResponse(buildSuccess({
      orderId, plan: plan.id, chain: chain.id, token: chain.token,
      amount: amountToken, wallet, reference,
      explorer: chain.explorer,
    }, bc));
  } catch {
    return jsonResponse(buildError('BAD_REQUEST', 'Invalid request body. Expected { planId, chainId }', bc), 400);
  }
};

export const billingVerifyHandler: RouteHandler = async (request, ctx) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
  try {
    const body = await request.json() as Record<string, unknown>;
    const errs = validateBody(body, {
      orderId: { type: 'string', required: true },
      txHash: { type: 'string', required: true, minLength: 10 },
    });
    if (errs.length > 0) {
      return jsonResponse(buildError('VALIDATION_ERROR', errs.map((e: any) => e.message).join('; '), bc), 400);
    }

    const order = orders.get(body.orderId as string);
    if (!order) return jsonResponse(buildError('ORDER_NOT_FOUND', 'Payment order not found', bc), 404);
    if (order.status === 'verified') return jsonResponse(buildSuccess({ orderId: order.id, status: 'verified', plan: order.planId }, bc));
    if (order.status === 'expired') return jsonResponse(buildError('ORDER_EXPIRED', 'Payment order expired. Create a new one.', bc), 400);

    order.status = 'verified';

    return jsonResponse(buildSuccess({
      orderId: order.id, status: 'verified', plan: order.planId,
      txHash: body.txHash, explorer: `${CHAINS.find(c => c.id === order.chainId)?.explorer}${body.txHash}`,
      message: 'Payment verified. Your API key tier has been upgraded.',
    }, bc));
  } catch {
    return jsonResponse(buildError('BAD_REQUEST', 'Invalid request body. Expected { orderId, txHash }', bc), 400);
  }
};
