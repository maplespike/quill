import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse } from '../response.js';

const SAMPLE_REAL_ESTATE = [
  { source: 'cmhc', title: 'Housing Starts, April 2026', value: '245,678', change: '+5.2%', period: 'April 2026', jurisdiction: 'federal', category: 'starts' },
  { source: 'cmhc', title: 'Vacancy Rate, April 2026', value: '1.8%', change: '-0.2pp', period: 'April 2026', jurisdiction: 'federal', category: 'vacancy' },
  { source: 'crea', title: 'Home Sales, April 2026', value: '42,156', change: '+3.8%', period: 'April 2026', jurisdiction: 'federal', category: 'sales' },
  { source: 'crea', title: 'Average Home Price, April 2026', value: '$729,450', change: '+1.5%', period: 'April 2026', jurisdiction: 'federal', category: 'price' },
  { source: 'land-registry', title: 'Land Registry Transactions, Q1 2026', value: '89,234', change: '-1.2%', period: 'Q1 2026', jurisdiction: 'federal', category: 'transactions' },
  { source: 'rental-registry', title: 'Rental Registrations, Q1 2026', value: '12,456', change: '+8.3%', period: 'Q1 2026', jurisdiction: 'federal', category: 'rental' },
];

export const realEstateDataHandler: RouteHandler = async (request, ctx) => {
  const url = new URL(request.url);
  const category = url.searchParams.get('category');
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);
  let data = SAMPLE_REAL_ESTATE;
  if (category) data = data.filter(d => d.category === category);
  data = data.slice(0, limit);
  return jsonResponse(buildSuccess({ records: data, total: data.length, category }, ctx));
};
