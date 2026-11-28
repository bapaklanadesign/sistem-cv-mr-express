import { afterEach, describe, expect, it, vi } from "vitest";
import { createSwarm, isSwarmLanding } from "@/lib/swarm-rebuild";
describe("Swarm landing-only boundary", () => {
  it("allows only the public homepage", () => expect(isSwarmLanding("/")).toBe(true));
  it.each(["/dashboard", "/dashboard-packing", "/login", "/setup", "/profil", "/transaksi", "/laporan", "/scan-koli", "/t/code", "/lacak/token", "/kontak"])("never starts on %s", (path) => expect(isSwarmLanding(path)).toBe(false));
});

describe("Swarm cleanup", () => {
  afterEach(() => { vi.restoreAllMocks(); history.replaceState({}, "", "/"); });
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
  it("refuses to create overlays on an internal page", () => {
    history.replaceState({}, "", "/login");
    const root = document.createElement("div"), layer = document.createElement("div");
    root.innerHTML = '<div class="target"></div>';
    const update = vi.fn(), engine = createSwarm(root, layer, update);
    engine.start({ order: [".target"] });
    expect(layer.childElementCount).toBe(0);
    expect(root.hasAttribute("data-swarm-running")).toBe(false);
  });
  it("conceals everything before rebuilding, never fires a native click, and restores on completion", () => {
    history.replaceState({}, "", "/");
    const root = document.createElement("div"), target = document.createElement("button"), layer = document.createElement("div");
    target.className = "target"; root.append(target);
    const click = vi.fn(); target.addEventListener("click", click);
    vi.spyOn(target, "getBoundingClientRect").mockReturnValue({ x: 10, y: 90, left: 10, top: 90, right: 110, bottom: 120, width: 100, height: 30, toJSON: () => ({}) });
    let callback: FrameRequestCallback | undefined;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(fn => { callback = fn; return 1; });
    const base = performance.now(), update = vi.fn();
    const engine = createSwarm(root, layer, update);
    engine.start({ order: [".target"], cursorCount: 1 });
    const tick = (ms: number) => callback?.(base + ms);
    tick(2300);
    expect(target.style.clipPath).toBe("inset(0 0 0 100%)");
    tick(2500); tick(5000); tick(6000); tick(8000);
    expect(update).toHaveBeenCalledWith(1, 1, true);
    expect(click).not.toHaveBeenCalled();
    tick(10000);
    expect(layer.childElementCount).toBe(0);
    expect(target.style.clipPath).toBe("");
    expect(root.hasAttribute("data-swarm-running")).toBe(false);
  });
  it("cleans up when leaving the homepage and allows starting again", () => {
    history.replaceState({}, "", "/");
    const root = document.createElement("div"), layer = document.createElement("div");
    root.innerHTML = '<div class="target"></div>';
    let callback: FrameRequestCallback | undefined;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(fn => { callback = fn; return 1; });
    const engine = createSwarm(root, layer, () => {});
    engine.start({ order: [".target"] });
    history.replaceState({}, "", "/dashboard"); callback?.(performance.now());
    expect(layer.childElementCount).toBe(0);
    expect(document.documentElement.style.overflow).toBe("");
    history.replaceState({}, "", "/"); engine.start({ order: [".target"] });
    expect(layer.querySelectorAll(".swarm-cursor")).toHaveLength(7);
    engine.stop();
  });
});
