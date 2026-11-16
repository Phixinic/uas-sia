#!/bin/sh
# Bangkitkan ulang tiga diagram dokumentasi dari kode dan skema. Jalankan dari mana saja.
# Butuh: python3 dengan Pillow dan numpy, rsvg-convert, dan (opsional) --cek-db butuh container sia-dpro-pg.
cd "$(dirname "$0")/../.." || exit 1
python3 docs/alat/buat_logical_database.py "$@" || exit 1
python3 docs/alat/buat_use_case.py || exit 1
python3 docs/alat/buat_sitemap.py
