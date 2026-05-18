/**
 * MapleSpike — Onboarding Checklist Route
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

  const emailVerified = tenant.emailVerified;
  const hasApiKey = !!apiKeyId;

  const [dailyUsage, monthlyUsage] = await Promise.all([
    db.getDailyUsage(tenant.id, date),
    db.getMonthlyUsage(tenant.id, yearMonth),
  ]);
  const hasMadeCall = dailyUsage > 0 || monthlyUsage > 0;

  const items: OnboardingItem[] = [
    {
      id: 'verify-email',
      title: 'Verify your email',
      description: emailVerified
        ? 'Email verified'
        : 'Check your inbox for the verification link',
      done: emailVerified,
      link: emailVerified ? undefined : '#',
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
