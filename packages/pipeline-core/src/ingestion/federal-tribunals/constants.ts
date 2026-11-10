// SPDX-License-Identifier: AGPL-3.0-only
import type { TribunalName } from './types.js';

export const TRIBUNAL_SOURCES: Record<TribunalName, { name: string; baseUrl: string; searchUrl: string; hasDecisions: boolean }> = {
  'social-security-tribunal': {
    name: 'Social Security Tribunal',
    baseUrl: 'https://www.sst-tss.gc.ca',
    searchUrl: 'https://www.sst-tss.gc.ca/en/decisions',
    hasDecisions: true,
  },
  'agri-review-tribunal': {
    name: 'Canada Agricultural Review Tribunal',
    baseUrl: 'https://www.cart-crac.gc.ca',
    searchUrl: 'https://www.cart-crac.gc.ca/en/decisions',
    hasDecisions: true,
  },
  'public-servants-disclosure-tribunal': {
    name: 'Public Servants Disclosure Protection Tribunal',
    baseUrl: 'https://www.psdpt-tpfd.gc.ca',
    searchUrl: 'https://www.psdpt-tpfd.gc.ca/en/decisions',
    hasDecisions: true,
  },
  'copyright-board': {
    name: 'Copyright Board of Canada',
    baseUrl: 'https://www.cb-cda.gc.ca',
    searchUrl: 'https://www.cb-cda.gc.ca/decisions',
    hasDecisions: true,
  },
  'citt': {
    name: 'Canadian International Trade Tribunal',
    baseUrl: 'https://www.citt-tcce.gc.ca',
    searchUrl: 'https://www.citt-tcce.gc.ca/en/decisions',
    hasDecisions: true,
  },
  'rcmp-external-review': {
    name: 'RCMP External Review Committee',
    baseUrl: 'https://www.erc-cee.gc.ca',
    searchUrl: 'https://www.erc-cee.gc.ca/en/decisions',
    hasDecisions: true,
  },
  'courts-admin-service': {
    name: 'Courts Administration Service',
    baseUrl: 'https://www.cas-satj.gc.ca',
    searchUrl: 'https://www.cas-satj.gc.ca/en/decisions',
    hasDecisions: false,
  },
  'official-languages': {
    name: 'Office of the Commissioner of Official Languages',
    baseUrl: 'https://www.clo-ocol.gc.ca',
    searchUrl: 'https://www.clo-ocol.gc.ca/en/complaints',
    hasDecisions: false,
  },
  'integrity-commissioner': {
    name: 'Public Sector Integrity Commissioner',
    baseUrl: 'https://psic-ispc.gc.ca',
    searchUrl: 'https://psic-ispc.gc.ca/en/cases',
    hasDecisions: false,
  },
  'taxpayers-ombudsman': {
    name: "Taxpayers' Ombudsman",
    baseUrl: 'https://www.oto-boc.gc.ca',
    searchUrl: 'https://www.oto-boc.gc.ca/en/complaints',
    hasDecisions: false,
  },
  'core-ombudsman': {
    name: 'Canadian Ombudsman for Responsible Enterprise',
    baseUrl: 'https://core-ocre.ca',
    searchUrl: 'https://core-ocre.ca/en/cases',
    hasDecisions: false,
  },
  'human-rights-tribunal': {
    name: 'Canadian Human Rights Tribunal',
    baseUrl: 'https://www.chrt-tcdp.gc.ca',
    searchUrl: 'https://www.chrt-tcdp.gc.ca/en/decisions',
    hasDecisions: true,
  },
};
