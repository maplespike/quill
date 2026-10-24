// SPDX-License-Identifier: AGPL-3.0-only

import type { ToolDefinition, ToolHandler } from './types.js';

const VALID_INDICATORS = ['HDI', 'IHDI', 'GDI', 'GII', 'PHDI', 'MPI'];

export const searchUndpHdrDefinition: ToolDefinition = {
  name: 'search_undp_hdr',
  description: 'Search UNDP Human Development Reports data by indicator code, country, year range, and value range. Covers HDI, IHDI, GDI, GII, PHDI, and MPI indicators.',
  inputSchema: {
    type: 'object',
    properties: {
      indicatorCode: {
        type: 'string',
        enum: VALID_INDICATORS,
        description: 'UNDP HDR indicator code: HDI, IHDI, GDI, GII, PHDI, or MPI',
      },
      country: {
        type: 'string',
        maxLength: 500,
        description: 'ISO-3 country code (e.g., CAN, USA, GBR)',
      },
      minYear: {
        type: 'number',
        description: 'Minimum year (inclusive)',
      },
      maxYear: {
        type: 'number',
        description: 'Maximum year (inclusive)',
      },
      minValue: {
        type: 'number',
        description: 'Minimum indicator value (inclusive)',
      },
      maxValue: {
        type: 'number',
        description: 'Maximum indicator value (inclusive)',
      },
    },
    required: ['indicatorCode'],
  },
};

export const getUndpHdrIndicatorDefinition: ToolDefinition = {
  name: 'get_undp_hdr_indicator',
  description: 'Ingest UNDP Human Development Reports indicator data for a specific indicator code',
  inputSchema: {
    type: 'object',
    properties: {
      indicatorCode: {
        type: 'string',
        enum: VALID_INDICATORS,
        description: 'UNDP HDR indicator code: HDI, IHDI, GDI, GII, PHDI, or MPI',
      },
      country: {
        type: 'string',
        maxLength: 500,
        description: 'ISO-3 country code (optional)',
      },
      yearRange: {
        type: 'string',
        description: 'Year range in format "YYYY:YYYY" (optional)',
      },
    },
    required: ['indicatorCode'],
  },
};

export const getAllUndpHdrDefinition: ToolDefinition = {
  name: 'get_all_undp_hdr',
  description: 'Ingest all UNDP Human Development Reports indicators (HDI, IHDI, GDI, GII, PHDI, MPI)',
  inputSchema: {
    type: 'object',
    properties: {
      country: {
        type: 'string',
        maxLength: 500,
        description: 'ISO-3 country code (optional)',
      },
      yearRange: {
        type: 'string',
        description: 'Year range in format "YYYY:YYYY" (optional)',
      },
    },
  },
};

export const searchUndpHdrHandler: ToolHandler = async () => {
  return {
    content: {
      tool: 'search_undp_hdr',
      error: 'UNDP HDR module not yet implemented',
    },
    isError: true,
  };
};

export const getUndpHdrIndicatorHandler: ToolHandler = async () => {
  return {
    content: {
      tool: 'get_undp_hdr_indicator',
      error: 'UNDP HDR module not yet implemented',
    },
    isError: true,
  };
};

export const getAllUndpHdrHandler: ToolHandler = async () => {
  return {
    content: {
      tool: 'get_all_undp_hdr',
      error: 'UNDP HDR module not yet implemented',
    },
    isError: true,
  };
};
