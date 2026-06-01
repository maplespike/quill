import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse } from '../response.js';

const MUNICIPAL_DATA: Array<{ city: string; province: string; dataset: string; records: number; last_updated: string }> = [
  { city: 'toronto', province: 'ontario', dataset: 'licensed-businesses', records: 154200, last_updated: '2026-05-30' },
  { city: 'toronto', province: 'ontario', dataset: 'property-assessments', records: 874500, last_updated: '2026-04-15' },
  { city: 'montreal', province: 'quebec', dataset: 'permits-construction', records: 9850, last_updated: '2026-05-28' },
  { city: 'montreal', province: 'quebec', dataset: 'crime-statistics', records: 45700, last_updated: '2026-05-01' },
  { city: 'vancouver', province: 'british-columbia', dataset: 'business-licenses', records: 125300, last_updated: '2026-05-29' },
  { city: 'vancouver', province: 'british-columbia', dataset: 'building-permits', records: 14500, last_updated: '2026-05-27' },
  { city: 'calgary', province: 'alberta', dataset: 'property-tax', records: 532000, last_updated: '2026-05-15' },
  { city: 'calgary', province: 'alberta', dataset: 'business-registry', records: 98500, last_updated: '2026-05-20' },
  { city: 'edmonton', province: 'alberta', dataset: 'development-permits', records: 11200, last_updated: '2026-05-26' },
  { city: 'edmonton', province: 'alberta', dataset: 'property-assessments', records: 421000, last_updated: '2026-04-18' },
  { city: 'ottawa', province: 'ontario', dataset: 'civic-addresses', records: 365000, last_updated: '2026-05-10' },
  { city: 'ottawa', province: 'ontario', dataset: 'building-permits', records: 8700, last_updated: '2026-05-25' },
  { city: 'winnipeg', province: 'manitoba', dataset: 'property-data', records: 315000, last_updated: '2026-04-22' },
  { city: 'winnipeg', province: 'manitoba', dataset: 'assessment-roll', records: 298000, last_updated: '2026-05-08' },
  { city: 'mississauga', province: 'ontario', dataset: 'development-applications', records: 6500, last_updated: '2026-05-28' },
  { city: 'mississauga', province: 'ontario', dataset: 'property-information', records: 512000, last_updated: '2026-05-12' },
  { city: 'burnaby', province: 'british-columbia', dataset: 'business-licenses', records: 18500, last_updated: '2026-05-27' },
  { city: 'burnaby', province: 'british-columbia', dataset: 'development-permits', records: 4200, last_updated: '2026-05-23' },
  { city: 'surrey', province: 'british-columbia', dataset: 'building-permits', records: 9800, last_updated: '2026-05-26' },
  { city: 'surrey', province: 'british-columbia', dataset: 'business-licenses', records: 42500, last_updated: '2026-05-25' },
];

export const municipalDataHandler: RouteHandler = async (request, ctx) => {
  const url = new URL(request.url);
  const city = url.searchParams.get('city');
  const dataset = url.searchParams.get('dataset');
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);
  let data = MUNICIPAL_DATA;
  if (city) data = data.filter(d => d.city === city.toLowerCase());
  if (dataset) data = data.filter(d => d.dataset === dataset.toLowerCase());
  data = data.slice(0, limit);
  return jsonResponse(buildSuccess({ records: data, total: data.length }, ctx));
};

export const municipalCityHandler: RouteHandler = async (request, ctx) => {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const city = pathParts[3];
  if (!city) return jsonResponse(buildError('VALIDATION_ERROR', 'City parameter required', ctx), 400);
  const dataset = url.searchParams.get('dataset');
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);
  const data = MUNICIPAL_DATA.filter(d => d.city === city.toLowerCase() && (!dataset || d.dataset === dataset.toLowerCase())).slice(0, limit);
  return jsonResponse(buildSuccess({ city, records: data, total: data.length }, ctx));
};