import { useState } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Copy, Check, ChevronDown, ChevronRight } from "lucide-react"

interface Endpoint {
  method: string
  path: string
  description: string
  auth: boolean
  params?: Array<{ name: string; type: string; required: boolean; description: string }>
  body?: Array<{ name: string; type: string; required: boolean; description: string }>
  response: string
}

const ENDPOINTS: Record<string, Endpoint[]> = {
  health: [
    {
      method: "GET",
      path: "/v1/health",
      description: "System health check and tenant information",
      auth: false,
      response: `{
  "success": true,
  "data": {
    "status": "ok",
    "service": "maplespike-api",
    "version": "0.3.0",
    "environment": "development",
    "timestamp": "2026-05-19T12:00:00.000Z",
    "tenant": {
      "id": "tenant_default",
      "name": "Default",
      "tier": "free"
    },
    "usage": {
      "daily": 42,
      "monthly": 1250
    }
  }
}`,
    },
  ],
  keys: [
    {
      method: "GET",
      path: "/v1/keys",
      description: "List all API keys for the current tenant",
      auth: true,
      response: `{
  "success": true,
  "data": {
    "keys": [
      {
        "id": "key_a1b2c3d4",
        "name": "production",
        "keyPrefix": "maplespike_****a3f8",
        "createdAt": "2026-01-15T10:30:00.000Z",
        "expiresAt": "2026-04-15T10:30:00.000Z",
        "isActive": true
      }
    ],
    "total": 1
  }
}`,
    },
    {
      method: "POST",
      path: "/v1/keys",
      description: "Create a new API key",
      auth: true,
      body: [
        { name: "name", type: "string", required: true, description: "Human-readable name for the key" },
      ],
      response: `{
  "success": true,
  "data": {
    "id": "key_e5f6g7h8",
    "name": "staging",
    "key": "maplespike_a1b2c3d4e5f6...",
    "createdAt": "2026-05-19T12:00:00.000Z"
  }
}`,
    },
    {
      method: "DELETE",
      path: "/v1/keys/:id",
      description: "Revoke an API key",
      auth: true,
      params: [
        { name: "id", type: "string", required: true, description: "The key ID to revoke" },
      ],
      response: `{
  "success": true,
  "data": {
    "id": "key_a1b2c3d4",
    "revoked": true
  }
}`,
    },
    {
      method: "POST",
      path: "/v1/keys/:id/rotate",
      description: "Rotate an API key (revoke old, create new)",
      auth: true,
      params: [
        { name: "id", type: "string", required: true, description: "The key ID to rotate" },
      ],
      response: `{
  "success": true,
  "data": {
    "previousKeyId": "key_a1b2c3d4",
    "newKey": {
      "id": "key_i9j0k1l2",
      "key": "maplespike_x9y8z7w6...",
      "expiresAt": "2026-08-17T12:00:00.000Z"
    },
    "message": "Key rotated successfully. Save your new API key."
  }
}`,
    },
  ],
  usage: [
    {
      method: "GET",
      path: "/v1/usage",
      description: "Current period consumption with tier limits",
      auth: true,
      response: `{
  "success": true,
  "data": {
    "tenant": {
      "id": "tenant_default",
      "name": "Default",
      "tier": "pro"
    },
    "period": {
      "date": "2026-05-19",
      "yearMonth": "2026-05"
    },
    "usage": {
      "daily": {
        "calls": 842,
        "limit": 1700,
        "remaining": 858,
        "percentUsed": 50
      },
      "monthly": {
        "calls": 12450,
        "limit": 50000,
        "remaining": 37550,
        "percentUsed": 25
      }
    },
    "resetDate": "2026-06-01T00:00:00.000Z"
  }
}`,
    },
  ],
  data: [
    {
      method: "GET",
      path: "/v1/data/:module",
      description: "Query a specific data module",
      auth: true,
      params: [
        { name: "module", type: "string", required: true, description: "Module name (committees, lobbying, procurement, etc.)" },
        { name: "q", type: "string", required: false, description: "Search query" },
        { name: "limit", type: "number", required: false, description: "Result limit (default: 10)" },
        { name: "offset", type: "number", required: false, description: "Pagination offset" },
      ],
      response: `{
  "success": true,
  "data": {
    "module": "committees",
    "total": 42,
    "results": [
      {
        "committee": "ENVI",
        "title": "Climate Adaptation Research",
        "date": "2025-11-14",
        "status": "Report Tabled"
      }
    ],
    "citation": {
      "hash": "sha256:a1b2c3d4...",
      "verified": true
    }
  }
}`,
    },
  ],
  search: [
    {
      method: "GET",
      path: "/v1/search",
      description: "Cross-reference search across all data modules",
      auth: true,
      params: [
        { name: "q", type: "string", required: true, description: "Search query" },
        { name: "modules", type: "string", required: false, description: "Comma-separated module filter" },
        { name: "limit", type: "number", required: false, description: "Result limit (default: 10)" },
      ],
      response: `{
  "success": true,
  "data": {
    "query": "carbon pricing",
    "total": 156,
    "results": [
      {
        "module": "committees",
        "title": "Carbon Pricing Review",
        "snippet": "Discussion of federal carbon pricing...",
        "relevance": 0.95
      },
      {
        "module": "gazette",
        "title": "Clean Fuel Standard Amendment",
        "snippet": "Regulation affecting carbon pricing...",
        "relevance": 0.87
      }
    ]
  }
}`,
    },
  ],
}

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-600",
  POST: "bg-blue-600",
  DELETE: "bg-red-600",
  PUT: "bg-amber-600",
  PATCH: "bg-purple-600",
}

