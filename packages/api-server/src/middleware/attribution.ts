export const SOURCE_ATTRIBUTION_HEADER =
  'Source and license terms are dataset-specific. Review the response citation and source terms before reuse.';

export function addAttributionHeader(response: Response): Response {
  response.headers.set('X-Attribution-Notice', SOURCE_ATTRIBUTION_HEADER);
  return response;
}
