// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolModule } from './index.js';
import * as comtrade from './un-comtrade.js';

export const comtradeByPartner: ToolModule = {
  definition: comtrade.getComtradeByPartnerDefinition,
  handler: comtrade.getComtradeByPartnerHandler,
};

export const comtradeByCommodity: ToolModule = {
  definition: comtrade.getComtradeByCommodityDefinition,
  handler: comtrade.getComtradeByCommodityHandler,
};

export const comtradeTrends: ToolModule = {
  definition: comtrade.getComtradeTrendsDefinition,
  handler: comtrade.getComtradeTrendsHandler,
};
