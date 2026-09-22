import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Access } from "@/components/landing/access";
import { Pricing } from "@/components/landing/pricing";
import { Shell } from "@/components/site/shell";
import { pageMeta } from "@/lib/page-meta";
import type { BillingCycle, PlanId } from "@/lib/plans";

export const Route = createFileRoute("/pricing")({
  head: () =>
    pageMeta(
      "Pricing",
      "Open is free. Desk is $49 CAD a month. Sovereign runs on your cluster.",
    ),
  component: PricingPage,
});

function PricingPage() {
  const [plan, setPlan] = useState<PlanId>("desk");
  const [cycle, setCycle] = useState<BillingCycle>("month");

  return (
    <Shell>
      <Pricing cycle={cycle} onCycle={setCycle} onChoose={setPlan} />
      <Access plan={plan} onPlan={setPlan} />
    </Shell>
  );
}
