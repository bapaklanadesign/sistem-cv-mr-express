export const isSwarmLanding = (pathname: string) => pathname === "/";

export type SwarmConfig = {
  cursorCount: number; colors: string[]; speed: number; duration: number;
  order: string[]; auto: boolean;
};
export const swarmDefaults: SwarmConfig = {
  cursorCount: 7, colors: ["var(--swarm-red)", "var(--swarm-blue)", "var(--swarm-cyan)", "var(--swarm-green)", "var(--swarm-yellow)", "var(--swarm-purple)", "var(--swarm-orange)"],
  speed: 1, duration: 28000, auto: true,
  order: [".j-nav .j-logo", ".j-links a", ".j-btn-sm", ".j-hero > *", ".j-blk:not(.j-hero)", ".j-sec .j-eyebrow", ".j-sec h2", ".j-sec .j-lead", ".j-adv-card", ".j-map", ".j-collage", ".j-cta-sec .j-btn", ".s-foot-grid > *", ".s-foot-base"],
};

/** Visual-only reconstruction: never clicks actual controls or mutates content. */
export function createSwarm(root: HTMLElement, layer: HTMLElement, update: (done: number, total: number, active: boolean) => void) {
  let raf = 0, running = false;
  let restore: (() => void)[] = [];
  const names = ["Ayu", "Bima", "Citra", "Dani", "Eka", "Fajar", "Gita"];
  const stop = () => {
    running = false; cancelAnimationFrame(raf);
    restore.forEach((fn) => fn()); restore = [];
    layer.replaceChildren(); update(0, 0, false);
  };
  const start = (options: Partial<SwarmConfig> = {}) => {
    stop();
    if (!isSwarmLanding(location.pathname) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const config = { ...swarmDefaults, ...options };
    const targets = [...new Set(config.order.flatMap((selector) => [...root.querySelectorAll<HTMLElement>(selector)]))]
      .filter((el, _, all) => !all.some((parent) => parent !== el && parent.contains(el)));
    if (!targets.length) return;
    running = true;
    const count = Math.min(14, Math.max(1, Math.floor(config.cursorCount) || 7));
    const cursors = Array.from({ length: count }, (_, i) => {
      const cursor = document.createElement("div"); cursor.className = "swarm-cursor";
      cursor.style.setProperty("--operator-color", config.colors[i % config.colors.length] ?? swarmDefaults.colors[0] ?? "var(--primary)");
      const arrow = document.createElement("span"); arrow.className = "swarm-arrow";
      const label = document.createElement("span"); label.className = "swarm-name"; label.textContent = names[i % names.length] ?? "Operator";
      cursor.append(arrow, label); layer.append(cursor);
      const outline = document.createElement("div"); outline.className = "swarm-outline";
      outline.style.setProperty("--operator-color", cursor.style.getPropertyValue("--operator-color")); layer.append(outline);
      return { cursor, outline, x: innerWidth / 2, y: 80 + i * 32 };
    });
    const savedScroll = { x: scrollX, y: scrollY };
    const scrollBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "auto";
    const onResize = () => stop();
    window.addEventListener("resize", onResize);
    restore.push(() => {
      window.removeEventListener("resize", onResize);
      if (isSwarmLanding(location.pathname)) window.scrollTo(savedScroll.x, savedScroll.y);
      document.documentElement.style.scrollBehavior = scrollBehavior;
    });
    const clips = targets.map((el) => {
      const value = el.style.getPropertyValue("clip-path"), priority = el.style.getPropertyPriority("clip-path");
      restore.push(() => { if (value) el.style.setProperty("clip-path", value, priority); else el.style.removeProperty("clip-path"); });
      return el;
    });
    const duration = Math.max(4000, config.duration / Math.max(.1, config.speed));
    const begin = performance.now();
    update(0, targets.length, true);
    const tick = (now: number) => {
      if (!running || !isSwarmLanding(location.pathname)) { stop(); return; }
      const elapsed = now - begin;
      // Normal page first, then staged deconstruction, then parallel reveal.
      const progress = Math.max(0, Math.min(1, (elapsed - 1800) / duration));
      if (elapsed > 1800) window.scrollTo(0, savedScroll.y + progress * Math.max(0, document.documentElement.scrollHeight - innerHeight - savedScroll.y));
      let done = 0;
      clips.forEach((el, i) => {
        const delay = (i / targets.length) * .75;
        const p = Math.max(0, Math.min(1, (progress - delay) / .25));
        if (elapsed < 900) return;
        const conceal = Math.max(0, Math.min(1, (elapsed - 900 - (i / targets.length) * 400) / 400));
        el.style.setProperty("clip-path", `inset(0 ${100 * (elapsed < 1800 ? conceal : 1 - p)}% 0 0)`);
        if (p >= 1) done++;
      });
      cursors.forEach((operator, i) => {
        const batch = Math.floor(progress * Math.ceil(targets.length / count));
        const target = targets[Math.min(targets.length - 1, batch * count + i)];
        if (!target) return;
        const box = target.getBoundingClientRect();
        const visible = box.bottom > 0 && box.top < innerHeight;
        const x = Math.max(12, Math.min(innerWidth - 80, visible ? box.left + box.width * (.25 + .5 * Math.abs(Math.sin(elapsed / (700 + i * 89)))) : 20 + (innerWidth - 100) * ((i + .5) / count)));
        const y = Math.max(60, Math.min(innerHeight - 80, visible ? box.top + box.height * (.3 + .4 * Math.abs(Math.cos(elapsed / (900 + i * 63)))) : 100 + (innerHeight - 250) * ((i + .5) / count)));
        operator.x += (x - operator.x) * .09; operator.y += (y - operator.y) * .09;
        operator.cursor.style.transform = `translate3d(${operator.x}px,${operator.y}px,0)`;
        operator.cursor.classList.toggle("swarm-click", Math.sin(elapsed / 280 + i) > .8);
        operator.outline.style.display = visible && elapsed > 900 ? "block" : "none";
        operator.outline.style.left = `${box.left}px`; operator.outline.style.top = `${box.top}px`;
        operator.outline.style.width = `${box.width}px`; operator.outline.style.height = `${box.height}px`;
      });
      update(done, targets.length, true);
      if (progress >= 1) { stop(); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  };
  return { start, stop };
}