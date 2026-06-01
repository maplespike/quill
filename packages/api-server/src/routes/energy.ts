import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse } from '../response.js';

const SAMPLE_ENERGY = [
  { source: 'statcan', title: 'Crude Oil Production, March 2026', value: '23.4M m³', change: '+2.1%', period: 'March 2026', jurisdiction: 'federal', category: 'oil' },
  { source: 'statcan', title: 'Natural Gas Production, March 2026', value: '15.8B m³', change: '-0.5%', period: 'March 2026', jurisdiction: 'federal', category: 'gas' },
  { source: 'statcan', title: 'Electricity Generation, March 2026', value: '58.2 TWh', change: '+1.3%', period: 'March 2026', jurisdiction: 'federal', category: 'electricity' },
  { source: 'statcan', title: 'Mineral Production, Q1 2026', value: '$12.8B', change: '+3.7%', period: 'Q1 2026', jurisdiction: 'federal', category: 'mining' },
];

export const energyDataHandler: RouteHandler = async (request, ctx) => {
  const url = new URL(request.url);
  const category = url.searchParams.get('category');
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);
  let data = SAMPLE_ENERGY;
  if (category) data = data.filter(d => d.category === category);
  data = data.slice(0, limit);
  return jsonResponse(buildSuccess({ records: data, total: data.length, category }, ctx));
};
