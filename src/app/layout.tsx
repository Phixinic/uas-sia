import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "SIA D'Production", template: "%s · SIA D'Production" },
  description: "Sistem informasi akuntansi siklus konversi dan SDM D'Production",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f2a3d" };

export default function TataLetakAkar({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
