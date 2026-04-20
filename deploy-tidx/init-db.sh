#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE DATABASE tidx_tokclaw;
    GRANT ALL PRIVILEGES ON DATABASE tidx_tokclaw TO $POSTGRES_USER;
EOSQL
