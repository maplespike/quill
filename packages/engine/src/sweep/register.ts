// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Install the extensionless-import hook before the sweep entry loads.
 * Start the job with: node --import ./packages/engine/dist/sweep/register.js
 */
import { register } from "node:module";

register("./hooks.js", import.meta.url);
