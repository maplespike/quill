import { getToken, clearToken } from './auth'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://dev-maplespike-api.lan/v1'

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: { code: string; message: string }
}

async function fetchApi<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const token = typeof window !== 'undefined' ? getToken() : null
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...options?.headers as Record<string, string> }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    })
    if (res.status === 401) {
      clearToken()
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
      return { success: false, error: { code: 'UNAUTHORIZED', message: 'Token expired or invalid' } }
    }
    const json = await res.json()
    return json as ApiResponse<T>
  } catch {
    return { success: false, error: { code: 'NETWORK_ERROR', message: 'API unreachable' } }
  }
}

export interface HealthData {
  status: string
  service: string
  version: string
  environment: string
  tenant: { id: string; name: string; tier: string }
  usage: { daily: number; monthly: number }
}

export interface GovSearchResult {
  query: string
  results: Array<{ title: string; source: string; url?: string }>
  totalCount: number
}

export interface ApiKey {
  id: string
  keyPrefix: string
  name: string
  createdAt: string
  expiresAt: string
  isActive: boolean
}

export interface Brief {
  id: string
  title: string
  summary: string
  sections: Array<{ title: string; content: string; signalTypes?: string[] }>
  entityIds: string[]
  confidence: number
  generatedAt: string
  expiresAt: string
}

export interface GraphNode {
  id: string
  type: string
  label: string
  properties: Record<string, unknown>
}

export interface GraphEdge {
  id: string
  source_node: string
  target_node: string
  type: string
  weight: number
  source_ref: string
}

export interface Entity {
  id: string
  canonicalName: string
  type: string
  confidence: number
  aliases: Array<{ name: string; source: string }>
  metadata: Record<string, unknown>
}

export interface IntelligenceThread {
  id: string
  title: string
  description: string
  signalType: string
  confidence: number
  nodes: string[]
  sources: string[]
  createdAt: string
}

export function getHealth() {
  return fetchApi<HealthData>('/health')
}

export function searchGov(query: string, limit = 10) {
  return fetchApi<GovSearchResult>(`/gov/search?query=${encodeURIComponent(query)}&limit=${limit}`)
}

export function getUsage() {
  return fetchApi<{ daily: number; monthly: number; tier: string }>('/usage')
}

export function listKeys() {
  return fetchApi<ApiKey[]>('/keys')
}

export function createKey(name: string) {
  return fetchApi<ApiKey>('/keys', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export function deleteKey(id: string) {
  return fetchApi<never>(`/keys/${id}`, { method: 'DELETE' })
}

export function getSignals() {
  return fetchApi<IntelligenceThread[]>('/signals')
}

export function getGraph() {
  return fetchApi<{ nodes: GraphNode[]; edges: GraphEdge[]; nodeCount: number; edgeCount: number }>('/graph')
}

export function getBriefs() {
  return fetchApi<{ briefs: Brief[] }>('/briefs')
}

export function getEntities() {
  return fetchApi<{ entities: Entity[]; links: unknown[]; totalEntities: number }>('/entities')
}

export function getPlans() {
  return fetchApi<Array<{ id: string; name: string; price: number; requests: number }>>('/billing/plans')
}

