// SPDX-License-Identifier: Apache-2.0
/**
 * Advanced Usage Example
 *
 * Demonstrates error handling, query options, and MCP integration
 */

import { MapleSpike, QuillError } from '@maplespike/sdk';

const ms = new MapleSpike({
  apiKey: process.env.QUILL_API_KEY,
  baseUrl: 'http://127.0.0.1:8082',
});

async function advancedUsage() {
  try {
    // Using generic query with options
    const data = await ms.query('immigration', 'permanent-residents',
      { province: 'ON', year: 2025 },
      {
        _mock: false,           // Use real data
        _fields: 'year,count',  // Field projection
        _format: 'compact',     // Compact output
        _limit: 100,            // Max records
        _page: 1,               // Pagination
        _summary: true,         // Summary only
      },
    );
    console.log('Data with options:', data.data);

    // Error handling
    try {
      await ms.corporate.profile({ businessNumber: 'invalid' });
    } catch (error) {
      if (error instanceof QuillError) {
        console.error('API Error:', error.code, error.message, error.status);
        console.error('Request ID:', error.requestId);
      }
    }

    // Using JWT authentication instead of API key
    const msJwt = new MapleSpike({
      jwtToken: process.env.QUILL_JWT_TOKEN,
      baseUrl: 'http://127.0.0.1:8082',
    });

    // Get MCP configuration
    const mcpConfig = ms.getMcpConfig();
    console.log('MCP Configuration:', mcpConfig);

    // Chained queries
    const committeesData = await ms
      .agent('committees')
      .action('committee-membership', {
        parliament: 44,
        chamber: 'commons',
      });
    console.log('Chained query result:', committeesData.data);

    // Dynamic auth management
    console.log('Initially authenticated:', ms.isAuthenticated());
    ms.clearAuth();
    console.log('After clearAuth:', ms.isAuthenticated());
    ms.apiKey = process.env.QUILL_API_KEY;
    console.log('After setting new key:', ms.isAuthenticated());

  } catch (error) {
    console.error('Error:', error);
  }
}

advancedUsage();