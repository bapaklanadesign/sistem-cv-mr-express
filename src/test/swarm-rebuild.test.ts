import { describe, expect, it, vi } from "vitest";
import { createSwarm, isSwarmLanding } from "@/lib/swarm-rebuild";
describe("Swarm landing-only boundary", () => {
  it("allows only the public homepage", () => expect(isSwarmLanding("/")).toBe(true));
  it.each(["/dashboard", "/dashboard-packing", "/login", "/setup", "/profil", "/transaksi", "/laporan", "/scan-koli", "/t/code", "/lacak/token", "/kontak"])("never starts on %s", (path) => expect(isSwarmLanding(path)).toBe(false));
});

describe("Swarm cleanup", () => {
  it("restores existing styles, scroll behavior, and removes its overlays on skip", () => {
    history.replaceState({}, "", "/");
    const root = document.createElement("div"), target = document.createElement("div"), layer = document.createElement("div");
    target.className = "target"; target.style.clipPath = "inset(2px)"; root.append(target);
    const previous = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "smooth";
    const frame = vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
    const engine = createSwarm(root, layer, () => {});
    engine.start({ order: [".target"] });
    expect(layer.querySelectorAll(".swarm-cursor")).toHaveLength(7);
    target.style.clipPath = "inset(100%)";
    engine.stop();
    expect(target.style.clipPath).toBe("inset(2px)");
    expect(document.documentElement.style.scrollBehavior).toBe("smooth");
    expect(layer.childElementCount).toBe(0);
    frame.mockRestore(); document.documentElement.style.scrollBehavior = previous;
  });
});
