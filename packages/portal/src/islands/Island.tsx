import { StrictMode, useEffect, useRef, useState, type ComponentType } from 'react';

/*
 * Module-level Landing promise cache.
 *
 * Astro 'client:only=react' on the parent <Island /> already dynamic-imports
 * this file. Without a cached promise, React 19 StrictMode dev double-mount
 * schedules a SECOND inner import('./pages/Landing'), producing two
 * setLanding() calls and a brief double-render. The static let below
 * survives mount -> cleanup -> re-mount so the resolver fires exactly
 * once per page lifetime.
 */
let landingPromise: Promise<{ default: ComponentType }> | null = null;
function loadLanding() {
  if (!landingPromise) {
    landingPromise = import('./pages/Landing');
  }
  return landingPromise;
}

function IslandInner() {
  const [Landing, setLanding] = useState<ComponentType | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    loadLanding()
      .then((m) => {
        if (!cancelledRef.current) setLanding(() => m.default);
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error('[astro-port] load failed:', e);
      });
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  if (!Landing) {
    /*
     * Loading region (polish-4):
     *   - min-h-[var(--hero-min-height)] matches canonical Landing.tsx
     *     first-section hero height (real CSS length, NOT class literal).
     *   - text-parliament (cyan #06b6d4): unambiguous in-progress cue,
     *     colorblind-safe (NOT red which evokes error/warning).
     *   - Single animate-pulse on first dot + 2 static trailing dots.
     *     Eliminates round-3 flicker concerns round-4 (polish-3)
     *     re-amplified; one pulse + trail conveys 'still loading'.
     *   - aria-busy + aria-label=loading on wrapper div (NOT inner
     *     span, NOT role=img which caused 'loading image' AT bug).
     */
    return (
      <div
        className="min-h-[var(--hero-min-height)] flex items-center justify-center label-cap text-parliament font-mono-num"
        aria-busy="true"
        aria-label="loading"
      >
        <span className="inline-flex items-center gap-1">
          <span aria-hidden="true" className="block h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
          <span aria-hidden="true" className="block h-1.5 w-1.5 rounded-full bg-current opacity-50" />
          <span aria-hidden="true" className="block h-1.5 w-1.5 rounded-full bg-current opacity-25" />
        </span>
      </div>
    );
  }
  return <Landing />;
}

export default function Island() {
  return (
    <StrictMode>
      <IslandInner />
    </StrictMode>
  );
}
