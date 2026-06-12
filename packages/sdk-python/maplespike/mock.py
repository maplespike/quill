# ---------------------------------------------------------------------------
# MapleSpike SDK — Mock module (removed)
# ---------------------------------------------------------------------------
#
# The hardcoded mock data previously in this module has been removed.
# Users must connect to the real MapleSpike API.
#
# Provide an API key or JWT token to the MapleSpike client:
#
#     from maplespike import MapleSpike
#     ms = MapleSpike(api_key='ms_live_...')
#     result = ms.query('committees', 'committee-membership', {'parliament': 44})
#
# See https://maplespike.ca/docs for API key registration.
# ---------------------------------------------------------------------------

from typing import Any

from .types import MapleSpikeResponse, ResponseMeta, ResponseQuality, Citation


NO_MOCK_MESSAGE = (
    'Hardcoded mock data has been removed. '
    'To use the MapleSpike SDK, connect to the live API by providing an '
    'api_key or jwt_token to the MapleSpike() constructor, or set the '
    'MAPLESPIKE_API_KEY environment variable.\n\n'
    '    ms = MapleSpike(api_key="ms_live_...")\n'
    '    result = ms.query("committees", "committee-membership", {"parliament": 44})\n\n'
    'See https://maplespike.ca/docs for an API key.'
)


def get_mock_response(agent: str, action: str) -> MapleSpikeResponse:
    """Raise a clear error — mock data has been removed.

    Previously this returned hardcoded synthetic data. Callers must now
    connect to the real MapleSpike API.
    """
    raise RuntimeError(NO_MOCK_MESSAGE)
