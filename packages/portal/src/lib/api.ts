const API_BASE = import.meta.env.PUBLIC_API_BASE || 'https://dev-maplespike-api.lan/v1'

export interface HealthData {
  status: string; service: string; version: string; environment: string
  tenant: { id: string; name: string; tier: string }
  usage: { daily: number; monthly: number }
}

export interface Plan { id: string; name: string; priceUsd: number; requests: number; rateLimit: number }
export interface Chain { id: string; name: string; token: string; usdc: boolean; kind: string }

export async function getHealth(): Promise<HealthData | null> {
  try { const r = await fetch(`${API_BASE}/health`); const d = await r.json(); return d.data || d } catch { return null }
}

export async function getUsage(): Promise<{ daily: number; monthly: number } | null> {
  try { const r = await fetch(`${API_BASE}/usage`); const d = await r.json(); return d.data || d } catch { return null }
}

export async function getPlans(): Promise<{ plans: Plan[]; chains: Chain[] }> {
  try { const r = await fetch(`${API_BASE}/billing/plans`); const d = await r.json(); return d.data || { plans: [], chains: [] } } catch { return { plans: [], chains: [] } }
}
