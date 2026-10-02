set -a; . /etc/substrate/env; set +a
for s in "$@"; do
  echo "=== $s"
  start=$(date +%s%N)
  curl -s -m 150 -X POST http://127.0.0.1:8090/v2/impulses/resolve -H "Content-Type: application/json" -H "Authorization: ApiKey $METABOB_API_KEY" -d "{\"impulse\":{\"pointer\":{\"type\":\"$s\"}}}" -o /tmp/res-$s.json -w "http=%{http_code} bytes=%{size_download} t=%{time_total}s\n"
  head -c 1500 /tmp/res-$s.json; echo
done
