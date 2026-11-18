// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Resolve hook for the engine sweep.
 *
 * tsc emits extensionless relative imports (`../orchestrator`). Node ESM
 * will not load those. This hook appends `.js` so `node packages/engine/dist/sweep/run.js`
 * can start the sweep without a bundler.
 */

interface ResolveContext {
  parentURL?: string;
}

type NextResolve = (
  specifier: string,
  context: ResolveContext,
) => Promise<{ url: string; shortCircuit?: boolean }>;

export async function resolve(
  specifier: string,
  context: ResolveContext,
  nextResolve: NextResolve,
): Promise<{ url: string; shortCircuit?: boolean }> {
  const relative = specifier.startsWith("./") || specifier.startsWith("../");
  const hasExtension = /\.[a-z0-9]+$/i.test(specifier);
  if (relative && !hasExtension) {
    try {
      return await nextResolve(`${specifier}.js`, context);
    } catch {
      return nextResolve(`${specifier}/index.js`, context);
    }
  }
  return nextResolve(specifier, context);
}