const TIER_LIMITS = {
  free: { daily: 35, monthly: 1000 },
  pro: { daily: 1700, monthly: 50000 },
  business: { daily: 8500, monthly: 250000 },
  enterprise: { daily: 35000, monthly: 1000000 },
  internal: { daily: 35000, monthly: 1000000 },
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  function copyCode() {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group">
      <pre className="rounded-md bg-muted p-4 text-xs font-mono overflow-x-auto">
        <code>{code}</code>
      </pre>
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={copyCode}
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </Button>
    </div>
  )
}

function EndpointCard({ endpoint }: { endpoint: Endpoint }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card className="mb-4">
      <CardContent className="pt-6">
        <div className="flex items-start gap-3 mb-3">
          <Badge className={`${METHOD_COLORS[endpoint.method]} text-white`}>
            {endpoint.method}
          </Badge>
          <code className="font-mono text-sm font-medium">{endpoint.path}</code>
          {endpoint.auth && (
            <Badge variant="secondary" className="ml-auto">Auth Required</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground mb-3">{endpoint.description}</p>

        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronDown className="h-3 w-3 mr-1" /> : <ChevronRight className="h-3 w-3 mr-1" />}
          {expanded ? "Hide" : "Show"} details
        </Button>

        {expanded && (
          <div className="mt-4 space-y-4">
            {endpoint.params && endpoint.params.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Path / Query Parameters</h4>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-1 font-medium">Name</th>
                      <th className="text-left py-1 font-medium">Type</th>
                      <th className="text-left py-1 font-medium">Required</th>
                      <th className="text-left py-1 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {endpoint.params.map((p) => (
                      <tr key={p.name} className="border-b border-muted">
                        <td className="py-1.5 font-mono text-xs">{p.name}</td>
                        <td className="py-1.5 text-muted-foreground">{p.type}</td>
                        <td className="py-1.5">{p.required ? "Yes" : "No"}</td>
                        <td className="py-1.5 text-muted-foreground">{p.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {endpoint.body && endpoint.body.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Request Body</h4>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-1 font-medium">Field</th>
                      <th className="text-left py-1 font-medium">Type</th>
                      <th className="text-left py-1 font-medium">Required</th>
                      <th className="text-left py-1 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {endpoint.body.map((b) => (
                      <tr key={b.name} className="border-b border-muted">
                        <td className="py-1.5 font-mono text-xs">{b.name}</td>
                        <td className="py-1.5 text-muted-foreground">{b.type}</td>
                        <td className="py-1.5">{b.required ? "Yes" : "No"}</td>
                        <td className="py-1.5 text-muted-foreground">{b.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div>
              <h4 className="text-sm font-medium mb-2">Response</h4>
              <CodeBlock code={endpoint.response} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function ApiDocsViewer() {
  const [activeTab, setActiveTab] = useState("health")

  const curlExample = (method: string, path: string, auth: boolean, body?: string) => {
    const apiKey = "your_api_key"
    let cmd = `curl -X ${method} https://api.maplespike.ca${path}`
    if (auth) cmd += ` \\\n  -H "X-API-Key: ${apiKey}"`
    cmd += ` \\\n  -H "Content-Type: application/json"`
    if (body) cmd += ` \\\n  -d '${body}'`
    return cmd
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">MapleSpike API Reference</CardTitle>
          <CardDescription>
            Base URL: <code className="rounded bg-muted px-1.5 py-0.5 text-sm">https://api.maplespike.ca</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md bg-muted p-4 text-sm">
            <h4 className="font-medium mb-2">Authentication</h4>
            <p className="text-muted-foreground">
              Include your API key in the <code className="font-mono">X-API-Key</code> header, or use a Bearer token:
            </p>
            <CodeBlock
              code={`curl -X GET https://api.maplespike.ca/v1/health \\
  -H "X-API-Key: your_api_key"`}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Tier Limits</CardTitle>
          <CardDescription>API call limits by subscription tier</CardDescription>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 font-medium">Tier</th>
                <th className="text-left py-2 font-medium">Daily Limit</th>
                <th className="text-left py-2 font-medium">Monthly Limit</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(TIER_LIMITS).map(([tier, limits]) => (
                <tr key={tier} className="border-b border-muted">
                  <td className="py-2 font-medium capitalize">{tier}</td>
                  <td className="py-2">{limits.daily.toLocaleString()}</td>
                  <td className="py-2">{limits.monthly.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start overflow-x-auto">
          {Object.keys(ENDPOINTS).map((tab) => (
            <TabsTrigger key={tab} value={tab} className="capitalize">
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        {Object.entries(ENDPOINTS).map(([tab, endpoints]) => (
          <TabsContent key={tab} value={tab} className="mt-6">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold capitalize">{tab} Endpoints</h3>
              {endpoints.map((ep, i) => (
                <EndpointCard key={i} endpoint={ep} />
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">SDK Quick Start</CardTitle>
          <CardDescription>Get started with the MapleSpike SDK</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="typescript">
            <TabsList>
              <TabsTrigger value="typescript">TypeScript</TabsTrigger>
              <TabsTrigger value="python">Python</TabsTrigger>
              <TabsTrigger value="curl">cURL</TabsTrigger>
            </TabsList>
            <TabsContent value="typescript" className="mt-4">
              <CodeBlock
                code={`import { MapleSpike } from '@maplespike/sdk'

const client = new MapleSpike({
  apiKey: 'maplespike_your_key_here',
  baseUrl: 'https://api.maplespike.ca',
})

// Query committees
const committees = await client.committees.search({
  query: 'climate',
  limit: 10,
})

// Search across all modules
const results = await client.search({
  query: 'carbon pricing',
  modules: ['committees', 'gazette'],
})`}
              />
            </TabsContent>
            <TabsContent value="python" className="mt-4">
              <CodeBlock
                code={`from maplespike import MapleSpike

client = MapleSpike(
    api_key="maplespike_your_key_here",
    base_url="https://api.maplespike.ca",
)

# Query committees
committees = client.committees.search(
    query="climate",
    limit=10,
)

# Search across all modules
results = client.search(
    query="carbon pricing",
    modules=["committees", "gazette"],
)`}
              />
            </TabsContent>
            <TabsContent value="curl" className="mt-4">
              <CodeBlock
                code={`# Health check
curl https://api.maplespike.ca/v1/health

# List API keys
curl -X GET https://api.maplespike.ca/v1/keys \\
  -H "X-API-Key: maplespike_your_key"

# Create a new API key
curl -X POST https://api.maplespike.ca/v1/keys \\
  -H "X-API-Key: maplespike_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "my-app"}'

# Query data
curl "https://api.maplespike.ca/v1/data/committees?q=climate&limit=5" \\
  -H "X-API-Key: maplespike_your_key"`}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
