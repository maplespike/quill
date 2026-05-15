// docs-pretext.js — Pretext integration for editorial docs pages
// Measures text for accurate layout, pre-calculates section heights,
// and enables rich inline measurement for code spans/badges.

import {
  prepare,
  layout,
} from '@chenglou/pretext';
import { prepareRichInline } from '@chenglou/pretext/rich-inline';

const BODY_FONT = '16px "Inter", system-ui, sans-serif';
const CODE_FONT = '14px "JetBrainsMono Nerd Font", "JetBrains Mono", monospace';
const LINE_HEIGHT = 28;
const CONTENT_MAX_WIDTH = 800;

function measureParagraphHeight(text, width = CONTENT_MAX_WIDTH) {
  const prepared = prepare(text, BODY_FONT);
  const { height, lineCount } = layout(prepared, width, LINE_HEIGHT);
  return { height, lineCount };
}

function prepareRichParagraph(element) {
  const fragments = [];
  for (const child of element.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent;
      if (text.trim()) fragments.push({ text, font: BODY_FONT });
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const tag = child.tagName;
      if (tag === 'CODE') {
        fragments.push({
          text: child.textContent,
          font: CODE_FONT,
          break: 'never',
          extraWidth: 10,
        });
      } else if (tag === 'A') {
        fragments.push({ text: child.textContent, font: `500 ${BODY_FONT}` });
      } else if (tag === 'STRONG' || tag === 'B') {
        fragments.push({ text: child.textContent, font: `700 ${BODY_FONT}` });
      } else if (tag === 'EM' || tag === 'I') {
        fragments.push({ text: child.textContent, font: `italic ${BODY_FONT}` });
      } else {
        fragments.push({ text: child.textContent, font: BODY_FONT });
      }
    }
  }
  if (fragments.length === 0) return null;
  return prepareRichInline(fragments);
}

function preCalculateSectionHeights() {
  const sections = document.querySelectorAll('.docs-content h2, .docs-content h3');
  const measurements = [];

  sections.forEach((heading) => {
    let totalHeight = 0;
    let sibling = heading.nextElementSibling;

    while (sibling && sibling.tagName !== 'H2' && sibling.tagName !== 'H3') {
      if (sibling.tagName === 'P') {
        const { height } = measureParagraphHeight(sibling.textContent);
        totalHeight += height;
      } else if (sibling.tagName === 'PRE') {
        const code = sibling.querySelector('code');
        const text = code ? code.textContent : sibling.textContent;
        const lines = text.split('\n').length;
        totalHeight += lines * 22 + 32;
      } else {
        totalHeight += sibling.offsetHeight || 50;
      }
      sibling = sibling.nextElementSibling;
    }

    measurements.push({ heading: heading.textContent, height: totalHeight });
  });

  return measurements;
}

function init() {
  const content = document.querySelector('.docs-content');
  if (!content) return;

  const paragraphs = content.querySelectorAll('p');
  const heightCache = new Map();

  paragraphs.forEach((p, i) => {
    const { height, lineCount } = measureParagraphHeight(p.textContent);
    heightCache.set(i, { height, lineCount });
  });

  const sectionHeights = preCalculateSectionHeights();

  window.__pretextMeasurements = {
    paragraphs: heightCache,
    sections: sectionHeights,
    contentWidth: CONTENT_MAX_WIDTH,
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export { init, measureParagraphHeight, prepareRichParagraph };
