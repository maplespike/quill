import plansData from "@/data/plans.json";

export type PaidPlanId = "pro" | "business";
export type DisclosureLang = "en" | "fr";

const NAMES: Record<PaidPlanId, Record<DisclosureLang, string>> = {
  pro: { en: "Pro", fr: "Pro" },
  business: { en: "Business", fr: "Affaires" },
};

function priceCents(planId: PaidPlanId): number {
  const plan = plansData.plans.find((entry) => entry.plan_id === planId);
  if (!plan) throw new Error(`Unknown paid plan: ${planId}`);
  return plan.price_cents;
}

export function formatPlanCad(cents: number, lang: DisclosureLang): string {
  const dollars = Math.round(cents / 100);
  return lang === "fr" ? `${dollars} $ CA` : `$${dollars} CAD`;
}

/**
 * Purchase summary shown beside the pay action.
 * Amounts come from plans.json, the same catalog the pricing cards use.
 */
export function renewalDisclosure(lang: DisclosureLang, planId: PaidPlanId): string {
  const name = NAMES[planId][lang];
  const price = formatPlanCad(priceCents(planId), lang);
  if (lang === "fr") {
    return `Le forfait ${name} coûte ${price} par mois. L'abonnement se renouvelle automatiquement chaque mois jusqu'à l'annulation. Annulez en tout temps depuis votre tableau de bord. L'annulation prend effet à la fin de la période de facturation en cours, et vous conservez l'accès payant jusqu'à cette date.`;
  }
  return `${name} is ${price} per month. The subscription renews automatically each month until you cancel. Cancel any time from your account dashboard. Cancellation takes effect at the end of the current billing period, and you keep paid access until then.`;
}
