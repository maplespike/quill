#!/bin/bash
# SPDX-License-Identifier: AGPL-3.0-only
export $(cat .env | xargs)
exec node dist/dev-server.js
