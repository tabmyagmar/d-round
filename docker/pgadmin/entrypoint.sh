#!/bin/sh
# Pre-configures pgAdmin with the Postgres service from docker-compose so the UI opens
# already connected. servers.json + pgpass are generated from the same POSTGRES_* env
# vars the database container uses (single source of truth: the root .env file).
# pgAdmin imports PGADMIN_SERVER_JSON_FILE only on first start of an empty volume.
set -eu

cat > /tmp/servers.json <<EOF
{
  "Servers": {
    "1": {
      "Name": "app-template (docker)",
      "Group": "Servers",
      "Host": "postgres",
      "Port": 5432,
      "MaintenanceDB": "${POSTGRES_DB}",
      "Username": "${POSTGRES_USER}",
      "SSLMode": "prefer",
      "PassFile": "/tmp/pgpass"
    }
  }
}
EOF

printf 'postgres:5432:*:%s:%s\n' "${POSTGRES_USER}" "${POSTGRES_PASSWORD}" > /tmp/pgpass
chmod 600 /tmp/pgpass

export PGADMIN_SERVER_JSON_FILE=/tmp/servers.json
exec /entrypoint.sh
