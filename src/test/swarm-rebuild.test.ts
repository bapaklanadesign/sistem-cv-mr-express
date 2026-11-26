import { describe, expect, it } from "vitest";
import { isSwarmLanding } from "@/lib/swarm-rebuild";
describe("Swarm landing-only boundary", () => {
  it("allows only the public homepage", () => expect(isSwarmLanding("/")).toBe(true));
  it.each(["/dashboard", "/dashboard-packing", "/login", "/setup", "/profil", "/transaksi", "/laporan", "/scan-koli", "/t/code", "/lacak/token", "/kontak"])("never starts on %s", (path) => expect(isSwarmLanding(path)).toBe(false));
});
