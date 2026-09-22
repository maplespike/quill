export const SITE = {
  name: "Quill",
  org: "MapleSpike",
  url: "https://quill.maplespike.ca",
  github: "https://github.com/reverb256/quill",
  api: "https://quill.maplespike.ca/v1/search?q=lobbying+registrations",
} as const;

export const PLANS = ["open", "desk", "sovereign"] as const;
export type PlanId = (typeof PLANS)[number];

export const DESK_MONTHLY_CAD = 49;
export const DESK_YEARLY_CAD = DESK_MONTHLY_CAD * 10;

export type BillingCycle = "month" | "year";

export function deskPrice(cycle: BillingCycle) {
  if (cycle === "month") return DESK_MONTHLY_CAD;
  return Math.round(DESK_YEARLY_CAD / 12);
}

export const PLAN_COPY: Record<
  PlanId,
  { name: string; audience: string; points: string[] }
> = {
  open: {
    name: "Open",
    audience: "Try the public record before you commit a desk.",
    points: [
      "1,000 MCP calls / month",
      "Discovery, metadata, and search",
      "Citation and verification always free",
      "Quill Lite — npx, no database",
      "Community support",
    ],
  },
  desk: {
    name: "Desk",
    audience: "For a reporter, analyst, or a small research shop.",
    points: [
      "20,000 MCP calls / month",
      "Provenance briefs and influence graph",
      "3 seats",
      "TypeScript and Python SDKs",
      "Email support",
    ],
  },
  sovereign: {
    name: "Sovereign",
    audience: "Run Quill inside your own cluster. Nothing leaves it.",
    points: [
      "Self-hosted on your K3s or laptop",
      "Unlimited calls inside your network",
      "White-label and journalism mode",
      "Card, Interac e-Transfer, or x402",
      "Zero external cloud spend",
    ],
  },
};
