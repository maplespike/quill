# ---------------------------------------------------------------------------
# Quill SDK — Core type definitions
# ---------------------------------------------------------------------------

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class ResponseMeta:
    """Request metadata returned by the API."""
    request_id: str = ''
    agent: str = ''
    action: str = ''
    auth_method: str = 'none'
    credits_charged: int = 0
    cache_status: str = 'miss'
    duration_ms: int = 0


@dataclass
class ResponseQuality:
    """Data-quality signals."""
    freshness_seconds: int = 0
    source_uptime_7d: float = 1.0
    confidence: float = 0.95
    certainty_score: float = 0.9
    last_verified: str = ''
    data_completeness: str = ''


@dataclass
class Citation:
    """Source attribution."""
    source_name: str = ''
    source_url: str = ''
    license: str = ''
    data_hash: str = ''
    retrieved_at: str = ''
    update_frequency: str = ''
    original_format: str = ''
    citation_text: str = ''
    citation_footnote: str = ''


@dataclass
class QuillResponse:
    """Structured query payload returned by the API."""
    success: bool = True
    data: Any = None
    text: str = ''
    error: Optional[str] = None
    meta: Optional[ResponseMeta] = None
    quality: Optional[ResponseQuality] = None
    citation: Optional[Citation] = None

    def __post_init__(self):
        if self.meta is None:
            self.meta = ResponseMeta()
        if self.quality is None:
            self.quality = ResponseQuality()
        if self.citation is None:
            self.citation = Citation()

    def __repr__(self):
        return (
            f"QuillResponse(success={self.success}, "
            f"agent={self.meta.agent!r}, action={self.meta.action!r}, "
            f"data={self.data!r})"
        )


@dataclass
class QueryOptions:
    """Options that modify how a query is sent or transformed."""
    fields: Optional[str] = None
    format: Optional[str] = None
    limit: Optional[int] = None
    page: Optional[int] = None
    normalize: Optional[bool] = None
    units: Optional[str] = None
    summary: Optional[bool] = None


@dataclass
class QuillApiError:
    """Error information from the API."""
    status: int = 0
    code: str = ''
    message: str = ''
    message_fr: str = ''
    request_id: Optional[str] = None


class QuillError(Exception):
    """Exception raised for API errors."""

    def __init__(self, err: 'QuillApiError'):
        self.status = err.status
        self.code = err.code
        self.request_id = err.request_id
        self.message_en = err.message
        self.message_fr = err.message_fr or ''
        super().__init__(err.message)


@dataclass
class ActionDefinition:
    """Definition of an API action."""
    id: str = ''
    description: str = ''
    required_params: List[str] = field(default_factory=list)
    optional_params: List[str] = field(default_factory=list)
    sample_curl: str = ''


@dataclass
class AgentDefinition:
    """Definition of an API agent."""
    name: str = ''
    description: str = ''
    actions: List[ActionDefinition] = field(default_factory=list)
