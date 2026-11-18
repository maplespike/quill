# SPDX-License-Identifier: Apache-2.0
# ---------------------------------------------------------------------------
# Quill SDK — Authentication helpers
# ---------------------------------------------------------------------------

from typing import Optional

# Internal module-level store (not exported)
_api_key: Optional[str] = None
_jwt_token: Optional[str] = None


def get_api_key() -> Optional[str]:
    """Return the currently configured API key, or None."""
    return _api_key


def set_api_key(key: Optional[str]) -> None:
    """Set the API key used for subsequent requests."""
    global _api_key  # noqa: PLW0603
    _api_key = key


def get_jwt_token() -> Optional[str]:
    """Return the currently configured JWT token, or None."""
    return _jwt_token


def set_jwt_token(token: Optional[str]) -> None:
    """Set the JWT token used for subsequent requests."""
    global _jwt_token  # noqa: PLW0603
    _jwt_token = token


def clear_auth() -> None:
    """Reset all stored credentials."""
    global _api_key, _jwt_token  # noqa: PLW0603
    _api_key = None
    _jwt_token = None


def is_authenticated() -> bool:
    """Check whether any authentication is configured."""
    return bool(_api_key or _jwt_token)
