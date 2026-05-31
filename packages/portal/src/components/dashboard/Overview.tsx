import { useEffect, useState } from "react";
import { getHealth, getUsage } from "../../lib/api";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/card";

export default function DashboardOverview() {
  const [health, setHealth] = useState<{ service: string; version: string; environment: string; tier: string } | null>(null);
  const [usage, setUsage] = useState<{ daily: number; monthly: number } | null>(null);

  useEffect(() => {
    Promise.all([getHealth(), getUsage()]).then(([h, u]) => {
      if (h) setHealth({ service: h.service, version: h.version, environment: h.environment, tier: h.tenant?.tier || 'free' });
      if (u) setUsage(u);
    });
  }, []);

  return (
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Service</CardDescription>
          <CardTitle class="text-3xl">{health?.service || '—'}</CardTitle>
        </CardHeader>
        <CardContent>
          <p class="text-sm text-muted-foreground">Version {health?.version || '—'}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Environment</CardDescription>
          <CardTitle class="text-3xl">{health?.environment || '—'}</CardTitle>
        </CardHeader>
        <CardContent>
          <p class="text-sm text-muted-foreground">Tier: {health?.tier || 'free'}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Daily Calls</CardDescription>
          <CardTitle class="text-3xl">{usage?.daily?.toLocaleString() || '—'}</CardTitle>
        </CardHeader>
        <CardContent>
          <p class="text-sm text-muted-foreground">Today</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Monthly Calls</CardDescription>
          <CardTitle class="text-3xl">{usage?.monthly?.toLocaleString() || '—'}</CardTitle>
        </CardHeader>
        <CardContent>
          <p class="text-sm text-muted-foreground">This month</p>
        </CardContent>
      </Card>
    </div>
  );
}
