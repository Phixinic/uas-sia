#!/usr/bin/env bash
# Mengganti kata sandi admin, hrd, owner dengan nilai acak kuat (dijalankan di VPS, di /opt/sia-dpro).
# Hasilnya ditulis ke KREDENSIAL.txt (chmod 600). Semua sesi login lama dihapus.
set -euo pipefail
cd "$(dirname "$0")/.."
COMPOSE=(docker compose --env-file .env.docker -f docker-compose.yml -f deploy/docker-compose.vps.yml)
umask 077
: > KREDENSIAL.txt
{
  echo "SIA D'Production (VPS), dibuat $(date '+%F %T %Z')"
  echo "URL: http://76.13.219.108:8080"
} >> KREDENSIAL.txt
for u in admin hrd owner; do
  sandi=$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-20)
  hash=$(printf '%s' "$sandi" | "${COMPOSE[@]}" run --rm -T --no-deps migrasi node -e '
    const c=require("node:crypto");let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
      const g=c.randomBytes(16);const h=c.scryptSync(s,g,64);
      process.stdout.write("scrypt$"+g.toString("base64url")+"$"+h.toString("base64url"));});')
  "${COMPOSE[@]}" exec -T db psql -U sia -d sia_dpro -v ON_ERROR_STOP=1 -q \
    -v u="$u" -v h="$hash" <<'SQL'
UPDATE pengguna SET kata_sandi_hash = :'h' WHERE nama_pengguna = :'u';
SQL
  echo "$u / $sandi" >> KREDENSIAL.txt
done
"${COMPOSE[@]}" exec -T db psql -U sia -d sia_dpro -q -c 'DELETE FROM sesi;'
chmod 600 KREDENSIAL.txt
echo "Kata sandi diganti. Lihat KREDENSIAL.txt"
