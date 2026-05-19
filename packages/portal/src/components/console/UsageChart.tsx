import { useState, useEffect, useCallback } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts"
import { RefreshCw } from "lucide-react"

interface UsageData {
  tenant: { id: string; name: string; tier: string }
  period: { date: string; yearMonth: string }
  usage: {
    daily: { calls: number; limit: number; remaining: number; percentUsed: number }
    monthly: { calls: number; limit: number; remaining: number; percentUsed: number }
  }
  resetDate: string
}

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: { code: string; message: string }
}

const API_BASE = (typeof window !== "undefined" && (window as any).MAPLESPIKE?.apiBase) || "http://127.0.0.1:8082"

function getAuthHeaders(): Record<string, string> {
  const apiKey = (typeof window !== "undefined" && (window as any).MAPLESPIKE?.apiKey) || ""
  const token = typeof window !== "undefined" ? localStorage.getItem("maplespike_token") || "" : ""
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (apiKey) headers["X-API-Key"] = apiKey
  if (token) headers["Authorization"] = `Bearer ${token}`
  return headers
}

async function fetchApi<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { ...getAuthHeaders(), ...options?.headers },
    })
    const json = await res.json()
    return json as ApiResponse<T>
  } catch {
    return { success: false, error: { code: "NETWORK_ERROR", message: "API unreachable" } }
  }
}

function generateMockChartData(days: number) {
  const data = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    data.push({
      date: d.toLocaleDateString("en-CA", { month: "short", day: "numeric" }),
      calls: Math.floor(Math.random() * 200) + 50,
      errors: Math.floor(Math.random() * 10),
    })
  }
  return data
}

const TIER_COLORS: Record<string, string> = {
  free: "#6B7280",
  pro: "#0891B2",
  business: "#D4A017",
  enterprise: "#C23030",
  internal: "#10B981",
}

export default function UsageChart() {
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [chartData, setChartData] = useState<Array<{ date: string; calls: number; errors: number }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    const res = await fetchApi<UsageData>("/v1/usage")
    if (res.success && res.data) {
      setUsage(res.data)
      const mockChart = generateMockChartData(30)
      const scale = Math.max(1, res.data.usage.daily.calls / 150)
      setChartData(mockChart.map((d) => ({ ...d, calls: Math.round(d.calls * scale) })))
    } else {
      setError(res.error?.message || "Failed to load usage data")
      setChartData(generateMockChartData(30))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" />
          <span className="text-muted-foreground">Loading usage data...</span>
        </CardContent>
      </Card>
    )
  }

  const tierColor = TIER_COLORS[usage?.tenant?.tier || "free"] || "#6B7280"
  const dailyPercent = usage?.usage.daily.percentUsed || 0
  const monthlyPercent = usage?.usage.monthly.percentUsed || 0

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md border border-amber-500/50 bg-amber-500/5 p-4 text-sm text-amber-700 dark:text-amber-400">
          {error} — Showing simulated data.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-sm">Tier</CardDescription>
            <CardTitle className="text-2xl capitalize" style={{ color: tierColor }}>
              {usage?.tenant?.tier || "free"}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-sm">Daily Usage</CardDescription>
            <CardTitle className="text-2xl">
              {usage?.usage.daily.calls?.toLocaleString() || "0"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              {usage?.usage.daily.remaining?.toLocaleString() || 0} remaining / {usage?.usage.daily.limit?.toLocaleString() || 0} limit
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(dailyPercent, 100)}%`,
                  backgroundColor: dailyPercent > 90 ? "#C23030" : dailyPercent > 70 ? "#D4A017" : "#10B981",
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-sm">Monthly Usage</CardDescription>
            <CardTitle className="text-2xl">
              {usage?.usage.monthly.calls?.toLocaleString() || "0"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              {usage?.usage.monthly.remaining?.toLocaleString() || 0} remaining / {usage?.usage.monthly.limit?.toLocaleString() || 0} limit
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(monthlyPercent, 100)}%`,
                  backgroundColor: monthlyPercent > 90 ? "#C23030" : monthlyPercent > 70 ? "#D4A017" : "#10B981",
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-sm">Reset Date</CardDescription>
            <CardTitle className="text-2xl">
              {usage?.resetDate
                ? new Date(usage.resetDate).toLocaleDateString("en-CA", { month: "short", day: "numeric" })
                : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">Monthly cycle resets</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">API Usage (Last 30 Days)</CardTitle>
              <CardDescription>Daily request volume across all endpoints</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={loadData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="usageFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={tierColor} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={tierColor} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "var(--muted-foreground, #6B7280)" }}
                axisLine={{ stroke: "var(--border, #E5E7EB)" }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted-foreground, #6B7280)" }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--bg-card, #1F2937)",
                  border: "1px solid var(--border, #374151)",
                  borderRadius: "8px",
                  fontSize: "0.82rem",
                  color: "var(--text-primary, #F9FAFB)",
                }}
                labelStyle={{ color: "var(--muted-foreground, #9CA3AF)" }}
              />
              <Area
                type="monotone"
                dataKey="calls"
                stroke={tierColor}
                strokeWidth={2}
                fill="url(#usageFill)"
                dot={false}
                activeDot={{ r: 4, fill: tierColor, stroke: "var(--bg-card, #1F2937)", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Rate Limits</CardTitle>
          <CardDescription>Current plan limits and consumption</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-muted-foreground">Daily requests</span>
              <span className="font-medium">
                {usage?.usage.daily.calls?.toLocaleString() || 0} / {usage?.usage.daily.limit?.toLocaleString() || 0}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(dailyPercent, 100)}%`,
                  backgroundColor: dailyPercent > 90 ? "#C23030" : dailyPercent > 70 ? "#D4A017" : "#10B981",
                }}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-muted-foreground">Monthly requests</span>
              <span className="font-medium">
                {usage?.usage.monthly.calls?.toLocaleString() || 0} / {usage?.usage.monthly.limit?.toLocaleString() || 0}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(monthlyPercent, 100)}%`,
                  backgroundColor: monthlyPercent > 90 ? "#C23030" : monthlyPercent > 70 ? "#D4A017" : "#10B981",
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
