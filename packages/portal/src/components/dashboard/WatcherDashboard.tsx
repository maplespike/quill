import { useEffect, useState } from "react";
import { getWatcherStatus, getWatcherEvents, getWebhooks } from "../../lib/api";
import type { WatcherStatus, WatcherEvent, WebhookConfig } from "../../lib/api";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";

export default function WatcherDashboard() {
  const [status, setStatus] = useState<WatcherStatus | null>(null);
  const [events, setEvents] = useState<WatcherEvent[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getWatcherStatus(),
      getWatcherEvents(undefined, 20),
      getWebhooks(),
    ]).then(([s, e, w]) => {
      if (s) setStatus(s);
      if (e) setEvents(e.events || []);
      if (w) setWebhooks(w.webhooks || []);
      setLoading(false);
    });
  }, []);

  const recentChanges = events.filter(e => e.changed).length;

  return (
    <>
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium">Watched Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <p class="text-2xl font-bold">{status?.totalSources ?? '—'}</p>
            <p class="text-xs text-muted-foreground">polling at configured intervals</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium">Changes Detected</CardTitle>
          </CardHeader>
          <CardContent>
            <p class="text-2xl font-bold">{recentChanges}</p>
            <p class="text-xs text-muted-foreground">in recent events</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium">Webhooks</CardTitle>
          </CardHeader>
          <CardContent>
            <p class="text-2xl font-bold">{webhooks.length}</p>
            <p class="text-xs text-muted-foreground">registered</p>
          </CardContent>
        </Card>
      </div>

      <h2 class="text-xl font-semibold mb-4">Watched Sources</h2>

      <div class="space-y-3 mb-8">
        {status?.watchedSources?.map(source => (
          <Card key={source.id}>
            <CardHeader class="pb-2">
              <div class="flex items-center justify-between">
                <CardTitle class="text-base">{source.name}</CardTitle>
                <Badge class="bg-green-500/10 text-green-500 border-green-500/20">Active</Badge>
              </div>
              <CardDescription>Type: {source.type}</CardDescription>
            </CardHeader>
            <CardContent>
              <div class="flex justify-between text-sm">
                <span>Interval: <strong>{Math.round(source.intervalMs / 60000)} min</strong></span>
                <span>Type: <strong>{source.type.toUpperCase()}</strong></span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {events.length > 0 && (
        <>
          <h2 class="text-xl font-semibold mb-4">Recent Events</h2>
          <div class="space-y-2 mb-8">
            {events.slice(0, 10).map((event, i) => (
              <Card key={`${event.sourceId}-${i}`}>
                <CardContent class="py-3">
                  <div class="flex items-center justify-between">
                    <div>
                      <span class="font-medium">{event.sourceName}</span>
                      <span class="ml-2 text-sm text-muted-foreground">
                        {new Date(event.detectedAt).toLocaleString()}
                      </span>
                    </div>
                    <Badge variant={event.changed ? "default" : "outline"}>
                      {event.changed ? "Changed" : "No Change"}
                    </Badge>
                  </div>
                  <p class="text-sm text-muted-foreground mt-1">{event.summary}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {webhooks.length > 0 && (
        <>
          <h2 class="text-xl font-semibold mb-4">Webhooks</h2>
          <div class="space-y-2 mb-8">
            {webhooks.map(wh => (
              <Card key={wh.id}>
                <CardContent class="py-3">
                  <div class="flex items-center justify-between">
                    <div>
                      <span class="font-medium">{wh.label || wh.url}</span>
                      <span class="ml-2 text-sm text-muted-foreground">{wh.url}</span>
                    </div>
                    <Badge variant={wh.active ? "default" : "outline"}>
                      {wh.active ? "Active" : "Disabled"}
                    </Badge>
                  </div>
                  {wh.sourceFilter.length > 0 && (
                    <p class="text-xs text-muted-foreground mt-1">
                      Sources: {wh.sourceFilter.includes('*') ? 'All' : wh.sourceFilter.join(', ')}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  );
}
