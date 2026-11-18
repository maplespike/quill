# SPDX-License-Identifier: Apache-2.0
# ---------------------------------------------------------------------------
# Quill SDK — URL builder, headers, response parsing
# ---------------------------------------------------------------------------

import json
import urllib.request
import urllib.error
import urllib.parse
from typing import Any, Dict, Optional, Tuple

from .types import QuillResponse, QuillApiError, QuillError, ResponseMeta, ResponseQuality, Citation
from .auth import get_api_key, get_jwt_token

DEFAULT_BASE_URL = 'https://api.maplespike.ca'

# Bilingual error message map for SDK-generated errors
BILINGUAL_ERRORS: dict[str, dict[str, str]] = {
    'HTTP_ERROR': {
        'en': 'The server returned an unexpected response',
        'fr': 'Le serveur a renvoyé une réponse inattendue',
    },
    'NETWORK_ERROR': {
        'en': 'A network error occurred. Please check your connection.',
        'fr': 'Une erreur réseau est survenue. Vérifiez votre connexion.',
    },
}


def get_bilingual_error(code: str, lang: str = 'en') -> str:
    """Resolve a bilingual error message by code."""
    return BILINGUAL_ERRORS.get(code, BILINGUAL_ERRORS['HTTP_ERROR']).get(lang, BILINGUAL_ERRORS['HTTP_ERROR']['en'])


def resolve_base_url(custom_base_url: Optional[str] = None) -> str:
    """Determine the base URL."""
    if custom_base_url:
        return custom_base_url.rstrip('/')
    return DEFAULT_BASE_URL


def build_url(
    base: str,
    agent: str,
    action: str,
    params: Optional[Dict[str, Any]] = None,
    options: Optional[Dict[str, Any]] = None,
) -> str:
    """Build the full API URL for a query."""
    path = f'/v1/{urllib.parse.quote(agent, safe="")}/{urllib.parse.quote(action, safe="")}'
    url = urllib.parse.urljoin(base.rstrip('/') + '/', path.lstrip('/'))
    parsed = urllib.parse.urlparse(url)

    all_params: Dict[str, str] = {}

    if params:
        for k, v in params.items():
            if v is not None:
                all_params[k] = str(v)

    if options:
        if options.get('fields'):
            all_params['_fields'] = options['fields']
        if options.get('format'):
            all_params['_format'] = options['format']
        if options.get('limit') is not None:
            all_params['_limit'] = str(options['limit'])
        if options.get('page') is not None:
            all_params['_page'] = str(options['page'])
        if options.get('normalize') is not None:
            all_params['_normalize'] = str(options['normalize'])
        if options.get('units'):
            all_params['_units'] = options['units']
        if options.get('summary') is not None:
            all_params['_summary'] = str(options['summary'])

    query_string = urllib.parse.urlencode(all_params)
    parsed = parsed._replace(query=query_string)
    return urllib.parse.urlunparse(parsed)


def build_headers(api_key: Optional[str] = None, jwt_token: Optional[str] = None) -> Dict[str, str]:
    """Build request headers from auth config."""
    headers: Dict[str, str] = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    }

    key = api_key if api_key is not None else get_api_key()
    jwt = jwt_token if jwt_token is not None else get_jwt_token()

    if key:
        headers['X-API-Key'] = key
    if jwt:
        headers['Authorization'] = f'Bearer {jwt}'

    return headers


def _make_request(url: str, headers: Dict[str, str]) -> Tuple[int, Any, Dict[str, str]]:
    """Make an HTTP GET request and return (status, body_dict, response_headers)."""
    req = urllib.request.Request(url, headers=headers, method='GET')
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read().decode('utf-8'))
            resp_headers = dict(resp.headers)
            return (resp.status, body, resp_headers)
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read().decode('utf-8'))
        except (json.JSONDecodeError, UnicodeDecodeError):
            body = {}
        return (e.code, body, dict(e.headers))
    except urllib.error.URLError as e:
        # Network-level error (DNS failure, connection refused, etc.)
        return (0, {'error': str(e.reason)}, {})


def parse_response(
    status: int,
    body: Any,
    agent: str = '',
    action: str = '',
    lang: str = 'en',
) -> QuillResponse:
    """Parse an API response into a QuillResponse."""
    if status == 0:
        # Network error
        err_msg = body.get('error', 'Network error') if isinstance(body, dict) else 'Network error'
        return QuillResponse(
            success=False,
            error=err_msg,
            meta=ResponseMeta(agent=agent, action=action, cache_status='error'),
            quality=ResponseQuality(),
            citation=Citation(),
        )

    if status >= 400:
        # API error
        api_error = QuillApiError(
            status=status,
            code=body.get('code', 'HTTP_ERROR') if isinstance(body, dict) else 'HTTP_ERROR',
            message=body.get('message', str(status)) if isinstance(body, dict) else str(status),
            message_fr=body.get('messageFr', '') if isinstance(body, dict) else '',
            request_id=body.get('requestId') if isinstance(body, dict) else None,
        )
        raise QuillError(api_error)

    # Successful response
    meta_dict = body.get('meta', {}) if isinstance(body, dict) else {}
    quality_dict = body.get('quality', {}) if isinstance(body, dict) else {}
    citation_dict = body.get('citation', {}) if isinstance(body, dict) else {}

    meta = ResponseMeta(
        request_id=meta_dict.get('requestId', ''),
        agent=meta_dict.get('agent', agent),
        action=meta_dict.get('action', action),
        auth_method=meta_dict.get('authMethod', 'none'),
        credits_charged=meta_dict.get('creditsCharged', 0),
        cache_status=meta_dict.get('cacheStatus', 'miss'),
        duration_ms=meta_dict.get('durationMs', 0),
    )

    quality = ResponseQuality(
        freshness_seconds=quality_dict.get('freshness_seconds', 0),
        source_uptime_7d=quality_dict.get('source_uptime_7d', 1.0),
        confidence=quality_dict.get('confidence', 0.95),
        certainty_score=quality_dict.get('certainty_score', 0.9),
        last_verified=quality_dict.get('last_verified', ''),
        data_completeness=quality_dict.get('data_completeness', ''),
    )

    citation = Citation(
        source_name=citation_dict.get('source_name', ''),
        source_url=citation_dict.get('source_url', ''),
        license=citation_dict.get('license', ''),
        data_hash=citation_dict.get('data_hash', ''),
        retrieved_at=citation_dict.get('retrieved_at', ''),
        update_frequency=citation_dict.get('update_frequency', ''),
        original_format=citation_dict.get('original_format', ''),
        citation_text=citation_dict.get('citation_text', ''),
        citation_footnote=citation_dict.get('citation_footnote', ''),
    )

    return QuillResponse(
        success=True,
        data=body.get('data') if isinstance(body, dict) else body,
        text=json.dumps(body) if not isinstance(body, str) else body,
        meta=meta,
        quality=quality,
        citation=citation,
    )
