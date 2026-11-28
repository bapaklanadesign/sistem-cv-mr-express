export const isSwarmLanding = (pathname: string) => pathname === "/";

export type SwarmConfig = {
  cursorCount: number; colors: string[]; speed: number; duration: number;
  order: string[]; auto: boolean;
};
export const swarmDefaults: SwarmConfig = {
  cursorCount: 7,
  colors: ["var(--swarm-red)", "var(--swarm-blue)", "var(--swarm-cyan)", "var(--swarm-green)", "var(--swarm-yellow)", "var(--swarm-purple)", "var(--swarm-orange)"],
  speed: 1, duration: 180000, auto: true,
  order: [".j-backdrop", ".j-nav .j-logo", ".j-links a", ".j-btn-sm", ".j-burger", ".j-hero > *", ".j-cue", ".j-blk:not(.j-hero):not(.j-cue) > *", ".j-sec .j-eyebrow", ".j-sec h2", ".j-sec .j-lead", ".j-adv-card", ".j-map", ".j-note", ".j-collage", ".j-more", ".j-cta-sec .j-btn", ".j-phone", ".s-foot-grid > *", ".s-foot-base"],
};
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (v: number) => v < .5 ? 4 * v ** 3 : 1 - (-2 * v + 2) ** 3 / 2;
const names = ["Ayu", "Bima", "Citra", "Dani", "Eka", "Fajar", "Gita"];
type Item = { el: HTMLElement; state: "waiting" | "working" | "done" };
type Operator = {
  cursor: HTMLElement; outline: HTMLElement; scan: HTMLElement;
  item?: Item | undefined; phase: "idle" | "move" | "dwell" | "build";
  x: number; y: number; fx: number; fy: number; tx: number; ty: number;
  start: number; duration: number; bend: number; pace: number;
};

