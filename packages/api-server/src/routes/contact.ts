// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — Contact Form (Decision 0002 — DEPRECATED)
 *
 * The contact form used to collect `{ name, email, subject, message }`
 * and email them to ops. That's a direct PII retention violation.
 *
 * All contact-form requests return 410 Gone. New paths forward
 * the user to a public status page:
 *
 *   - GitHub issues (public, no email): https://github.com/...
 *   - Public status: https://status.maplespike.ca
 *   - Community chat: https://discord.gg/...
 *
 * Operators who genuinely need to reach a customer find them
 * via their Astral-key JWT `sub` — never via an email channel.
 *
 * This module is kept to honour generic routers that import
 * `contactHandler` and would otherwise 500 on a missing export.
 */

import type { RouteHandler } from '../types.js';
import { buildError, jsonResponse } from '../response.js';

const DEPRECATION_BODY = {
  deprecated: true,
  decision_doc: '/docs/decisions/0002-pii-avoidance.md',
  replacement_paths: {
    github_issues: 'https://github.com/reverb256/quill/issues',
    status:       'https://status.maplespike.ca',
  },
  message:
    'MapleSpike never collects contact-form PII. Decision 0002 retired ' +
    'POST /v1/contact. Open a GitHub issue or check the public status page.',
};

export const contactHandler: RouteHandler = async (_request, ctx) => {
  return jsonResponse(buildError('CONTACT_DEPRECATED', DEPRECATION_BODY.message, ctx), 410);
};

export default contactHandler;
