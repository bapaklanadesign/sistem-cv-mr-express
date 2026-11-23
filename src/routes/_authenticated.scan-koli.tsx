import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Camera, CameraOff, Sparkles, Trash2 } from "lucide-react";
import { PageHeader } from "./_authenticated";
import { Panel } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { plMeta } from "@/components/packing/shared";
import { plListQ } from "@/lib/packing-data";
import { labelCount } from "@/lib/packing-pdf";
import { matchScans } from "@/lib/koli-verify";
import { verifyKoliScans } from "@/lib/koli-verify.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/scan-koli")({
  head: () => plMeta("Scan Label Koli", "Pindai QR label koli dan cocokkan dengan data Packing List."),
  component: Page,
});

type AiResult = Awaited<ReturnType<typeof verifyKoliScans>>;

function Page() {
  const q = useQuery(plListQ());
  const [plId, setPlId] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [manual, setManual] = useState("");
  const [camOn, setCamOn] = useState(false);
  const [ai, setAi] = useState<AiResult | null>(null);
  const [busy, setBusy] = useState(false);
  const verify = useServerFn(verifyKoliScans);
  const pl = q.data?.find((p) => p.id === plId);
  const total = pl ? labelCount(pl.total_koli) : 0;
  const local = useMemo(() => (pl ? matchScans(pl.pl_number, total, codes) : null), [pl, total, codes]);

  const add = (c: string) => {
    const code = c.trim(); if (!code) return;
    setCodes((prev) => { if (prev.includes(code)) return prev; toast.success(`Terbaca: ${code.split("|").slice(1).join(" · ") || code}`); return [...prev, code]; });
    setAi(null);
  };

  const runAi = async () => {
    if (!plId) return;
    setBusy(true);
    try { setAi(await verify({ data: { plId, codes } })); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Gagal mencocokkan"); }
    finally { setBusy(false); }
  };

  const verified = new Set(ai?.verified ?? local?.verified ?? []);
  return (
    <>
      <PageHeader title="Scan Label Koli" subtitle="Pindai QR di stiker koli lalu cocokkan dengan data Packing List" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="1. Pilih Packing List">
          <Select value={plId} onValueChange={(v) => { setPlId(v); setCodes([]); setAi(null); }}>
            <SelectTrigger aria-label="Packing List"><SelectValue placeholder="Pilih Packing List" /></SelectTrigger>
            <SelectContent>{q.data?.map((p) => <SelectItem key={p.id} value={p.id}>{p.pl_number} · {p.consignee?.name ?? "-"} ({labelCount(p.total_koli)} koli)</SelectItem>)}</SelectContent>
          </Select>
          <div className="mt-4 space-y-3">
            <Button size="sm" variant={camOn ? "outline" : "default"} disabled={!plId} onClick={() => setCamOn((v) => !v)}>
              {camOn ? <><CameraOff className="h-4 w-4" />Matikan kamera</> : <><Camera className="h-4 w-4" />Pindai dengan kamera</>}
            </Button>
            {camOn && <Scanner onCode={add} />}
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); add(manual); setManual(""); }}>
              <Input placeholder="Atau ketik / tempel kode label" value={manual} onChange={(e) => setManual(e.target.value)} disabled={!plId} />
              <Button type="submit" size="sm" variant="outline" disabled={!plId}>Tambah</Button>
            </form>
          </div>
        </Panel>
        <Panel title={`2. Hasil (${local?.verified.length ?? 0}/${total} koli terverifikasi)`} action={<div className="flex gap-2">
          <Button size="sm" variant="ghost" disabled={!codes.length} onClick={() => { setCodes([]); setAi(null); }}><Trash2 className="h-4 w-4" />Reset</Button>
          <Button size="sm" onClick={runAi} disabled={!plId || busy}><Sparkles className="h-4 w-4" />{busy ? "Mencocokkan..." : "Cocokkan dengan AI"}</Button></div>}>
          {!pl ? <p className="text-sm text-muted-foreground">Pilih Packing List terlebih dahulu.</p> : <>
            <div className="grid grid-cols-8 gap-1 sm:grid-cols-10">
              {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
                <span key={n} title={verified.has(n) ? "Terverifikasi" : "Belum terverifikasi"}
                  className={cn("rounded py-1 text-center text-[11px] font-bold", verified.has(n) ? "bg-success text-primary-foreground" : "bg-destructive/15 text-destructive")}>{n}</span>))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Hijau = terverifikasi · Merah = belum terverifikasi</p>
            {!!local?.problems.length && <div className="mt-3 space-y-1"><p className="text-xs font-semibold text-destructive">Label bermasalah</p>
              {local.problems.map((p) => <p key={p.code} className="break-all text-xs">{p.code} — {p.reason}</p>)}</div>}
            {ai && <div className="mt-4 rounded-md border bg-muted/40 p-3 text-sm"><p className="mb-1 flex items-center gap-1 text-xs font-semibold"><Sparkles className="h-3 w-3" />Ringkasan AI</p>
              <p className="whitespace-pre-line">{ai.summary || "Ringkasan AI tidak tersedia saat ini. Hasil pencocokan di atas tetap berlaku."}</p></div>}
          </>}
        </Panel>
      </div>
    </>
  );
}

function Scanner({ onCode }: { onCode: (c: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const cb = useRef(onCode); cb.current = onCode;
  const [err, setErr] = useState("");
  useEffect(() => {
    let stream: MediaStream | null = null; let raf = 0; let stop = false; let last = ""; let lastAt = 0;
    (async () => {
      try {
        const jsQR = (await import("jsqr")).default;
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        const v = video.current; if (!v || stop) return;
        v.srcObject = stream; await v.play();
        const canvas = document.createElement("canvas"); const ctx = canvas.getContext("2d", { willReadFrequently: true });
        const tick = () => {
          if (stop) return;
          if (ctx && v.videoWidth) {
            canvas.width = v.videoWidth; canvas.height = v.videoHeight; ctx.drawImage(v, 0, 0);
            const r = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
            if (r?.data && (r.data !== last || Date.now() - lastAt > 3000)) { last = r.data; lastAt = Date.now(); cb.current(r.data); }
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch { setErr("Kamera tidak dapat dibuka. Izinkan akses kamera atau ketik kode secara manual."); }
    })();
    return () => { stop = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, []);
  return err ? <p className="text-sm text-destructive">{err}</p> : <video ref={video} muted playsInline className="w-full rounded-md border bg-muted" />;
}
