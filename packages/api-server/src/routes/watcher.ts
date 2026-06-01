import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse } from '../response.js';

export const watcherStatusHandler: RouteHandler = async (request, ctx) => {
  return jsonResponse(buildSuccess({
    status: 'operational',
    description: 'Real-time change watcher monitors data sources for updates',
    watchedSources: [
      { id: 'lobbying', name: 'Lobbying Registry', type: 'csv', intervalMs: 3600000 },
      { id: 'procurement', name: 'CanadaBuys Procurement', type: 'rss', intervalMs: 3600000 },
      { id: 'committees', name: 'House Committees', type: 'xml', intervalMs: 1800000 },
      { id: 'gazette', name: 'Canada Gazette', type: 'rss', intervalMs: 3600000 },
      { id: 'eccc-alerts', name: 'ECCC Weather Alerts', type: 'cap', intervalMs: 600000 },
    ],
    totalSources: 5,
  }, ctx));
};

export const watcherEventsHandler: RouteHandler = async (request, ctx) => {
  const url = new URL(request.url);
  const sourceId = url.searchParams.get('sourceId');
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);

  return jsonResponse(buildSuccess({
    events: [],
    total: 0,
    sourceId: sourceId || null,
    limit,
    message: 'Change events are stored in the SQLite watcher_changelog table. Access via pipeline-core SqliteWatcherStore.',
  }, ctx));
};
