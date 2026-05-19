import { useState, useEffect, useCallback } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import { Copy, Plus, Trash2, RefreshCw, Eye, EyeOff, Check, AlertTriangle } from "lucide-react"

interface ApiKey {
  id: string
  name: string
  key?: string
  keyPrefix?: string
  createdAt: string
  expiresAt?: string
  isActive: boolean
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
    if (res.status === 401) {
      return { success: false, error: { code: "UNAUTHORIZED", message: "Authentication required" } }
    }
    const json = await res.json()
    return json as ApiResponse<T>
  } catch {
    return { success: false, error: { code: "NETWORK_ERROR", message: "API unreachable" } }
  }
}

function maskKey(key: string): string {
  if (key.length <= 12) return key
  return key.slice(0, 12) + "•".repeat(8) + key.slice(-4)
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })
  } catch {
    return dateStr
  }
}

export default function ApiKeyManager() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [newKeyName, setNewKeyName] = useState("")
  const [creating, setCreating] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [newKeyResult, setNewKeyResult] = useState<string | null>(null)
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null)
  const [rotateDialog, setRotateDialog] = useState<string | null>(null)

  const loadKeys = useCallback(async () => {
    setLoading(true)
    const res = await fetchApi<{ keys: ApiKey[]; total: number }>("/v1/keys")
    if (res.success && res.data) {
      setKeys(res.data.keys || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadKeys()
  }, [loadKeys])

  async function handleCreateKey() {
    if (!newKeyName.trim()) return
    setCreating(true)
    setMessage(null)
    setNewKeyResult(null)

    const res = await fetchApi<{ id: string; key: string; name: string; createdAt: string }>("/v1/keys", {
      method: "POST",
      body: JSON.stringify({ name: newKeyName.trim() }),
    })

    setCreating(false)
    if (res.success && res.data) {
      setNewKeyResult(res.data.key)
      setNewKeyName("")
      setMessage({ type: "success", text: "API key created. Save it now — it won't be shown again." })
      loadKeys()
    } else {
      setMessage({ type: "error", text: res.error?.message || "Failed to create key" })
    }
  }

  async function handleDeleteKey(id: string) {
    const res = await fetchApi(`/v1/keys/${id}`, { method: "DELETE" })
    setDeleteDialog(null)
    if (res.success) {
      setMessage({ type: "success", text: "Key revoked successfully" })
      loadKeys()
    } else {
      setMessage({ type: "error", text: res.error?.message || "Failed to revoke key" })
    }
  }

  async function handleRotateKey(id: string) {
    const res = await fetchApi<{ newKey: { id: string; key: string }; previousKeyId: string }>(`/v1/keys/${id}/rotate`, {
      method: "POST",
    })
    setRotateDialog(null)
    if (res.success && res.data) {
      setNewKeyResult(res.data.newKey.key)
      setMessage({ type: "success", text: "Key rotated. Save the new key — it won't be shown again." })
      loadKeys()
    } else {
      setMessage({ type: "error", text: res.error?.message || "Failed to rotate key" })
    }
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  function toggleVisibility(id: string) {
    setVisibleKeys((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Create API Key</CardTitle>
          <CardDescription>Generate a new API key for programmatic access to MapleSpike data.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateKey()}
              placeholder="e.g. production-app, staging-test"
              className="max-w-sm"
            />
            <Button onClick={handleCreateKey} disabled={creating || !newKeyName.trim()}>
              {creating ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {creating ? "Creating..." : "Create Key"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {newKeyResult && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Save Your API Key
            </CardTitle>
            <DialogDescription>This key will only be shown once. Copy it now and store it securely.</DialogDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 rounded-md border bg-muted p-3 font-mono text-sm">
              <code className="flex-1 break-all">{newKeyResult}</code>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(newKeyResult, "new")}
              >
                {copiedId === "new" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" size="sm" onClick={() => setNewKeyResult(null)}>
              Dismiss
            </Button>
          </CardFooter>
        </Card>
      )}

      {message && (
        <div
          className={`rounded-md border p-4 text-sm ${
            message.type === "success"
              ? "border-emerald-500/50 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
              : "border-red-500/50 bg-red-500/5 text-red-700 dark:text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">API Keys ({keys.length})</CardTitle>
          <CardDescription>Manage your existing API keys. Revoked keys cannot be recovered.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" />
              Loading keys...
            </div>
          ) : keys.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No API keys yet. Create one above to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name || "Unnamed"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="rounded bg-muted px-2 py-0.5 text-xs font-mono">
                          {visibleKeys[key.id] && key.key
                            ? key.key
                            : maskKey(key.key || key.keyPrefix || key.id)}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => toggleVisibility(key.id)}
                        >
                          {visibleKeys[key.id] ? (
                            <EyeOff className="h-3 w-3" />
                          ) : (
                            <Eye className="h-3 w-3" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyToClipboard(key.key || key.id, key.id)}
                        >
                          {copiedId === key.id ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(key.createdAt)}
                    </TableCell>
                    <TableCell>
                      {key.isActive !== false ? (
                        <Badge className="bg-emerald-600">Active</Badge>
                      ) : (
                        <Badge variant="destructive">Revoked</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Dialog open={rotateDialog === key.id} onOpenChange={(open) => setRotateDialog(open ? key.id : null)}>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <RefreshCw className="h-3 w-3 mr-1" />
                              Rotate
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Rotate API Key</DialogTitle>
                              <DialogDescription>
                                This will revoke the current key and generate a new one. The old key will stop working immediately.
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setRotateDialog(null)}>Cancel</Button>
                              <Button onClick={() => handleRotateKey(key.id)}>Rotate Key</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <Dialog open={deleteDialog === key.id} onOpenChange={(open) => setDeleteDialog(open ? key.id : null)}>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950">
                              <Trash2 className="h-3 w-3 mr-1" />
                              Revoke
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Revoke API Key</DialogTitle>
                              <DialogDescription>
                                Are you sure you want to revoke "{key.name || "Unnamed"}"? This action cannot be undone.
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setDeleteDialog(null)}>Cancel</Button>
                              <Button variant="destructive" onClick={() => handleDeleteKey(key.id)}>Revoke Key</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
