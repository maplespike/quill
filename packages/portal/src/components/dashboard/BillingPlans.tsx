import StripeCheckoutButton from "@/components/billing/StripeCheckoutButton";
import ManageSubscriptionButton from "@/components/billing/ManageSubscriptionButton";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/card";
import type { Locale } from "@maplespike/i18n";

/**
 * Dashboard billing tab — Stripe only.
 *
 * This used to render the legacy crypto checkout (`/api/billing/order` +
 * wallet address + tx-hash verify, priced in USD). Paid plans are sold through
 * Stripe Checkout in CAD; the same buttons as /dashboard/billing are used here.
 * Plan figures mirror the backend catalog (routes/billing.ts PLANS).
 */
const PLANS: Array<{
  id: "pro" | "business";
  name: string;
  price: Record<"en" | "fr", string>;
  credits: Record<"en" | "fr", string>;
}> = [
  {
    id: "pro",
    name: "Pro",
    price: { en: "$50 CAD / month", fr: "50 $ CA / mois" },
    credits: { en: "50,000 credits / month", fr: "50 000 crédits / mois" },
  },
  {
    id: "business",
    name: "Business",
    price: { en: "$200 CAD / month", fr: "200 $ CA / mois" },
    credits: { en: "250,000 credits / month", fr: "250 000 crédits / mois" },
  },
];

export default function BillingPlans({ lang: propLang }: { lang?: Locale }) {
  const lang: "en" | "fr" =
    (propLang ||
      (typeof window !== "undefined"
        ? ((window as unknown as Record<string, string>).__LANG as Locale) || "en"
        : "en")) === "fr"
      ? "fr"
      : "en";
  const prefix = lang === "fr" ? "/fr" : "";

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {PLANS.map((p) => (
          <Card key={p.id} className="card-hover" data-plan={p.id}>
            <CardHeader>
              <CardTitle>{p.name}</CardTitle>
              <CardDescription>{p.price[lang]}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">{p.credits[lang]}</p>
              <StripeCheckoutButton
                planId={p.id}
                lang={lang}
                notSignedInHref={`${prefix}/signup?plan=${p.id}&return=${prefix}/dashboard`}
              />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <ManageSubscriptionButton variant="outline" />
        <a href={`${prefix}/dashboard/billing`} className="text-sm text-primary hover:underline">
          {lang === "fr" ? "Détails de la facturation" : "Billing details"} →
        </a>
      </div>
    </div>
  );
}
