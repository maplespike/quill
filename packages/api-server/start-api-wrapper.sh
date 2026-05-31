#!/bin/bash
export $(cat .env | xargs)
exec node dist/dev-server.js
