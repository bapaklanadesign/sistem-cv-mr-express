import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { createSwarm, swarmDefaults, type SwarmConfig } from "@/lib/swarm-rebuild";

declare global {
  interface Window { SwarmRebuild?: { start: (config?: Partial<SwarmConfig>) => void; stop: () => void; config: SwarmConfig } }
}
export function SwarmRebuild() {
  const layer = useRef<HTMLDivElement>(null);
  const [state, setState] = useState({ done: 0, total: 0, active: false });
  useEffect(() => {
    const overlay = layer.current, root = document.querySelector<HTMLElement>(".journey-site");
    if (!overlay || !root) return;
    const engine = createSwarm(root, overlay, (done, total, active) => setState({ done, total, active }));
    const api = { config: { ...swarmDefaults }, start: (options?: Partial<SwarmConfig>) => engine.start({ ...api.config, ...options }), stop: engine.stop };
    window.SwarmRebuild = api;
    const timer = window.setTimeout(() => { if (api.config.auto) api.start(); }, 1000);
    return () => { clearTimeout(timer); engine.stop(); if (window.SwarmRebuild === api) delete window.SwarmRebuild; };
  }, []);
  return <>
    <div ref={layer} className="swarm-layer" aria-hidden="true" />
    {state.active && <div className="swarm-hud" role="status">
      <span>SWARM REBUILD · {window.SwarmRebuild?.config.cursorCount ?? 7} OPERATOR · {state.done}/{state.total} ELEMEN</span>
      <progress max={state.total || 1} value={state.done} aria-label="Progres rebuild" />
      <Button variant="outline" size="sm" onClick={() => window.SwarmRebuild?.stop()}>Lewati Animasi</Button>
    </div>}
  </>;
}
