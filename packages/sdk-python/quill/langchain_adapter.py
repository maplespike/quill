# SPDX-License-Identifier: Apache-2.0
# ---------------------------------------------------------------------------
# Quill SDK — LangChain adapter
# ---------------------------------------------------------------------------
"""
LangChain adapter for MapleSpike.

Provides ``get_maplespike_tools()`` — returns a list of ``StructuredTool``
objects (one per agent action) for use with LangChain agents/chains.

Usage::

    from quill import get_maplespike_tools

    tools = get_maplespike_tools(api_key='ms_live_...')
    # tools is a list of StructuredTool — hand it to any LangChain agent.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Type

from .agents import AGENTS


# ---------------------------------------------------------------------------
# Dynamic schema builder
# ---------------------------------------------------------------------------

def _build_args_schema(
    agent_name: str,
    action_name: str,
    required_params: List[str],
    optional_params: List[str],
) -> Type["BaseModel"]:
    """Build a Pydantic model for the tool's argument schema.

    Required parameters become required ``str`` fields; optional parameters
    become ``Optional[str]`` with ``default=None``.
    """
    from pydantic import BaseModel, Field, create_model  # noqa: PLC0415

    fields: Dict[str, tuple] = {}
    for p in required_params:
        fields[p] = (str, Field(..., description=f"Required parameter: {p}"))
    for p in optional_params:
        fields[p] = (Optional[str], Field(default=None, description=f"Optional parameter: {p}"))

    # Construct a readable class name from agent + action
    sanitised = (f"{agent_name}_{action_name}").replace("-", "_").replace(".", "_")
    class_name = "".join(part.capitalize() for part in sanitised.split("_")) + "Args"
    return create_model(class_name, **fields)


# ---------------------------------------------------------------------------
# Tool factory
# ---------------------------------------------------------------------------

def _make_tool_func(
    agent_name: str,
    action_name: str,
    client: Any,
) -> callable:
    """Return a callable that invokes the MapleSpike API for a given action.

    Using a factory function ensures each closure captures its own
    ``agent_name`` / ``action_name`` values (avoiding the late-binding
    closure problem).
    """

    def func(**kwargs: Any) -> Any:
        # Strip out None values — the API / client handles missing params
        params = {k: v for k, v in kwargs.items() if v is not None}
        result = client.query(agent_name, action_name, params)
        if result.success:
            return result.data
        return {"error": result.error, "detail": result.text}

    # Set a readable __name__ and __doc__ for observability
    func.__name__ = f"{agent_name}_{action_name}".replace("-", "_")
    func.__doc__ = client.query.__doc__
    return func


# ---------------------------------------------------------------------------
# Internal tool builder
# ---------------------------------------------------------------------------

def _build_tools(
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
) -> List[Any]:
    """Construct the tool list from the agent catalogue.

    LangChain and Pydantic are imported lazily inside this function so the
    module can be imported without LangChain installed.  A helpful
    ``ImportError`` is raised only when this function is actually called.
    """
    # Lazy imports — only needed when tools are actually requested
    try:
        from langchain.tools import StructuredTool
    except ImportError:
        try:
            from langchain_core.tools import StructuredTool
        except ImportError:
            raise ImportError(
                "LangChain is required to build MapleSpike tools. "
                "Install it with: pip install 'quill-sdk[langchain]'"
            ) from None

    # Lazy import to avoid circular dependency (MapleSpike lives in __init__)
    from . import MapleSpike  # noqa: PLC0415

    client = MapleSpike(api_key=api_key, base_url=base_url)
    tools: List[Any] = []

    for agent_name, agent_def in AGENTS.items():
        for action in agent_def.actions:
            name = f"{agent_name}.{action.id}"
            args_schema = _build_args_schema(
                agent_name=agent_name,
                action_name=action.id,
                required_params=action.required_params,
                optional_params=action.optional_params,
            )

            tool = StructuredTool.from_function(
                func=_make_tool_func(agent_name, action.id, client),
                name=name,
                description=action.description,
                args_schema=args_schema,
            )
            tools.append(tool)

    return tools


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_maplespike_tools(
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
) -> List[Any]:
    """Return a list of LangChain ``StructuredTool`` objects.

    One tool is created for **every** agent action defined in the
    :data:`~quill.agents.AGENTS` catalogue.  Each tool:

    * Has a ``name`` of the form ``<agent>.<action>`` (e.g.
      ``committees.committee-membership``).
    * Has a ``description`` taken from the action definition.
    * Has an ``args_schema`` auto-generated from the action's required and
      optional parameters.
    * Calls the MapleSpike live API (or mock data if no API key is set).

    Parameters
    ----------
    api_key : str, optional
        MapleSpike API key.  If omitted the client falls back to the
        :mod:`quill.auth` module and eventually to mock data.
    base_url : str, optional
        Override the default API base URL.

    Returns
    -------
    list[StructuredTool]
        LangChain-compatible tools for every agent action.
    """
    return _build_tools(api_key=api_key, base_url=base_url)
