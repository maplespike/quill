# SPDX-License-Identifier: Apache-2.0
# ---------------------------------------------------------------------------
# Quill SDK — Agent catalog
# ---------------------------------------------------------------------------

from typing import Dict, List
from .types import AgentDefinition, ActionDefinition

# ─── Committees ─────────────────────────────────────────────────────────────

COMMITTEES_ACTIONS: List[ActionDefinition] = [
    ActionDefinition(
        id='committee-membership',
        description='List members of parliamentary committees and their roles',
        required_params=[],
        optional_params=['committee', 'parliament', 'chamber', 'party', 'limit'],
        sample_curl=(
            "curl 'https://api.maplespike.ca/v1/committees/"
            "committee-membership?parliament=44&chamber=commons'"
        ),
    ),
    ActionDefinition(
        id='committee-meetings',
        description='Schedule and records of committee meetings',
        required_params=[],
        optional_params=['committee', 'date_from', 'date_to', 'parliament', 'limit'],
        sample_curl=(
            "curl 'https://api.maplespike.ca/v1/committees/"
            "committee-meetings?date_from=2024-01-01'"
        ),
    ),
    ActionDefinition(
        id='committee-reports',
        description='Published committee reports and findings',
        required_params=[],
        optional_params=['committee', 'parliament', 'keyword', 'limit'],
        sample_curl=(
            "curl 'https://api.maplespike.ca/v1/committees/"
            "committee-reports?keyword=health'"
        ),
    ),
    ActionDefinition(
        id='committee-witnesses',
        description='Witness appearances before committees',
        required_params=[],
        optional_params=['committee', 'witness', 'date_from', 'date_to', 'limit'],
        sample_curl=(
            "curl 'https://api.maplespike.ca/v1/committees/"
            "committee-witnesses?committee=finance'"
        ),
    ),
]

# ─── Corporate ──────────────────────────────────────────────────────────────

CORPORATE_ACTIONS: List[ActionDefinition] = [
    ActionDefinition(
        id='corporation-profile',
        description='Profile information for a Canadian corporation',
        required_params=['business_number'],
        optional_params=['jurisdiction', 'include_directors'],
        sample_curl=(
            "curl 'https://api.maplespike.ca/v1/corporate/"
            "corporation-profile?business_number=123456789'"
        ),
    ),
    ActionDefinition(
        id='corporation-filings',
        description='Corporate filings and annual returns',
        required_params=['business_number'],
        optional_params=['year', 'filing_type', 'limit'],
        sample_curl=(
            "curl 'https://api.maplespike.ca/v1/corporate/"
            "corporation-filings?business_number=123456789&year=2023'"
        ),
    ),
    ActionDefinition(
        id='director-registry',
        description='Corporate director registrations and history',
        required_params=[],
        optional_params=['business_number', 'director_name', 'limit'],
        sample_curl=(
            "curl 'https://api.maplespike.ca/v1/corporate/"
            "director-registry?director_name=Smith'"
        ),
    ),
    ActionDefinition(
        id='lobbying-activities',
        description='Registered lobbying activities and communications',
        required_params=[],
        optional_params=['lobbyist', 'client', 'subject', 'date_from', 'limit'],
        sample_curl=(
            "curl 'https://api.maplespike.ca/v1/corporate/"
            "lobbying-activities?subject=healthcare'"
        ),
    ),
]

# ─── Influence ──────────────────────────────────────────────────────────────

INFLUENCE_ACTIONS: List[ActionDefinition] = [
    ActionDefinition(
        id='political-contributions',
        description='Political donation records and trends',
        required_params=[],
        optional_params=['donor', 'party', 'year', 'limit', 'sort'],
        sample_curl=(
            "curl 'https://api.maplespike.ca/v1/influence/"
            "political-contributions?year=2023'"
        ),
    ),
    ActionDefinition(
        id='fundraising-events',
        description='Political fundraising events and ticket prices',
        required_params=[],
        optional_params=['party', 'date_from', 'date_to', 'limit'],
        sample_curl=(
            "curl 'https://api.maplespike.ca/v1/influence/"
            "fundraising-events?party=Liberal'"
        ),
    ),
    ActionDefinition(
        id='media-ownership',
        description='Media ownership structures and cross-holdings',
        required_params=[],
        optional_params=['media_group', 'outlet', 'limit'],
        sample_curl=(
            "curl 'https://api.maplespike.ca/v1/influence/"
            "media-ownership?media_group=Postmedia'"
        ),
    ),
]

