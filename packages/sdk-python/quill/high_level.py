# ---------------------------------------------------------------------------
# Quill SDK — High-level client with convenience methods
# ---------------------------------------------------------------------------
"""
High-level client for the MapleSpike API.

Provides ``QuillClient`` with convenience methods for search,
AI-powered question answering, entity resolution, and data quality
inspection, plus standalone ``Search``, ``EntityResolution``, and
``Ingestion`` helpers.

Usage::

    from quill import QuillClient

    client = QuillClient(api_key="msk_live_...")

    # Search across endpoints
    results = client.search("lobbying", agent="corporate")

    # AI-powered question answering
    answer = client.ask("What committees did MP Smith sit on in 2024?")

    # Entity resolution
    entity = client.entity_resolution(
        entity_type="corporation",
        query={"business_number": "123456789"},
    )

    # Data quality inspection
    quality = client.data_quality("corporate", "corporation-profile")
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from .types import QuillResponse


# ---------------------------------------------------------------------------
# Search helper
# ---------------------------------------------------------------------------

class Search:
    """Query builder for search operations across MapleSpike agents.

    This is a lightweight value-object that holds search parameters.
    Use ``QuillClient.search(...)`` or construct directly and
    pass to ``QuillClient.run_search(...)``.

    Parameters
    ----------
    query:
        Free-text or structured search string.
    agent:
        Optional agent name to restrict the search to
        (e.g. ``"committees"``, ``"corporate"``).
    limit:
        Maximum number of records to return.
    page:
        Page number for paginated results.
    **extra:
        Additional agent-specific search parameters.
    """

    def __init__(
        self,
        query: str,
        agent: Optional[str] = None,
        limit: Optional[int] = None,
        page: Optional[int] = None,
        **extra: Any,
    ) -> None:
        self.query = query
        self.agent = agent
        self.limit = limit
        self.page = page
        self.extra = extra


# ---------------------------------------------------------------------------
# Entity resolution helper
# ---------------------------------------------------------------------------

class EntityResolution:
    """Entity resolution request — identify and disambiguate entities.

    Parameters
    ----------
    entity_type:
        The type of entity to resolve, e.g. ``"corporation"``,
        ``"person"``, ``"legislation"``.
    query:
        Dictionary of identifying attributes
        (e.g. ``{"business_number": "123456789"}``).
    confidence_threshold:
        Minimum confidence score (0.0 – 1.0) for results.
    """

    def __init__(
        self,
        entity_type: str,
        query: Dict[str, Any],
        confidence_threshold: float = 0.6,
    ) -> None:
        self.entity_type = entity_type
        self.query = query
        self.confidence_threshold = confidence_threshold


# ---------------------------------------------------------------------------
# Ingestion helper
# ---------------------------------------------------------------------------

class Ingestion:
    """Data ingestion descriptor — describes a dataset to upload.

    This is a metadata descriptor; actual upload requires the
    ``QuillClient.ingest()`` method (not yet implemented in this
    release — use the REST API directly for ingestion).

    Parameters
    ----------
    source_name:
        Human-readable name of the data source.
    source_url:
        Original source URL for the dataset.
    format:
        Data format (``"csv"``, ``"json"``, ``"xml"``, etc.).
    records:
        The records to ingest (list of dicts).
    """

    def __init__(
        self,
        source_name: str,
        source_url: Optional[str] = None,
        format: str = "json",
        records: Optional[List[Dict[str, Any]]] = None,
    ) -> None:
        self.source_name = source_name
        self.source_url = source_url
        self.format = format
        self.records = records or []


# ---------------------------------------------------------------------------
# High-level client
# ---------------------------------------------------------------------------

class QuillClient:
    """High-level client for the MapleSpike API with convenience methods.

    Wraps the core :class:`MapleSpike` client and provides ergonomic
    methods for common tasks.

    Parameters
    ----------        api_key:
            MapleSpike API key.  Falls back to the
            :func:`quill.auth.get_api_key` module-level value.
    base_url:
        Base URL of the API (default: ``https://api.maplespike.ca``).
    jwt_token:
        JWT token for authentication (alternative to ``api_key``).
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        jwt_token: Optional[str] = None,
        lang: str = 'en',
    ) -> None:
        # Lazy import to avoid circular dependency
        from . import MapleSpike  # noqa: PLC0415

        self._client = MapleSpike(
            api_key=api_key,
            base_url=base_url,
            jwt_token=jwt_token,
            lang=lang,
        )

    # ── Convenience accessors ──────────────────────────────────────────

    @property
    def api_key(self) -> Optional[str]:
        return self._client.api_key

    @api_key.setter
    def api_key(self, value: Optional[str]) -> None:
        self._client.api_key = value

    @property
    def base_url(self) -> str:
        return self._client.base_url

    @base_url.setter
    def base_url(self, url: str) -> None:
        self._client.base_url = url

    # ── Core query passthrough ─────────────────────────────────────────

    def query(
        self,
        agent: str,
        action: str,
        params: Optional[Dict[str, Any]] = None,
        **options: Any,
    ) -> QuillResponse:
        """Execute a structured query (passthrough to :meth:`MapleSpike.query`).

        See :class:`MapleSpike` for full parameter documentation.
        """
        return self._client.query(agent, action, params, **options)

    # ── Search ─────────────────────────────────────────────────────────

    def search(
        self,
        query: str,
        agent: Optional[str] = None,
        limit: Optional[int] = None,
        page: Optional[int] = None,
        **extra: Any,
    ) -> QuillResponse:
        """Search across MapleSpike endpoints.

        When ``agent`` is provided the search is scoped to that agent's
        ``search`` action.  Otherwise a meta-search is attempted against
        the ``_search`` virtual endpoint.

        Parameters
        ----------
        query:
            Free-text or structured search string.
        agent:
            Optional agent name to restrict the search.
        limit:
            Maximum number of results.
        page:
            Page number for paginated results.
        **extra:
            Additional agent-specific search parameters.

        Returns
        -------
        QuillResponse
            The search results.
        """
        if agent:
            return self._client.query(
                agent,
                "search",
                {"q": query, **extra},
                limit=limit,
                page=page,
            )
        # Meta-search across all agents
        return self._client.query(
            "_search",
            "query",
            {"q": query, **extra},
            limit=limit,
            page=page,
        )

    # ── AI-powered question answering ──────────────────────────────────

    def ask(
        self,
        prompt: str,
        agent: Optional[str] = None,
        **kwargs: Any,
    ) -> QuillResponse:
        """Ask a natural-language question and get an AI-generated answer.

        Delegates to the ``ask`` action on the specified agent (or the
        ``_ai`` virtual agent for cross-domain questions).

        Parameters
        ----------
        prompt:
            Natural-language question or instruction.
        agent:
            Optional agent name to scope the question
            (e.g. ``"committees"``).
        **kwargs:
            Additional parameters passed to the ``ask`` action.

        Returns
        -------
        QuillResponse
            The AI response with ``data`` containing the answer.
        """
        target_agent = agent or "_ai"
        return self._client.query(
            target_agent,
            "ask",
            {"prompt": prompt, **kwargs},
        )

    # ── Entity resolution ──────────────────────────────────────────────

    def entity_resolution(
        self,
        entity_type: str,
        query: Dict[str, Any],
        confidence_threshold: float = 0.6,
    ) -> QuillResponse:
        """Resolve and disambiguate an entity across MapleSpike data sources.

        Parameters
        ----------
        entity_type:
            Type of entity to resolve (e.g. ``"corporation"``,
            ``"person"``, ``"legislation"``).
        query:
            Dictionary of identifying attributes.
        confidence_threshold:
            Minimum confidence for returned matches (0.0 – 1.0).

        Returns
        -------
        QuillResponse
            Resolved entity matches with confidence scores.
        """
        params: Dict[str, Any] = {
            "entity_type": entity_type,
            "query": json.dumps(query) if isinstance(query, dict) else query,
            "confidence_threshold": confidence_threshold,
        }
        return self._client.query("_resolve", "entity", params)

    # ── Data quality ───────────────────────────────────────────────────

    def data_quality(
        self,
        agent: str,
        action: str,
    ) -> QuillResponse:
        """Retrieve data-quality metadata for a specific agent action.

        Parameters
        ----------
        agent:
            Agent name (e.g. ``"corporate"``, ``"committees"``).
        action:
            Action name (e.g. ``"corporation-profile"``).

        Returns
        -------
        QuillResponse
            Quality metrics including freshness, completeness, and
            confidence scores.
        """
        return self._client.query(
            agent,
            action,
            {},
            summary=True,
            format="quality",
        )

    # ── Raw ingestion helper ───────────────────────────────────────────

    def ingest(
        self,
        source_name: str,
        records: List[Dict[str, Any]],
        source_url: Optional[str] = None,
        format: str = "json",
    ) -> QuillResponse:
        """Submit data records for ingestion into MapleSpike.

        .. note::

           Ingestion requires an authenticated API key with write
           permissions.  The ingestion endpoint is ``POST /v1/ingest``
           and this helper sends the data as JSON.

        Parameters
        ----------
        source_name:
            Human-readable name for the source.
        records:
            List of record dicts to ingest.
        source_url:
            Optional original source URL.
        format:
            Data format string (default ``"json"``).

        Returns
        -------
        QuillResponse
            Ingestion result including any validation errors.
        """
        return self._client.query(
            "_ingest",
            "submit",
            {
                "source_name": source_name,
                "source_url": source_url or "",
                "format": format,
                "records": json.dumps(records),
            },
        )
