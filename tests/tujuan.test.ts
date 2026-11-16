import { describe, expect, it } from "vitest";
import { tujuanAman } from "@/lib/inti/tujuan";

describe("tujuan sesudah login", () => {
  it.each(["//evil.com", "/\\evil.com", "/%5Cevil.com", "/%5cevil.com", "https://evil.com", "http://evil.com/x", "evil.com", "", "/%2F%2Fevil.com", "/\t/evil.com"])("%j dialihkan ke /", (x) => {
    expect(tujuanAman(x)).toBe("/");
  });
  it("kosong atau tidak ada ke /", () => {
    expect(tujuanAman(undefined)).toBe("/");
    expect(tujuanAman(null)).toBe("/");
  });
  it("jalur internal dipertahankan", () => {
    expect(tujuanAman("/dashboard?x=1")).toBe("/dashboard?x=1");
    expect(tujuanAman("/konversi/pelepasan?form=baru#a")).toBe("/konversi/pelepasan?form=baru#a");
  });
});
