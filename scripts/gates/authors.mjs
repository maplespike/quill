#!/usr/bin/env node
// Who may pass the merge gate.
//
// #1274: `gh pr view --json author` is GraphQL and reports Dependabot as
// `app/dependabot`. The pull_request event and REST report `dependabot[bot]`.
// An allowlist with only the REST spelling rejected every Dependabot pull
// request (run 42364690702). Both spellings are accepted. The numeric
// database id is the same account, so a caller that has the id and not the
// login is accepted too.
//
//   node scripts/gates/authors.mjs --login "app/dependabot"
//   node scripts/gates/authors.mjs --login someone --id 49699333
// Exit 0 when the author is allowed. Exit 1 when not. Exit 2 on a bad invocation.

/** Logins the gate already compared in the shell case (#1274). */
export const ALLOWED_LOGINS = ['dependabot[bot]', 'app/dependabot', 'reverb256'];

/** dependabot[bot] / app/dependabot database id. */
export const DEPENDABOT_AUTHOR_ID = 49699333;

/**
 * @param {{ login?: string | null, id?: number | string | null }} author
 * @returns {boolean}
 */
export function isAllowedAuthor(author) {
  const login = author?.login ?? '';
  if (typeof login === 'string' && ALLOWED_LOGINS.includes(login)) return true;
  const raw = author?.id;
  const id = typeof raw === 'number'
    ? raw
    : (typeof raw === 'string' && /^[0-9]+$/.test(raw) ? Number(raw) : null);
  return id === DEPENDABOT_AUTHOR_ID;
}

function argValue(argv, flag) {
  const index = argv.indexOf(flag);
  if (index < 0) return null;
  const value = argv[index + 1];
  if (value == null || value.startsWith('--')) return null;
  return value;
}

function main(argv) {
  if (!argv.includes('--login') && !argv.includes('--id')) {
    console.error('authors: pass --login and/or --id');
    return 2;
  }
  const login = argValue(argv, '--login');
  const id = argValue(argv, '--id');
  return isAllowedAuthor({ login, id }) ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
