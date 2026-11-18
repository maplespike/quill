// SPDX-License-Identifier: Apache-2.0
/**
 * Basic Usage Example
 *
 * Demonstrates how to get started with the MapleSpike SDK
 */

import { MapleSpike } from '@maplespike/sdk';

// Initialize the client with an API key
const ms = new MapleSpike({
  apiKey: process.env.QUILL_API_KEY,
  baseUrl: 'http://127.0.0.1:8082', // or https://api.maplespike.ca for production
});

async function basicUsage() {
  try {
    // Check authentication
    console.log('Authenticated:', ms.isAuthenticated());

    // Query immigration data
    const immigration = await ms.immigration.permanentResidents({
      province: 'ON',
      year: 2025,
      limit: 10,
    });
    console.log('Immigration data:', immigration.data);
    console.log('Metadata:', immigration.meta);
    console.log('Quality:', immigration.quality);

    // Query committee meetings
    const meetings = await ms.committees.meetings({
      parliament: 44,
      chamber: 'commons',
    });
    console.log('Committee meetings:', meetings.data);

    // Query lobbying activities
    const lobbying = await ms.corporate.lobbying({
      subject: 'healthcare',
      limit: 5,
    });
    console.log('Lobbying activities:', lobbying.data);

    // Generic query (for endpoints not covered by domain methods)
    const generic = await ms.query('regulations', 'regulatory-proposals', {
      status: 'open',
      limit: 3,
    });
    console.log('Generic query result:', generic.data);

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the example
basicUsage();