/** Independent visual jobs; simulated clicks never dispatch native events. */
export function createSwarm(root: HTMLElement, layer: HTMLElement, update: (done: number, total: number, active: boolean) => void) {
  let raf = 0, running = false;
  let restore: (() => void)[] = [];
  const stop = () => {
    running = false; cancelAnimationFrame(raf);
    restore.reverse().forEach(fn => fn()); restore = [];
    layer.replaceChildren(); update(0, 0, false);
  };
  const start = (options: Partial<SwarmConfig> = {}) => {
    stop();
    if (!isSwarmLanding(location.pathname) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const config = { ...swarmDefaults, ...options };
    const speed = clamp(config.speed || 1, .1, 10);
    const elements = [...new Set(config.order.flatMap(selector => [...root.querySelectorAll<HTMLElement>(selector)]))];
    const targets = elements.filter(el => !elements.some(parent => parent !== el && parent.contains(el)))
      .filter(el => getComputedStyle(el).display !== "none");
    if (!targets.length) return;
    const items: Item[] = targets.map(el => ({ el, state: "waiting" }));
    running = true;
    const saveStyle = (el: HTMLElement, key: string, value?: string) => {
      const old = el.style.getPropertyValue(key), priority = el.style.getPropertyPriority(key);
      restore.push(() => { if (old) el.style.setProperty(key, old, priority); else el.style.removeProperty(key); });
      if (value !== undefined) el.style.setProperty(key, value, "important");
    };
    const scroll = { x: scrollX, y: scrollY };
    saveStyle(document.documentElement, "scroll-behavior", "auto");
    saveStyle(document.documentElement, "overflow", "hidden");
    const onResize = () => stop();
    addEventListener("resize", onResize);
    restore.push(() => {
      removeEventListener("resize", onResize);
      if (isSwarmLanding(location.pathname)) window.scrollTo(scroll.x, scroll.y);
    });
    // A single scoped flag makes hidden scroll-story captions measurable without changing their final styles.
    const previousFlag = root.hasAttribute("data-swarm-running");
    root.setAttribute("data-swarm-running", "");
    restore.push(() => { if (!previousFlag) root.removeAttribute("data-swarm-running"); });
    targets.forEach(el => saveStyle(el, "clip-path"));
    window.scrollTo(0, 0);
    const make = (cls: string, parent = layer) => {
      const el = document.createElement("div"); el.className = cls; parent.append(el); return el;
    };
    const sweep = make("swarm-sweep");
    const count = clamp(Math.floor(config.cursorCount) || 7, 1, 14);
    const operators: Operator[] = Array.from({ length: count }, (_, i) => {
      const cursor = make("swarm-cursor");
      const color = config.colors[i % config.colors.length] ?? swarmDefaults.colors[0] ?? "var(--primary)";
      cursor.style.setProperty("--operator-color", color);
      const arrow = document.createElement("span"); arrow.className = "swarm-arrow";
      const label = document.createElement("span"); label.className = "swarm-name"; label.textContent = names[i % names.length] ?? "Operator";
      cursor.append(arrow, label);
      const outline = make("swarm-outline"); outline.style.setProperty("--operator-color", color); outline.hidden = true;
      const scan = make("swarm-scan", outline);
      const x = i % 2 ? innerWidth + 60 : -80, y = 80 + Math.random() * Math.max(1, innerHeight - 200);
      return { cursor, outline, scan, phase: "idle", x, y, fx: x, fy: y, tx: x, ty: y, start: 0, duration: 0, bend: 0, pace: .8 + Math.random() * .6 };
    });
    let done = 0, lastDone = -1, finish = 0, lastTime = performance.now();
    const begin = lastTime;
    const sceneScroll = (item: Item) => {
      if (item.el.closest(".j-hero, .j-cue")) return 0;
      const scene = item.el.closest<HTMLElement>("[data-scene]");
      if (scene) {
        const box = scene.getBoundingClientRect();
        const offset = item.el.closest(".pos-top") ? .05 : .35;
        return clamp(box.top + scrollY + box.height * offset, 0, document.documentElement.scrollHeight - innerHeight);
      }
      const box = item.el.getBoundingClientRect();
      if (box.top >= 68 && box.bottom < innerHeight - 120) return scrollY;
      if (item.el.closest(".j-nav") || item.el.matches(".j-backdrop")) return 0;
      return clamp(box.top + scrollY - innerHeight * .28, 0, document.documentElement.scrollHeight - innerHeight);
    };
    const positionOutline = (op: Operator, box: DOMRect) => {
      op.outline.style.left = `${box.left}px`; op.outline.style.top = `${box.top}px`;
      op.outline.style.width = `${box.width}px`; op.outline.style.height = `${box.height}px`;
    };
    const claim = (op: Operator, now: number) => {
      const item = items.find(it => it.state === "waiting");
      if (!item) return;
      const desired = sceneScroll(item);
      if (Math.abs(desired - scrollY) > 50) return;
      const box = item.el.getBoundingClientRect();
      // Hidden mobile navigation has no box, so it needs no visible reconstruction.
      if (box.width < 2 || box.height < 2 || (item.el.closest(".j-nav") && (box.bottom < 0 || box.left > innerWidth || box.right < 0))) {
        item.state = "done"; done++; return;
      }
      if (box.bottom < 0 || box.top > innerHeight - 8) return;
      item.state = "working"; op.item = item; op.phase = "move";
      op.fx = op.x; op.fy = op.y;
      op.tx = clamp(box.left + box.width * (.1 + Math.random() * .25), 16, innerWidth - 90);
      op.ty = clamp(box.top + box.height * (.3 + Math.random() * .4), 72, innerHeight - 120);
      const distance = Math.hypot(op.tx - op.x, op.ty - op.y);
      op.duration = clamp((400 + distance * .8) * op.pace / speed, 180, 2200);
      op.bend = (Math.random() - .5) * Math.min(distance, 400) * .6; op.start = now;
    };
    update(0, targets.length, true);
    const tick = (now: number) => {
      if (!running || !isSwarmLanding(location.pathname)) { stop(); return; }
      const elapsed = now - begin, dt = Math.min(64, now - lastTime); lastTime = now;
      // Preserve the normal first view, sweep it away completely, then start actual cursor jobs.
      if (elapsed < 2400 / speed) {
        const conceal = clamp((elapsed - 700 / speed) / (1400 / speed));
        sweep.style.transform = `translateY(${conceal * innerHeight}px)`;
        sweep.style.opacity = elapsed > 700 / speed && conceal < 1 ? "1" : "0";
        targets.forEach((el, i) => {
          const p = clamp((conceal - i / targets.length * .45) / .55);
          if (conceal > 0) el.style.setProperty("clip-path", `inset(0 0 0 ${p * 100}%)`, "important");
        });
      } else {
        sweep.hidden = true;
        const busy = operators.some(op => op.item);
        if (!busy) {
          const next = items.find(item => item.state === "waiting");
          if (next) {
            const goal = sceneScroll(next), delta = goal - scrollY;
            window.scrollTo(0, Math.abs(delta) < 3 ? goal : scrollY + delta * (1 - Math.exp(-dt / 90)));
          }
        }
        operators.forEach((op, index) => {
          op.cursor.style.opacity = "1";
          if (op.phase === "idle" && elapsed > (2400 + index * 140) / speed) claim(op, now);
          const item = op.item;
          if (!item) return;
          const box = item.el.getBoundingClientRect();
          positionOutline(op, box);
          const p = clamp((now - op.start) / op.duration);
          if (op.phase === "move") {
            const u = ease(p), dx = op.tx - op.fx, dy = op.ty - op.fy, distance = Math.hypot(dx, dy) || 1;
            const curve = Math.sin(Math.PI * u) * op.bend;
            op.x = op.fx + dx * u - dy / distance * curve;
            op.y = op.fy + dy * u + dx / distance * curve;
            if (p === 1) { op.phase = "dwell"; op.start = now; op.duration = (150 + Math.random() * 250) / speed; op.outline.hidden = false; }
          } else if (op.phase === "dwell" && p === 1) {
            op.cursor.classList.add("swarm-click");
            const ripple = make("swarm-ripple", op.cursor);
            ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
            op.phase = "build"; op.start = now; op.duration = (500 + Math.min(box.width, 900) * .7) * op.pace / speed;
          } else if (op.phase === "build") {
            item.el.style.setProperty("clip-path", `inset(0 ${(1 - p) * 100}% 0 0)`, "important");
            op.scan.style.left = `${p * 100}%`;
            if (now - op.start > 140) op.cursor.classList.remove("swarm-click");
            if (p === 1) {
              item.state = "done"; done++; op.item = undefined; op.phase = "idle"; op.outline.hidden = true;
            }
          }
          op.cursor.style.transform = `translate3d(${op.x}px,${op.y}px,0)`;
        });
      }
      if (done !== lastDone) { update(done, targets.length, true); lastDone = done; }
      if (done === items.length) {
        if (!finish) finish = now;
        operators.forEach(op => { op.cursor.style.opacity = "0"; });
        window.scrollTo(0, scrollY * (1 - Math.min(1, dt / 100)));
        if (now - finish > 1600 / speed) { stop(); return; }
      }
      // Safety deadline always restores every native element, even if layout changes mid-run.
      if (elapsed > Math.max(4000, config.duration / speed)) { stop(); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  };
  return { start, stop };
}