# ─── Regulations ────────────────────────────────────────────────────────────

REGULATIONS_ACTIONS: List[ActionDefinition] = [
    ActionDefinition(
        id='regulatory-proposals',
        description='Proposed regulatory changes open for comment',
        required_params=[],
        optional_params=['agency', 'status', 'keyword', 'published_after', 'limit'],
        sample_curl=(
            "curl 'https://api.maplespike.ca/v1/regulations/"
            "regulatory-proposals?status=open'"
        ),
    ),
    ActionDefinition(
        id='regulatory-decisions',
        description='Final regulatory decisions and rulings',
        required_params=[],
        optional_params=['agency', 'decision_type', 'date_from', 'limit'],
        sample_curl=(
            "curl 'https://api.maplespike.ca/v1/regulations/"
            "regulatory-decisions?agency=CRTC'"
        ),
    ),
    ActionDefinition(
        id='consultation-comments',
        description='Public comments submitted during regulatory consultations',
        required_params=[],
        optional_params=['proposal_id', 'commenter', 'keyword', 'limit'],
        sample_curl=(
            "curl 'https://api.maplespike.ca/v1/regulations/"
            "consultation-comments?proposal_id=GC-2024-001'"
        ),
    ),
]

# ─── Courts ─────────────────────────────────────────────────────────────────

COURTS_ACTIONS: List[ActionDefinition] = [
    ActionDefinition(
        id='court-decisions',
        description='Published court decisions and judgments',
        required_params=[],
        optional_params=['court', 'date_from', 'keyword', 'citation', 'limit'],
        sample_curl=(
            "curl 'https://api.maplespike.ca/v1/courts/"
            "court-decisions?court=SCC&keyword=charter'"
        ),
    ),
    ActionDefinition(
        id='case-tracking',
        description='Track ongoing court cases and their status',
        required_params=[],
        optional_params=['case_number', 'court', 'party_name', 'status', 'limit'],
        sample_curl=(
            "curl 'https://api.maplespike.ca/v1/courts/"
            "case-tracking?status=active'"
        ),
    ),
    ActionDefinition(
        id='tribunal-rulings',
        description='Administrative tribunal rulings and orders',
        required_params=[],
        optional_params=['tribunal', 'date_from', 'keyword', 'limit'],
        sample_curl=(
            "curl 'https://api.maplespike.ca/v1/courts/"
            "tribunal-rulings?tribunal=IRB&keyword=refugee'"
        ),
    ),
]

# ─── Oversight ──────────────────────────────────────────────────────────────

OVERSIGHT_ACTIONS: List[ActionDefinition] = [
    ActionDefinition(
        id='auditor-reports',
        description='Auditor General reports and performance audits',
        required_params=[],
        optional_params=['agency', 'year', 'keyword', 'limit'],
        sample_curl=(
            "curl 'https://api.maplespike.ca/v1/oversight/"
            "auditor-reports?year=2023'"
        ),
    ),
    ActionDefinition(
        id='watchdog-reports',
        description='Ombudsman and watchdog office reports',
        required_params=[],
        optional_params=['office', 'year', 'keyword', 'limit'],
        sample_curl=(
            "curl 'https://api.maplespike.ca/v1/oversight/"
            "watchdog-reports?office=privacy'"
        ),
    ),
    ActionDefinition(
        id='access-to-information',
        description='ATIP request summaries and processing metrics',
        required_params=[],
        optional_params=['institution', 'year', 'keyword', 'limit'],
        sample_curl=(
            "curl 'https://api.maplespike.ca/v1/oversight/"
            "access-to-information?institution=RCMP'"
        ),
    ),
    ActionDefinition(
        id='conflict-of-interest',
        description='Conflict of interest disclosures and commissioner findings',
        required_params=[],
        optional_params=['public_office_holder', 'year', 'finding', 'limit'],
        sample_curl=(
            "curl 'https://api.maplespike.ca/v1/oversight/"
            "conflict-of-interest?year=2023'"
        ),
    ),
]

