import { useEffect, useState } from "react";
import { getPlans, Plan, Chain } from "../../lib/api";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { createI18n } from "@maplespike/i18n";
import type { Locale } from "@maplespike/i18n";

export default function BillingPlans({ lang: propLang }: { lang?: Locale }) {
  const lang = propLang || (typeof window !== "undefined" ? ((window as unknown as Record<string, string>).__LANG as Locale || "en") : "en");
  const i18n = createI18n(lang);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [chains, setChains] = useState<Chain[]>([]);
  const [selectedPlan, setSelectedPlan] = useState("");
  const [selectedChain, setSelectedChain] = useState("solana-usdc");
  const [order, setOrder] = useState<null | { orderId: string; wallet: string; amount: number; token: string; explorer: string }>(null);
  const [txHash, setTxHash] = useState("");

  useEffect(() => {
    getPlans().then(d => { setPlans(d.plans); setChains(d.chains); });
  }, []);

  async function handleOrder() {
    const r = await fetch("/api/billing/order", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: selectedPlan, chainId: selectedChain }),
    });
    const d = await r.json();
    if (d.success) setOrder(d.data);
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {plans.filter(p => p.priceUsd > 0).map(p => (
          <Card key={p.id} onClick={() => setSelectedPlan(p.id)}
            className={`card-hover cursor-pointer ${selectedPlan === p.id ? 'ring-2 ring-primary' : ''}`}>
            <CardHeader>
              <CardTitle>{p.name}</CardTitle>
              <CardDescription>${p.priceUsd}/mo</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{p.requests.toLocaleString()} requests/mo</p>
              <p className="text-sm text-muted-foreground">{p.rateLimit} req/s</p>
            </CardContent>
          </Card>
        ))}
      </div>
      {selectedPlan && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Pay with Crypto</CardTitle>
            <CardDescription>Select a chain and send payment</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-4">
              {chains.filter(c => c.usdc).map(c => (
                <Button key={c.id} variant={selectedChain === c.id ? "default" : "outline"} size="sm" onClick={() => setSelectedChain(c.id)}>
                  {c.name} ({c.token})
                </Button>
              ))}
            </div>
            <Button onClick={handleOrder}>Generate Payment Address</Button>
            {order && (
              <div className="mt-4 p-4 bg-muted rounded-lg space-y-3">
                <p className="text-sm">Send <strong>${order.amount} {order.token}</strong> to:</p>
                <code className="block p-3 bg-background rounded text-xs break-all">{order.wallet}</code>
                <input value={txHash} onChange={e => setTxHash(e.target.value)}
                  placeholder="Paste transaction hash"
                  className="w-full p-2 border rounded text-sm bg-background" />
                <Button onClick={async () => {
                  const r = await fetch("/api/billing/verify", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ orderId: order.orderId, txHash }),
                  });
                  const d = await r.json();
                  if (d.success) alert("Payment verified!");
                }}>Verify Payment</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
