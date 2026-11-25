import { supabase } from "@/integrations/supabase/client";
import { matchScans } from "./koli-verify";
import { labelCount } from "./packing-pdf";

/** Deterministic matching runs in the browser; only the AI summary comes from the `koli-ai-summary` Supabase Edge Function. */
export async function verifyKoliScans(plId: string, codes: string[]) {
  const { data: pl, error } = await supabase.from("pl_packing_lists").select("pl_number,total_koli").eq("id", plId).maybeSingle();
  if (error || !pl) throw new Error("Packing List tidak ditemukan atau Anda tidak punya akses");
  const total = labelCount(pl.total_koli);
  const result = matchScans(pl.pl_number, total, codes.slice(0, 3000));
  let summary = "";
  try {
    const { data } = await supabase.functions.invoke("koli-ai-summary", {
      body: { packing_list: pl.pl_number, total_koli: total, jumlah_pindaian: codes.length, terverifikasi: result.verified.length, belum_terverifikasi: result.unverified, label_bermasalah: result.problems.slice(0, 50) },
    });
    summary = typeof data?.summary === "string" ? data.summary : "";
  } catch (e) { console.error("AI summary failed", e); }
  if (!summary) summary = `${result.verified.length} dari ${total} koli terverifikasi, ${result.unverified.length} belum terverifikasi, ${result.problems.length} label bermasalah.`;
  return { plNumber: pl.pl_number, total, ...result, summary };
}
