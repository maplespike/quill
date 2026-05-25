export const OGL_CA_ATTRIBUTION =
  'Source: Government of Canada data licensed under the Open Government Licence – Canada (https://open.canada.ca/en/open-government-licence-canada).';

export function addAttributionHeader(response: Response): Response {
  response.headers.set('X-Attribution-Notice', OGL_CA_ATTRIBUTION);
  return response;
}
