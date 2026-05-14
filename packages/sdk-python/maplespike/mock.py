# ---------------------------------------------------------------------------
# MapleSpike SDK — Mock data provider for offline/client-side mode
# ---------------------------------------------------------------------------

import json
import time
from typing import Any, Dict

from .types import MapleSpikeResponse, ResponseMeta, ResponseQuality, Citation


def _base_meta(agent: str, action: str) -> ResponseMeta:
    return ResponseMeta(
        request_id=f'mock_{int(time.time() * 1000)}_{id(agent) & 0xFFFFFF:06x}',
        agent=agent,
        action=action,
        auth_method='none',
        credits_charged=0,
        cache_status='mock',
        duration_ms=0,
    )


_base_quality = ResponseQuality(
    freshness_seconds=0,
    source_uptime_7d=1.0,
    confidence=0.95,
    certainty_score=0.9,
)


def _base_citation(source: str = 'Mock Source', url: str = 'https://example.com/mock') -> Citation:
    return Citation(
        source_name=source,
        source_url=url,
        license='Mock Data — For Development Only',
        data_hash='mock',
        retrieved_at=time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        update_frequency='mock',
    )


def _ok(
    agent: str,
    action: str,
    data: Any,
    source: str = 'Mock Source',
    url: str = 'https://example.com/mock',
) -> MapleSpikeResponse:
    return MapleSpikeResponse(
        success=True,
        data=data,
        text=json.dumps(data),
        meta=_base_meta(agent, action),
        quality=_base_quality,
        citation=_base_citation(source, url),
    )


# ─── Committees ─────────────────────────────────────────────────────────────

_MOCK_COMMITTEE_MEMBERSHIP = [
    {'committee': 'Standing Committee on Finance', 'parliament': 44, 'chamber': 'Commons', 'member': 'John Doe', 'party': 'Liberal', 'role': 'Chair'},
    {'committee': 'Standing Committee on Finance', 'parliament': 44, 'chamber': 'Commons', 'member': 'Jane Smith', 'party': 'Conservative', 'role': 'Vice-Chair'},
    {'committee': 'Standing Committee on Health', 'parliament': 44, 'chamber': 'Commons', 'member': 'Alice Brown', 'party': 'NDP', 'role': 'Member'},
]

_MOCK_COMMITTEE_MEETINGS = [
    {'committee': 'Standing Committee on Finance', 'date': '2024-03-15', 'topic': 'Budget 2024 Pre-Study', 'notice': 'https://example.com/notice1'},
    {'committee': 'Standing Committee on Health', 'date': '2024-03-14', 'topic': 'Pharmacare Legislation', 'notice': 'https://example.com/notice2'},
]

_MOCK_COMMITTEE_REPORTS = [
    {'committee': 'Standing Committee on Finance', 'title': 'Report on Budget 2024', 'date': '2024-04-01', 'url': 'https://example.com/report1'},
]

_MOCK_COMMITTEE_WITNESSES = [
    {'committee': 'Standing Committee on Finance', 'witness': 'Mark Carney', 'date': '2024-03-15', 'topic': 'Monetary Policy'},
]

# ─── Corporate ──────────────────────────────────────────────────────────────

_MOCK_CORP_PROFILE = {
    'business_number': '123456789',
    'legal_name': 'Maple Innovations Inc.',
    'jurisdiction': 'Federal',
    'status': 'Active',
    'incorporation_date': '2010-06-15',
    'directors': ['Jane Doe', 'Bob Smith'],
}

_MOCK_CORP_FILINGS = [
    {'year': 2023, 'filing_type': 'Annual Return', 'status': 'Filed', 'date': '2023-12-01'},
    {'year': 2022, 'filing_type': 'Annual Return', 'status': 'Filed', 'date': '2022-11-30'},
]

_MOCK_DIRECTORS = [
    {'name': 'Jane Doe', 'corporation': 'Maple Innovations Inc.', 'appointment_date': '2010-06-15', 'status': 'Active'},
]

_MOCK_LOBBYING = [
    {'lobbyist': 'Stratos Health Consulting', 'client': 'PharmaCorp', 'subject': 'Healthcare Policy', 'date': '2024-02-10'},
]

# ─── Influence ──────────────────────────────────────────────────────────────

_MOCK_CONTRIBUTIONS = [
    {'donor': 'John Smith', 'party': 'Liberal', 'year': 2023, 'amount': 2500, 'riding': 'Toronto Centre'},
    {'donor': 'Jane Doe', 'party': 'Conservative', 'year': 2023, 'amount': 1500, 'riding': 'Calgary Centre'},
]

_MOCK_FUNDRAISING = [
    {'party': 'Liberal', 'event': 'Annual Gala', 'date': '2023-11-15', 'ticket_price': 500, 'location': 'Ottawa'},
    {'party': 'Conservative', 'event': 'Policy Conference', 'date': '2023-10-20', 'ticket_price': 350, 'location': 'Toronto'},
]

_MOCK_MEDIA_OWNERSHIP = [
    {'media_group': 'Postmedia Network', 'outlets': ['National Post', 'Ottawa Citizen', 'Vancouver Sun'], 'ownership': 'Private'},
]

# ─── Regulations ────────────────────────────────────────────────────────────

_MOCK_REG_PROPOSALS = [
    {'agency': 'CRTC', 'title': 'Online Streaming Act — Implementation Framework', 'status': 'Open for Comment', 'posted': '2024-01-15'},
]

