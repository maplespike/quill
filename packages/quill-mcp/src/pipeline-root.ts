// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Resolve the pipeline-core source root reliably from any module depth.
 *
 * qa_schema and the `quill://schemas` MCP resource both need to point
 * extractSchemas() at packages/pipeline-core/src. A naive `new URL(
 * '../../pipeline-core/src', import.meta.url)` only works when the caller
 * sits exactly one directory under src/ (e.g. src/server.ts) and silently
 * misses when it's two deep (src/tools/*.ts). This module anchors the
 * relative path at ITS OWN location (src/pipeline-root.ts), so every
 * consumer gets the same correct root.
 */

import { fileURLToPath } from 'url';

/** Absolute path to packages/pipeline-core/src (works in src/ and dist/). */
export const PIPELINE_CORE_SRC = fileURLToPath(
  new URL('../../pipeline-core/src', import.meta.url),
);
