import { useEffect, useState } from "react";
import { getHealth, getUsage } from "../../lib/api";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/card";
import { createI18n } from "@maplespike/i18n";
import type { Locale } from "@maplespike/i18n";

interface Props {
  lang?: Locale;
}

export default function DashboardOverview({ lang: propLang }: Props) {
  const lang = propLang || (typeof window !== "undefined" ? ((window as unknown as Record<string, string>).__LANG as Locale || "en") : "en");
  const i18n = createI18n(lang);
  const [health, setHealth] = useState<{
    service: string;
    version: string;
    environment: string;
    tier: string;
  } | null>(null);
  const [usage, setUsage] = useState<{ daily: number; monthly: number } | null>(
    null
  );

  useEffect(() => {
    Promise.all([getHealth(), getUsage()]).then(([h, u]) => {
      if (h)
        setHealth({
          service: h.service,
          version: h.version,
          environment: h.environment,
          tier: h.tenant?.tier || "free",
        });
      if (u) setUsage(u);
    });
  }, []);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 stagger-children">
      <Card className="card-hover">
        <CardHeader className="pb-2">
          <CardDescription>{i18n.t('nav.api')}</CardDescription>
          <CardTitle className="text-3xl">{health?.service || "—"}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {i18n.t('changelog.version').replace('{version}', health?.version || "—")}
          </p>
        </CardContent>
      </Card>
      <Card className="card-hover">
        <CardHeader className="pb-2">
          <CardDescription>{i18n.t('nav.docs')}</CardDescription>
          <CardTitle className="text-3xl">
            {health?.environment || "—"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {i18n.t('billing.plan.free')} {health?.tier || "free"}
          </p>
        </CardContent>
      </Card>
      <Card className="card-hover">
        <CardHeader className="pb-2">
          <CardDescription>{i18n.t('dashboard.stats.queries')}</CardDescription>
          <CardTitle className="text-3xl">
            {usage?.daily?.toLocaleString() || "—"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{i18n.t('dashboard.stats.queries')}</p>
        </CardContent>
      </Card>
      <Card className="card-hover">
        <CardHeader className="pb-2">
          <CardDescription>{i18n.t('billing.monthly')}</CardDescription>
          <CardTitle className="text-3xl">
            {usage?.monthly?.toLocaleString() || "—"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{i18n.t('billing.monthly')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
