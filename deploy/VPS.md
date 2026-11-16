# Deploy SIA D'Production di VPS

Aplikasi berjalan di VPS `76.13.219.108`, dibuka lewat `http://76.13.219.108:8080`. VPS yang sama menjalankan Bejoban (`/opt/bejoban`, Caddy di port 80/443); jangan ubah apa pun milik Bejoban.

## Susunan

| Item | Lokasi |
| --- | --- |
| Kode dan compose | `/opt/sia-dpro` (kiriman `git archive`, tanpa `.git`) |
| Env produksi | `/opt/sia-dpro/.env.docker` (chmod 600, berisi `DB_PASSWORD` dan `COOKIE_TIDAK_AMAN=1`) |
| Override compose VPS | `deploy/docker-compose.vps.yml` (port 8080, nama image, `cgroup_parent`) |
| Kredensial akun | `/opt/sia-dpro/KREDENSIAL.txt` (chmod 600) |
| Slice systemd | `/etc/systemd/system/sia-dpro.slice` (MemoryHigh 900M, MemoryMax 1G) |
| Backup | `/root/backups/sia-dpro/` (`.sql.gz`, 14 hari), timer `sia-dpro-backup.timer` jam 02:30 UTC |
| Data Postgres | volume Docker `sia-dpro_sia-dpro-data` |

Container: `sia-dpro-app-1` (port 3000 di dalam, 8080 di host, batas 512M) dan `sia-dpro-db-1` (Postgres 16, tanpa port terbit, batas 384M). Keduanya memakai `cgroup_parent: sia-dpro.slice` dan `restart: unless-stopped`.

Alias supaya perintah pendek (di VPS, dari `/opt/sia-dpro`):

```bash
C="docker compose --env-file .env.docker -f docker-compose.yml -f deploy/docker-compose.vps.yml"
```

## Firewall

ufw memakai pola ufw-docker (`DOCKER-USER` di `/etc/ufw/after.rules`). Dua aturan dibuka:

```bash
ufw allow 8080/tcp
ufw route allow proto tcp from any to any port 3000   # port container setelah DNAT
```

Postgres tidak punya port terbit dan tidak ada aturan route untuk 5432, jadi tidak terjangkau dari luar.

## Update aplikasi

VPS hanya 1 vCPU dan berbagi dengan Bejoban, jadi image dibangun di Mac untuk `linux/amd64` lalu dikirim.

```bash
# Di Mac, dari folder repo, branch nextjs
git archive --format=tar nextjs | ssh root@76.13.219.108 'cd /opt/sia-dpro && tar -x'
docker buildx build --platform linux/amd64 --target build -t sia-dpro-migrasi:latest --load .
docker buildx build --platform linux/amd64 -t sia-dpro-app:latest --load .
docker save --platform linux/amd64 sia-dpro-migrasi:latest sia-dpro-app:latest | gzip | ssh root@76.13.219.108 'gunzip | docker load'

# Di VPS
cd /opt/sia-dpro
$C up -d --no-build     # migrasi (prisma migrate deploy) jalan otomatis sebelum app
```

Catatan untuk Mac dengan Colima: `docker build` biasa gagal untuk `--platform linux/amd64` (builder lama dengan image store containerd), jadi pakai `docker buildx` (`brew install docker-buildx`, lalu tautkan plugin ke `~/.docker/cli-plugins`). Build penuh lewat emulasi memakan sekitar 15 menit.

Membangun langsung di VPS (`$C build`) juga bisa, tetapi berat untuk 1 vCPU dan RAM bersama Bejoban. Pakai hanya bila perlu.

Berkas `.env.docker`, `KREDENSIAL.txt`, dan data tidak ikut tertimpa karena `git archive` tidak memuatnya.

## Migrasi dan seed

- Migrasi: otomatis lewat service `migrasi` setiap `up -d`. Manual: `$C run --rm migrasi npx prisma migrate deploy`.
- Seed data contoh (Oktober 2026) sudah dijalankan sekali. Jangan diulang: seed menolak jalan bila sudah ada pengguna, dan dengan `SEED_PAKSA=1` semua data dihapus.
- Ganti kata sandi admin, hrd, owner dengan acak kuat: `deploy/atur-sandi.sh` (menulis ulang `KREDENSIAL.txt` dan menghapus semua sesi). Seed membuat akun demo berkata sandi lemah, jadi skrip ini wajib dijalankan sesudah seed.

## Backup dan restore

Timer menjalankan `deploy/sia-dpro-backup.sh` (pg_dump lewat `docker exec`). Jalankan manual: `systemctl start sia-dpro-backup.service`. Cek jadwal: `systemctl list-timers sia-dpro-backup.timer`.

Restore ke database kosong (hentikan app dulu agar tidak ada koneksi):

```bash
$C stop app
docker exec sia-dpro-db-1 psql -U sia -d postgres -c 'DROP DATABASE sia_dpro;' -c 'CREATE DATABASE sia_dpro OWNER sia;'
gunzip -c /root/backups/sia-dpro/sia_dpro-AAAAMMDD-JJMMDD.sql.gz | docker exec -i sia-dpro-db-1 psql -U sia -d sia_dpro -v ON_ERROR_STOP=1
$C start app
```

Backup hanya disimpan di VPS yang sama. Salin berkala ke tempat lain bila datanya penting.

## Pemeriksaan

```bash
docker stats --no-stream
systemctl status sia-dpro.slice
curl -s http://127.0.0.1:8080/api/sehat
$C logs --tail 50 app
```

## Keterbatasan

- Akses lewat HTTP biasa tanpa TLS. Kata sandi dan cookie sesi berjalan tanpa enkripsi di jaringan, jadi hindari jaringan publik yang tidak tepercaya. `COOKIE_TIDAK_AMAN=1` membuat cookie sesi tidak bertanda Secure supaya login tetap bekerja di HTTP.
- Port 8080 terbuka untuk siapa saja. Tidak ada pembatasan IP.
- Aturan `ufw route ... port 3000` berlaku untuk semua container yang menerbitkan port 3000, bukan hanya SIA.
- Backup satu lokasi, di VPS yang sama.
