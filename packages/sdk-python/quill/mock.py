# ---------------------------------------------------------------------------
# Quill SDK — Mock module (removed)
# ---------------------------------------------------------------------------
#
# The hardcoded mock data previously in this module has been removed.
# Users must connect to the real MapleSpike API.
#
# Provide an API key or JWT token to the MapleSpike client:
#
#     from quill import MapleSpike
#     ms = MapleSpike(api_key='ms_live_...')
#     result = ms.query('committees', 'committee-membership', {'parliament': 44})
#
# See https://maplespike.ca/docs for API key registration.
# ---------------------------------------------------------------------------

from typing import Any

from .types import QuillResponse, ResponseMeta, ResponseQuality, Citation


NO_MOCK_MESSAGE = (
    'Hardcoded mock data has been removed. '
    'To use the Quill SDK, connect to the live MapleSpike API by providing '
    'an api_key or jwt_token to the MapleSpike() constructor, or set the '
    'QUILL_API_KEY environment variable.\n\n'
    '    ms = MapleSpike(api_key="ms_live_...")\n'
    '    result = ms.query("committees", "committee-membership", {"parliament": 44})\n\n'
    'See https://maplespike.ca/docs for an API key.'
)


def get_mock_response(agent: str, action: str) -> QuillResponse:
    """Raise a clear error — mock data has been removed.

    Previously this returned hardcoded synthetic data. Callers must now
    connect to the real MapleSpike API.
    """
    raise RuntimeError(NO_MOCK_MESSAGE)
