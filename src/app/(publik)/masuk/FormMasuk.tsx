"use client";

import { useActionState } from "react";
import { LogIn } from "lucide-react";
import { masuk, type StatusMasuk } from "@/lib/aksi/auth";
import { Bidang, Isian } from "@/komponen/ui/Isian";
import Tombol from "@/komponen/ui/Tombol";
import Peringatan from "@/komponen/ui/Peringatan";

export default function FormMasuk({ kembali }: { kembali: string }) {
  const [status, kirim, memuat] = useActionState<StatusMasuk, FormData>(masuk, { galat: null });
  return (
    <form action={kirim} className="space-y-4">
      <input type="hidden" name="kembali" value={kembali} />
      {status.galat && <Peringatan jenis="galat">{status.galat}</Peringatan>}
      <Bidang label="Nama pengguna" htmlFor="namaPengguna">
        <Isian id="namaPengguna" name="namaPengguna" autoComplete="username" autoCapitalize="none" spellCheck={false} required autoFocus />
      </Bidang>
      <Bidang label="Kata sandi" htmlFor="kataSandi">
        <Isian id="kataSandi" name="kataSandi" type="password" autoComplete="current-password" required />
      </Bidang>
      <Tombol type="submit" varian="utama" className="w-full" memuat={memuat} ikon={<LogIn className="size-4" />}>
        Masuk
      </Tombol>
    </form>
  );
}
