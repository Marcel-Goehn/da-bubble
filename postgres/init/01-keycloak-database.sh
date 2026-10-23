#!/bin/sh
# Keycloak shares this container and volume but gets its own database and user.
set -e

# :'password' lets psql quote the value, so any character is safe in the password.
psql -v ON_ERROR_STOP=1 -v password="$KEYCLOAK_DB_PASSWORD" --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'EOSQL'
CREATE USER keycloak WITH PASSWORD :'password';
CREATE DATABASE keycloak OWNER keycloak;
EOSQL
