# ---------------------------------------------------------------------------
# Quill SDK — Main entry point
# ---------------------------------------------------------------------------

"""
Quill Python SDK (pyproject: `quill-sdk`, import path: `quill`) — typed
client for the MapleSpike civilian intelligence API.

> Renamed 2026-07-03 — the module directory was previously `maplespike/`.
> `MapleSpike` (and `QuillClient`, `QuillResponse`, etc.) remain
> as the public class names because they're brand-level identifiers per
> ADR 0007's product-vs-brand split — only the *import path* moved.

Usage:

    from quill import MapleSpike

    ms = MapleSpike(api_key='ms_live_...')
    result = ms.query('committees', 'committee-membership', {'parliament': 44})
    print(result.data)

    # Chained API
    result = ms.agent('committees').action('committee-membership', parliament=44)
"""

from typing import Any, Dict, Optional

from .types import (
    QuillResponse,
    QueryOptions,
    ResponseMeta,
    ResponseQuality,
    Citation,
    QuillApiError,
    QuillError,
    AgentDefinition,
    ActionDefinition,
)
from .client import (
    DEFAULT_BASE_URL,
    resolve_base_url,
    build_url,
    build_headers,
    parse_response,
    _make_request,
    get_bilingual_error,
)
from .auth import get_api_key, set_api_key, get_jwt_token, set_jwt_token, clear_auth, is_authenticated
from .agents import AGENTS, get_agent, list_agents, list_actions
from .langchain_adapter import get_maplespike_tools
from .high_level import (
    QuillClient,
    Search,
    EntityResolution,
    Ingestion,
)

__all__ = [
    # Core types
    'MapleSpike',
    'QuillClient',
    'QuillResponse',
    'QuillError',
    'QuillApiError',
    'QueryOptions',
    'ResponseMeta',
    'ResponseQuality',
    'Citation',
    'AgentDefinition',
    'ActionDefinition',
    # Domain classes
    'Search',
    'EntityResolution',
    'Ingestion',
    # Agent catalogue
    'get_agent',
    'list_agents',
    'list_actions',
    'AGENTS',
    # Auth
    'get_api_key',
    'set_api_key',
    'get_jwt_token',
    'set_jwt_token',
    'clear_auth',
    'is_authenticated',
    # LangChain
    'get_maplespike_tools',
]


class AgentProxy:
    """Proxy object returned by MapleSpike.agent() for chained queries."""

    def __init__(self, client: 'MapleSpike', agent_name: str):
        self._client = client
        self._agent = agent_name

    def agent(self, name: str) -> 'AgentProxy':
        """Switch to a different agent within the chain."""
        return AgentProxy(self._client, name)

    def action(
        self,
        action: str,
        *,
        fields: Optional[str] = None,
        format: Optional[str] = None,
        limit: Optional[int] = None,
        page: Optional[int] = None,
        normalize: Optional[bool] = None,
        units: Optional[str] = None,
        summary: Optional[bool] = None,
        **params: Any,
    ) -> QuillResponse:
        """Execute an action against the currently selected agent.

        Keyword arguments prefixed with an underscore are treated as query options.
        All other keyword arguments are passed as action parameters.

        Returns:
            QuillResponse with the query result.
        """
        options: Dict[str, Any] = {}
        if fields is not None:
            options['fields'] = fields
        if format is not None:
            options['format'] = format
        if limit is not None:
            options['limit'] = limit
        if page is not None:
            options['page'] = page
        if normalize is not None:
            options['normalize'] = normalize
        if units is not None:
            options['units'] = units
        if summary is not None:
            options['summary'] = summary

        return self._client.query(self._agent, action, params, **options)


