#!/bin/sh
# Render logical-database.puml jadi tiga gambar per siklus, lalu gabungkan jadi logical-database.png.
# Butuh plantuml, graphviz, dan Python dengan Pillow.
cd "$(dirname "$0")" || exit 1
OUT=$(mktemp -d)
for v in konv sdm lap; do
  PLANTUML_SECURITY_PROFILE=UNSECURE ERD=$v plantuml -tpng -o "$OUT/$v" logical-database.puml
done
cp "$OUT/konv/logical-database.png" logical-database-konversi.png
cp "$OUT/sdm/logical-database.png" logical-database-sdm.png
cp "$OUT/lap/logical-database.png" logical-database-pelaporan.png
${PYTHON:-python3} - <<'PY'
from PIL import Image, ImageDraw, ImageFont
names = [("Siklus konversi", "logical-database-konversi.png"), ("Siklus SDM", "logical-database-sdm.png"), ("Pelaporan", "logical-database-pelaporan.png")]
ims = [Image.open(n).convert("RGB") for _, n in names]
W = max(i.width for i in ims) + 120; pad = 90; top = 150
H = top + sum(i.height + pad for i in ims) + 40
c = Image.new("RGB", (W, H), "white"); d = ImageDraw.Draw(c)
f = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 54)
g = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 34)
d.text((60, 20), "Merah muda: siklus konversi. Kuning: pelaporan. Biru: siklus SDM.", fill=(60, 60, 60), font=g)
d.text((60, 70), "Kolom dibuat_oleh, disetujui_oleh, dan dikunci_oleh berisi peran (Admin, HRD, Owner), bukan tabel.", fill=(60, 60, 60), font=g)
y = top
for (t, _), i in zip(names, ims):
    d.text((60, y + 10), t, fill=(139, 26, 26), font=f); y += pad; c.paste(i, (60, y)); y += i.height
c.save("logical-database.png")
PY
