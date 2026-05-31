#!/bin/bash
JWT_SECRET="jwt-secret-dev-1780254486-"$(shuf -i 10000000-99999999 -n 1)"-66097536
PORT=8083
export JWT_SECRET PORT
exec node dist/dev-server.js
