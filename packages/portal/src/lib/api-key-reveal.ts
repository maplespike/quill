/**
 * Copy the user sees once, immediately after a key is minted.
 * A free discovery endpoint so the example works on the free tier.
 */
export function discoveryCurl(apiBase: string, apiKey: string): string {
  const base = apiBase.replace(/\/$/, "");
  return `curl -s -H "x-api-key: ${apiKey}" ${base}/v1/llms.txt`;
}
