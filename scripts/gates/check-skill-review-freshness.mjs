#!/usr/bin/env node
/**
 * Fail when a reviewed skill doc has no last-reviewed date, or the date is
 * missing, unparseable, in the future, or older than 30 days.
 *
 * Default files are the docs the auto-issue walker flagged in #1197–#1201.
 * Pass paths to check a different set (tests do this).
 *
 * SKILL_REVIEW_AS_OF=YYYY-MM-DD overrides "today" so the 30-day boundary
 * does not depend on the clock.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_AGE_DAYS = 30;

export const DEFAULT_SKILL_REVIEW_FILES = [
  '.agents/skills/animation-vocabulary/SKILL.md',
  '.agents/skills/apple-design/SKILL.md',
  '.agents/skills/emil-design-eng/SKILL.md',
  '.agents/skills/quill-influence-mapping/SKILL.md',
  '.agents/skills/quill-influence-mapping/references/tools.md',
];

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function parseCalendarDay(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = Date.UTC(year, month - 1, day);
  const date = new Date(utc);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return utc;
}

export function reviewAgeDays(iso, asOfIso) {
  const reviewed = parseCalendarDay(iso);
  const asOf = parseCalendarDay(asOfIso);
  if (reviewed === null || asOf === null) return null;
  return Math.floor((asOf - reviewed) / 86_400_000);
}

function asOfDate() {
  const override = process.env.SKILL_REVIEW_AS_OF;
  if (override) {
    if (!parseCalendarDay(override)) {
      throw new Error(`SKILL_REVIEW_AS_OF must be YYYY-MM-DD, got ${override}`);
    }
    return override;
  }
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function checkSkillReviewFile(filePath, asOfIso) {
  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return `${filePath}: cannot read file (${error.message})`;
  }
  const match = text.match(/^last-reviewed:\s*(\S+)\s*$/m);
  if (!match) return `${filePath}: missing last-reviewed date`;
  const raw = match[1];
  if (!parseCalendarDay(raw)) {
    return `${filePath}: last-reviewed is not a calendar date (${raw})`;
  }
  const age = reviewAgeDays(raw, asOfIso);
  if (age < 0) return `${filePath}: last-reviewed ${raw} is after ${asOfIso}`;
  if (age > MAX_AGE_DAYS) {
    return `${filePath}: last-reviewed ${raw} is ${age} days before ${asOfIso} (limit ${MAX_AGE_DAYS})`;
  }
  return null;
}

export function checkSkillReviewFiles(files, asOfIso = asOfDate()) {
  return files
    .map((file) => checkSkillReviewFile(path.resolve(ROOT, file), asOfIso))
    .filter(Boolean);
}

function main() {
  const files = process.argv.slice(2);
  const targets = files.length > 0 ? files : DEFAULT_SKILL_REVIEW_FILES;
  let asOf;
  try {
    asOf = asOfDate();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  const failures = checkSkillReviewFiles(targets, asOf);
  if (failures.length > 0) {
    for (const failure of failures) console.error(failure);
    process.exit(1);
  }
  console.log(`skill review dates are within ${MAX_AGE_DAYS} days of ${asOf} (${targets.length} files)`);
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) main();
