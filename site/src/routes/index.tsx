import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/site/shell";
import { Access } from "@/components/landing/access";
import { Hero } from "@/components/landing/hero";
import { Pricing } from "@/components/landing/pricing";
import { Story } from "@/components/landing/story";
import { Voices } from "@/components/landing/voices";
import type { BillingCycle, PlanId } from "@/lib/plans";

export const Route = createFileRoute("/")({
  component: Home,
});

export function Home() {
  const [plan, setPlan] = useState<PlanId>("desk");
  const [cycle, setCycle] = useState<BillingCycle>("month");

  return (
    <Shell>
      <Hero />
      <Story />
      <Pricing cycle={cycle} onCycle={setCycle} onChoose={setPlan} />
      <Voices />
      <Access plan={plan} onPlan={setPlan} />
    </Shell>
  );
}
