export type Endpoint = {
  id: string;
  method: "GET" | "POST" | "DELETE";
  path: string;
  auth: "No" | "Yes";
  description: string;
};

export const API_ORIGIN = "https://api.maplespike.ca";

export const ENDPOINTS: Endpoint[] = [
  { id: "health", method: "GET", path: "/v1/health", auth: "No", description: "Health check." },
  { id: "search", method: "GET", path: "/v1/gov/search?q=hansard", auth: "No", description: "Search the public record." },
  { id: "releases", method: "GET", path: "/v1/gov/releases", auth: "Yes", description: "Latest releases." },
  { id: "citation", method: "GET", path: "/v1/citation/:id", auth: "No", description: "Fetch a stored SHA-256 citation." },
  { id: "usage", method: "GET", path: "/v1/usage", auth: "Yes", description: "Calls used against the monthly quota." },
  { id: "ask", method: "POST", path: "/v1/ai/ask", auth: "Yes", description: "A question across the datasets. Alias of /v1/ai_ask." },
  { id: "signals", method: "GET", path: "/v1/signals", auth: "Yes", description: "Engine signals." },
  { id: "entity", method: "GET", path: "/v1/entities/:id", auth: "Yes", description: "Entity profile and quill://entity URI." },
  { id: "links", method: "GET", path: "/v1/entities/:id/links", auth: "Yes", description: "Cross-registry links for one entity." },
  { id: "openapi", method: "GET", path: "/v1/openapi.json", auth: "No", description: "OpenAPI specification." },
  { id: "plans", method: "GET", path: "/v1/billing/plans", auth: "No", description: "Billing plans." },
  { id: "keys", method: "GET", path: "/v1/keys", auth: "Yes", description: "Keys on the account." },
];
