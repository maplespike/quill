export interface DashboardConfig {
  apiBase: string
  apiKey: string
  environment: 'dev' | 'prod'
}

export function loadConfig(): DashboardConfig {
  if (typeof window !== 'undefined' && (window as any).MAPLESPIKE) {
    const c = (window as any).MAPLESPIKE
    return {
      apiBase: c.apiBase || process.env.NEXT_PUBLIC_API_BASE || 'https://dev-maplespike-api.lan/v1',
      apiKey: c.apiKey || '',
      environment: c.environment || 'dev',
    }
  }
  return {
    apiBase: process.env.NEXT_PUBLIC_API_BASE || 'https://dev-maplespike-api.lan/v1',
    apiKey: '',
    environment: 'dev',
  }
}
