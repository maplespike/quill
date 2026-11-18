// SPDX-License-Identifier: AGPL-3.0-only
import type { MediaSource } from './types.js';

export interface MediaSourceConfig {
  source: MediaSource;
  name: string;
  url: string;
  description: string;
  enabled: boolean;
}

export const MEDIA_SOURCES: MediaSourceConfig[] = [
  {
    source: 'crtc-market-reports',
    name: 'CRTC Communications Market Reports',
    url: 'https://crtc.gc.ca/eng/publications/reports/policymonitoring/cmrd.htm',
    description: '400+ datasets — broadcasting ownership, revenues, tuning, internet/wireless prices',
    enabled: true,
  },
  {
    source: 'crtc-ownership',
    name: 'CRTC Broadcasting Ownership Charts',
    url: 'https://crtc.gc.ca/ownership/eng/',
    description: 'Media ownership charts showing corporate control of broadcasting assets',
    enabled: true,
  },
  {
    source: 'canada-media-fund',
    name: 'Canada Media Fund',
    url: 'https://www.cmf-fmc.ca/open-data',
    description: 'CMF investment in Canadian television, digital media, and film production',
    enabled: true,
  },
  {
    source: 'telefilm',
    name: 'Telefilm Canada',
    url: 'https://telefilm.ca/en/studies-and-reports',
    description: 'Telefilm production funding and program data',
    enabled: true,
  },
  {
    source: 'online-news-act',
    name: 'Online News Act Payments',
    url: 'https://www.canada.ca/en/canadian-heritage/services/online-news.html',
    description: 'Google and Meta payments to Canadian news organizations under Bill C-18',
    enabled: true,
  },
  {
    source: 'cbc-financials',
    name: 'CBC/Radio-Canada Financials',
    url: 'https://cbc.radio-canada.ca/en/impact-and-accountability/financials',
    description: 'CBC annual reports, audience metrics, and parliamentary appropriation data',
    enabled: true,
  },
];

export const MEDIA_FETCH_TIMEOUT_MS = 15_000;
export const MEDIA_USER_AGENT = 'MapleSpike-Media/1.0 (+https://github.com/reverb256/quill)';
export const MAX_MEDIA_RECORDS = 200;