class MapleSpike:
    """Typed client for the MapleSpike civilian intelligence API.

    Args:
        api_key: MapleSpike API key.
        base_url: Base URL of the API. Defaults to https://api.maplespike.ca.
        jwt_token: JWT token for authentication (alternative to api_key).
        lang: Language for error messages: 'en' (default) or 'fr'.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        jwt_token: Optional[str] = None,
        lang: str = 'en',
    ):
        self._api_key: Optional[str] = api_key
        self._jwt_token: Optional[str] = jwt_token
        self._base_url: str = resolve_base_url(base_url)
        self._lang: str = lang

        # Sync to auth module
        if api_key:
            set_api_key(api_key)
        if jwt_token:
            set_jwt_token(jwt_token)

    # ─── Configuration Properties ───────────────────────────────────────────

    @property
    def api_key(self) -> Optional[str]:
        return self._api_key

    @api_key.setter
    def api_key(self, key: Optional[str]) -> None:
        self._api_key = key
        set_api_key(key)

    @property
    def jwt_token(self) -> Optional[str]:
        return self._jwt_token

    @jwt_token.setter
    def jwt_token(self, token: Optional[str]) -> None:
        self._jwt_token = token
        set_jwt_token(token)

    @property
    def base_url(self) -> str:
        return self._base_url

    @base_url.setter
    def base_url(self, url: str) -> None:
        self._base_url = resolve_base_url(url)

    @property
    def lang(self) -> str:
        return self._lang

    @lang.setter
    def lang(self, l: str) -> None:
        self._lang = l

    # ─── Auth helpers ──────────────────────────────────────────────────────

    def clear_auth(self) -> None:
        """Full-reset of auth state."""
        self._api_key = None
        self._jwt_token = None
        clear_auth()

    def is_authenticated(self) -> bool:
        """Check whether any auth is configured."""
        return bool(self._api_key or self._jwt_token)

    # ─── Query API ─────────────────────────────────────────────────────────

    def query(
        self,
        agent: str,
        action: str,
        params: Optional[Dict[str, Any]] = None,
        *,
        fields: Optional[str] = None,
        format: Optional[str] = None,
        limit: Optional[int] = None,
        page: Optional[int] = None,
        normalize: Optional[bool] = None,
        units: Optional[str] = None,
        summary: Optional[bool] = None,
    ) -> QuillResponse:
        """Execute a structured query against a MapleSpike agent action.

        Args:
            agent: Agent name (e.g. "committees", "corporate").
            action: Action name (e.g. "committee-membership", "corporation-profile").
            params: Action-specific parameters as a dict.
            fields: Comma-separated field projection.
            format: Output format hint: normal, compact, full.
            limit: Max records to return.
            page: Page number for paginated results.
            normalize: Normalize response structure.
            units: Unit system for measurements.
            summary: Request a summary instead of raw data.

        Returns:
            QuillResponse with the query result.

        Raises:
            RuntimeError: If no API key or JWT token is configured — the
                client must be authenticated to call the live API.
        """
        # Build options dict from keyword-only args
        options: Dict[str, Any] = {}
        if fields is not None:
            options['fields'] = fields
        if format is not None:
            options['format'] = format
        if limit is not None:
            options['limit'] = limit
        if page is not None:
            options['page'] = page
        if normalize is not None:
            options['normalize'] = normalize
        if units is not None:
            options['units'] = units
        if summary is not None:
            options['summary'] = summary

        if not self.is_authenticated():
            raise RuntimeError(
                'No API key or JWT token configured. '
                'The mock data module has been removed. '
                'Provide credentials to connect to the live MapleSpike API:\n\n'
                '    ms = MapleSpike(api_key="ms_live_...")\n'
                '    result = ms.query("committees", "committee-membership", ...)\n\n'
                'See https://quill.maplespike.ca/docs for an API key.'
            )

        url = build_url(self._base_url, agent, action, params, options)
        headers = build_headers(self._api_key, self._jwt_token)
        # Pass language preference via header
        if self._lang and self._lang != 'en':
            headers['Accept-Language'] = self._lang

        status, body, resp_headers = _make_request(url, headers)
        return parse_response(status, body, agent, action, self._lang)

    # ─── Chained API ───────────────────────────────────────────────────────

    def agent(self, name: str) -> AgentProxy:
        """Begin a chained query: ms.agent('committees').action('committee-membership', ...)

        Returns an AgentProxy that allows method chaining.
        """
        return AgentProxy(self, name)