_MOCK_REG_DECISIONS = [
    {'agency': 'CRTC', 'decision': 'Approval of Broadcast Licence Renewal', 'date': '2024-02-28', 'reference': 'CRTC-2024-001'},
]

_MOCK_COMMENTS = [
    {'proposal_id': 'GC-2024-001', 'commenter': 'XYZ Corp', 'summary': 'Opposes proposed data collection requirements', 'date': '2024-02-01'},
]

# ─── Courts ─────────────────────────────────────────────────────────────────

_MOCK_COURT_DECISIONS = [
    {'court': 'Supreme Court of Canada', 'case': 'R v. Smith', 'citation': '[2024] SCC 1', 'date': '2024-01-20', 'summary': 'Charter challenge to privacy legislation'},
]

_MOCK_CASES = [
    {'case_number': 'T-1234-24', 'court': 'Federal Court', 'style_of_cause': 'Smith v. Canada', 'status': 'Active', 'next_hearing': '2024-05-01'},
]

_MOCK_TRIBUNAL_RULINGS = [
    {'tribunal': 'Immigration and Refugee Board', 'case': 'VA1-12345', 'ruling': 'Refugee protection granted', 'date': '2024-03-01'},
]

# ─── Oversight ──────────────────────────────────────────────────────────────

_MOCK_AUDITOR_REPORTS = [
    {'agency': 'Office of the Auditor General', 'title': 'Report on Climate Adaptation', 'year': 2023, 'url': 'https://example.com/oag-report'},
]

_MOCK_WATCHDOG_REPORTS = [
    {'office': 'Office of the Privacy Commissioner', 'title': 'Privacy Compliance Review', 'year': 2023, 'url': 'https://example.com/opc-report'},
]

_MOCK_ATIP = [
    {'institution': 'Royal Canadian Mounted Police', 'request': 'A-2023-00123', 'summary': 'Use of facial recognition technology', 'status': 'Completed', 'year': 2023},
]

_MOCK_CONFLICT = [
    {'public_office_holder': 'Minister A', 'year': 2023, 'finding': 'No conflict found', 'disclosure_url': 'https://example.com/coi1'},
]

# ─── Data ───────────────────────────────────────────────────────────────────

_MOCK_SPENDING = [
    {'department': 'Health Canada', 'year': 2023, 'category': 'Programs', 'amount': 4250000000, 'description': 'Canada Health Transfer'},
    {'department': 'Department of National Defence', 'year': 2023, 'category': 'Operations', 'amount': 23500000000, 'description': 'Defence operations'},
]

_MOCK_ELECTION_RESULTS = [
    {'year': 2021, 'type': 'Federal', 'riding': 'Toronto Centre', 'winner': 'Liberal', 'margin': 12.5, 'turnout': 62.3},
]

_MOCK_POPULATION = [
    {'region': 'Ontario', 'year': 2023, 'population': 15700000, 'source': 'Statistics Canada'},
]

_MOCK_SALARIES = [
    {'employer': 'City of Toronto', 'name': 'Bob Johnson', 'position': 'Fire Chief', 'year': 2023, 'salary': 215000},
]

# ─── Mock response router ───────────────────────────────────────────────────

_MOCK_DATA_MAP: Dict[str, Dict[str, Any]] = {
    'committees': {
        'committee-membership': _MOCK_COMMITTEE_MEMBERSHIP,
        'committee-meetings': _MOCK_COMMITTEE_MEETINGS,
        'committee-reports': _MOCK_COMMITTEE_REPORTS,
        'committee-witnesses': _MOCK_COMMITTEE_WITNESSES,
    },
    'corporate': {
        'corporation-profile': _MOCK_CORP_PROFILE,
        'corporation-filings': _MOCK_CORP_FILINGS,
        'director-registry': _MOCK_DIRECTORS,
        'lobbying-activities': _MOCK_LOBBYING,
    },
    'influence': {
        'political-contributions': _MOCK_CONTRIBUTIONS,
        'fundraising-events': _MOCK_FUNDRAISING,
        'media-ownership': _MOCK_MEDIA_OWNERSHIP,
    },
    'regulations': {
        'regulatory-proposals': _MOCK_REG_PROPOSALS,
        'regulatory-decisions': _MOCK_REG_DECISIONS,
        'consultation-comments': _MOCK_COMMENTS,
    },
    'courts': {
        'court-decisions': _MOCK_COURT_DECISIONS,
        'case-tracking': _MOCK_CASES,
        'tribunal-rulings': _MOCK_TRIBUNAL_RULINGS,
    },
    'oversight': {
        'auditor-reports': _MOCK_AUDITOR_REPORTS,
        'watchdog-reports': _MOCK_WATCHDOG_REPORTS,
        'access-to-information': _MOCK_ATIP,
        'conflict-of-interest': _MOCK_CONFLICT,
    },
    'data': {
        'government-spending': _MOCK_SPENDING,
        'election-results': _MOCK_ELECTION_RESULTS,
        'population-statistics': _MOCK_POPULATION,
        'public-salary-disclosure': _MOCK_SALARIES,
    },
}


def get_mock_response(agent: str, action: str) -> MapleSpikeResponse:
    """Return a mock response for the given agent + action. Falls back to a generic message."""
    agent_data = _MOCK_DATA_MAP.get(agent.lower())
    if agent_data and action in agent_data:
        return _ok(agent, action, agent_data[action])
    # Generic fallback
    return _ok(
        agent, action,
        {
            'message': f'Mock placeholder for {agent}/{action}',
            'note': 'Full mock data coming soon.',
        },
        source='Mock Fallback',
    )
