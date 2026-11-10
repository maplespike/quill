// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolModule } from './index.js';
import * as wdi from './worldbank-wdi.js';

export const wdiIndicator: ToolModule = {
  definition: wdi.getWDIIndicatorDefinition,
  handler: wdi.getWDIIndicatorHandler,
};

export const wdiCompareCountries: ToolModule = {
  definition: wdi.compareWDICountriesDefinition,
  handler: wdi.compareWDICountriesHandler,
};

export const wdiCountryProfile: ToolModule = {
  definition: wdi.getCountryWDIProfileDefinition,
  handler: wdi.getCountryWDIProfileHandler,
};

export const wdiTrend: ToolModule = {
  definition: wdi.analyzeIndicatorTrendDefinition,
  handler: wdi.analyzeIndicatorTrendHandler,
};

export const wdiTopic: ToolModule = {
  definition: wdi.fetchTopicIndicatorsDefinition,
  handler: wdi.fetchTopicIndicatorsHandler,
};

export const wdiMetadata: ToolModule = {
  definition: wdi.getIndicatorMetadataDefinition,
  handler: wdi.getIndicatorMetadataHandler,
};