# ─── Data ───────────────────────────────────────────────────────────────────

DATA_ACTIONS: List[ActionDefinition] = [
    ActionDefinition(
        id='government-spending',
        description='Federal and provincial government expenditure data',
        required_params=[],
        optional_params=['department', 'year', 'category', 'limit', 'min_amount'],
        sample_curl=(
            "curl 'https://api.maplespike.ca/v1/data/"
            "government-spending?year=2023&department=health'"
        ),
    ),
    ActionDefinition(
        id='election-results',
        description='Historical and current election results',
        required_params=[],
        optional_params=['year', 'riding', 'party', 'type', 'limit'],
        sample_curl=(
            "curl 'https://api.maplespike.ca/v1/data/"
            "election-results?year=2021&type=federal'"
        ),
    ),
    ActionDefinition(
        id='population-statistics',
        description='Population and demographic statistics',
        required_params=[],
        optional_params=['region', 'year', 'demographic', 'limit'],
        sample_curl=(
            "curl 'https://api.maplespike.ca/v1/data/"
            "population-statistics?region=Ontario'"
        ),
    ),
    ActionDefinition(
        id='public-salary-disclosure',
        description='Public sector salary disclosures (sunshine lists)',
        required_params=[],
        optional_params=['employer', 'year', 'min_salary', 'name', 'limit'],
        sample_curl=(
            "curl 'https://api.maplespike.ca/v1/data/"
            "public-salary-disclosure?year=2023&min_salary=100000'"
        ),
    ),
]

# ─── Agent catalog ──────────────────────────────────────────────────────────

AGENTS: Dict[str, AgentDefinition] = {
    'committees': AgentDefinition(
        name='committees',
        description='Parliamentary committee information — membership, meetings, reports, witnesses',
        actions=COMMITTEES_ACTIONS,
    ),
    'corporate': AgentDefinition(
        name='corporate',
        description='Corporate registry data — profiles, filings, directors, lobbying',
        actions=CORPORATE_ACTIONS,
    ),
    'influence': AgentDefinition(
        name='influence',
        description='Political influence tracking — donations, fundraising, media ownership',
        actions=INFLUENCE_ACTIONS,
    ),
    'regulations': AgentDefinition(
        name='regulations',
        description='Regulatory activity — proposals, decisions, consultations',
        actions=REGULATIONS_ACTIONS,
    ),
    'courts': AgentDefinition(
        name='courts',
        description='Court system — decisions, case tracking, tribunal rulings',
        actions=COURTS_ACTIONS,
    ),
    'oversight': AgentDefinition(
        name='oversight',
        description='Government oversight — audits, watchdogs, ATIP, conflict of interest',
        actions=OVERSIGHT_ACTIONS,
    ),
    'data': AgentDefinition(
        name='data',
        description='Government data — spending, elections, demographics, salaries',
        actions=DATA_ACTIONS,
    ),
}


def get_agent(name: str) -> AgentDefinition:
    """Resolve an agent by name (case-insensitive). Raises KeyError if not found."""
    key = name.lower()
    if key not in AGENTS:
        available = ', '.join(AGENTS.keys())
        raise KeyError(f'Unknown agent "{name}". Available agents: {available}')
    return AGENTS[key]


def list_agents() -> List[AgentDefinition]:
    """List all agent definitions with their actions."""
    return list(AGENTS.values())


def list_actions(agent_name: str) -> List[ActionDefinition]:
    """List actions for a specific agent. Raises KeyError if agent not found."""
    return get_agent(agent_name).actions
