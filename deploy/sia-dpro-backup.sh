#!/usr/bin/env bash
# Backup harian database SIA: pg_dump lewat docker exec, simpan 14 hari.
set -euo pipefail
DIR=/root/backups/sia-dpro
mkdir -p "$DIR"
BERKAS="$DIR/sia_dpro-$(date +%Y%m%d-%H%M%S).sql.gz"
docker exec sia-dpro-db-1 pg_dump -U sia -d sia_dpro --no-owner | gzip > "$BERKAS.tmp"
mv "$BERKAS.tmp" "$BERKAS"
chmod 600 "$BERKAS"
find "$DIR" -name 'sia_dpro-*.sql.gz' -mtime +14 -delete
echo "Backup tersimpan: $BERKAS"
