import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

/** Pembungkus label + kontrol + petunjuk + pesan galat. `htmlFor` wajib sama dengan id kontrolnya. */
export function Bidang({ label, htmlFor, petunjuk, galat, wajib, className = "", children }: {
  label: ReactNode;
  htmlFor: string;
  petunjuk?: ReactNode;
  galat?: string;
  wajib?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`bidang ${className}`}>
      <label className="label" htmlFor={htmlFor}>
        {label}
        {wajib && <span className="text-rose-600"> *</span>}
      </label>
      {children}
      {galat ? <span className="galat-isian" id={`${htmlFor}-galat`}>{galat}</span> : petunjuk ? <span className="petunjuk">{petunjuk}</span> : null}
    </div>
  );
}

type GalatProp = { galat?: boolean };

export function Isian({ galat, className = "", ...p }: InputHTMLAttributes<HTMLInputElement> & GalatProp) {
  return <input className={`isian ${p.type === "number" ? "isian-angka" : ""} ${className}`} aria-invalid={galat || undefined} {...p} />;
}

export function Pilihan({ galat, className = "", children, ...p }: SelectHTMLAttributes<HTMLSelectElement> & GalatProp) {
  return (
    <select className={`isian ${className}`} aria-invalid={galat || undefined} {...p}>
      {children}
    </select>
  );
}

export function AreaTeks({ galat, className = "", ...p }: TextareaHTMLAttributes<HTMLTextAreaElement> & GalatProp) {
  return <textarea className={`isian ${className}`} aria-invalid={galat || undefined} {...p} />;
}

/** Isian rupiah: menerima angka bulat, menampilkan pemisah ribuan di bawahnya. */
export function IsianRupiah({ nilai, saatUbah, id, galat, ...p }: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  nilai: string;
  saatUbah: (v: string) => void;
  id: string;
  galat?: boolean;
}) {
  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      className="isian isian-angka"
      aria-invalid={galat || undefined}
      value={nilai === "" ? "" : Number(nilai).toLocaleString("id-ID")}
      onChange={(e) => saatUbah(e.target.value.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, ""))}
      {...p}
    />
  );
}
