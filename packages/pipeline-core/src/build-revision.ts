// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Build revision injected at image-build time.
 * Fallback to 'unknown' for local/dev/test runs.
 */
export const BUILD_REVISION: string = (() => {
  const rev = process.env.QUILL_BUILD_REV;
  return typeof rev === 'string' && rev.length > 0 ? rev : 'unknown';
})();