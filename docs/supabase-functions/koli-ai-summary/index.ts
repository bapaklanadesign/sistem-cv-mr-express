// Supabase Edge Function: writes a short Indonesian summary of koli scan results.
// Requires secret AI_API_KEY (OpenAI-compatible) set via: supabase secrets set AI_API_KEY=...
// Optional AI_BASE_URL (default https://api.openai.com/v1) and AI_MODEL (default gpt-4o-mini).
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "content-type": "application/json" } });
  const auth = req.headers.get("Authorization") ?? "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);
  const key = Deno.env.get("AI_API_KEY");
  if (!key) return json({ summary: "" });
  const input = JSON.stringify(await req.json()).slice(0, 20000);
  const res = await fetch(`${Deno.env.get("AI_BASE_URL") ?? "https://api.openai.com/v1"}/chat/completions`, {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ model: Deno.env.get("AI_MODEL") ?? "gpt-4o-mini", messages: [
      { role: "system", content: "Anda membantu petugas gudang ekspedisi memverifikasi koli. Tulis ringkasan singkat (maks 4 kalimat, Bahasa Indonesia) dari hasil pencocokan: berapa koli terverifikasi, nomor koli yang belum terverifikasi (ringkas sebagai rentang), dan label bermasalah beserta kemungkinan penyebabnya. Jangan mengarang angka di luar data." },
      { role: "user", content: input }] }),
  });
  if (!res.ok) return json({ summary: "" });
  const out = await res.json();
  return json({ summary: String(out?.choices?.[0]?.message?.content ?? "").trim() });
});
