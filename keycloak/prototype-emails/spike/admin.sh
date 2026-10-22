#!/bin/sh
# PROTOTYPE: call the Keycloak Admin API as the bootstrap admin. Usage: ./admin.sh GET /realms/da-bubble/...
TOKEN=$(curl -s --noproxy '*' -d client_id=admin-cli -d username=admin -d password=admin -d grant_type=password \
  http://localhost:8080/realms/master/protocol/openid-connect/token | python3 -c 'import json,sys;print(json.load(sys.stdin)["access_token"])')
method=$1; path=$2; shift 2
curl -s --noproxy '*' -X "$method" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' "http://localhost:8080/admin$path" "$@"
echo
