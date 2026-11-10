// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — Onboarding Checklist Route
 *
 * GET /v1/onboarding — Returns onboarding progress for the current tenant
 *
 * Checklist items are computed from tenant state (email verified, API keys, usage).
 */
import type { RouteHandler } from '../types.js';
import { buildSuccess, jsonResponse } from '../response.js';
import { TIER_LIMITS } from '../types.js';

interface OnboardingItem {
  id: string;
  title: string;
  description: string;
  done: boolean;
  link?: string;
}

export const onboardingHandler: RouteHandler = async (_request, ctx) => {
  const { tenant, apiKeyId, db } = ctx;
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const yearMonth = now.toISOString().slice(0, 7);

  // Decision 0002: `emailVerified` is still tracked (the boolean
  // is not PII), but its display is now "passkey/Siwe registered"
  // because we no longer leak the email concept in the user
  // surface.
  const hasAuthBinding = tenant.emailVerified; // re-label: was email_verified, now means "auth bound"
  const hasApiKey = !!apiKeyId;

  const [dailyUsage, monthlyUsage] = await Promise.all([
    db.getDailyUsage(tenant.id, date),
    db.getMonthlyUsage(tenant.id, yearMonth),
  ]);
  const hasMadeCall = dailyUsage > 0 || monthlyUsage > 0;

  const items: OnboardingItem[] = [
    {
      id: 'verify-identity',
      title: 'Verify your identity',
      description: hasAuthBinding
        ? 'Identity bound to your account'
        : 'Register a passkey or sign-in-with-ethereum to bind identity',
      done: hasAuthBinding,
      link: hasAuthBinding ? undefined : '/auth',
    },
    {
      id: 'create-api-key',
      title: 'Create an API key',
      description: hasApiKey
        ? 'API key created'
        : 'Generate your first API key to authenticate requests',
      done: hasApiKey,
      link: hasApiKey ? undefined : '/dashboard#keys',
    },
    {
      id: 'make-first-call',
      title: 'Make your first API call',
      description: hasMadeCall
        ? `Made ${dailyUsage} calls today`
        : 'Use your API key with curl or the SDK',
      done: hasMadeCall,
      link: hasMadeCall ? undefined : '/docs/guide/quickstart',
    },
    {
      id: 'explore-dashboard',
      title: 'Explore the dashboard',
      description: 'See what\'s happening in Canadian government right now',
      done: false,
      link: '/dashboard',
    },
    {
      id: 'read-docs',
      title: 'Read the documentation',
      description: 'Learn about all 22 MCP tools and API endpoints',
      done: false,
      link: '/docs',
    },
    {
      id: 'set-up-billing',
      title: 'Set up billing (optional)',
      description: `Free tier: ${TIER_LIMITS.free.monthly.toLocaleString()} API calls/month`,
      done: tenant.tier !== 'free',
      link: tenant.tier !== 'free' ? undefined : '/pricing',
    },
  ];

  const doneCount = items.filter(i => i.done).length;
  const totalCount = items.length;
  const percent = Math.round((doneCount / totalCount) * 100);

  return jsonResponse(buildSuccess({
    items,
    progress: {
      done: doneCount,
      total: totalCount,
      percent,
    },
    tier: tenant.tier,
  }, ctx));
};
