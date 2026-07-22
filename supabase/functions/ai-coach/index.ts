// ATHLOS — AI trener (Supabase Edge Function)
//
// Podpira dva ponudnika:
//   1. Claude (ANTHROPIC_API_KEY) — najboljši odgovori, plačljivo po porabi
//   2. Google Gemini (GEMINI_API_KEY) — BREZPLAČEN nivo, uporabljen kot rezerva
// Funkcija najprej poskusi Claude; če ključa ni ali nima kreditov, uporabi Gemini.
// Ključa sta Supabase secrets in NIKOLI ne prideta v aplikacijo/brskalnik.
//
// Varnost (glej varnostni pregled — RLS/IDOR/rate-limit popravki):
//   - Klic MORA nositi veljaven Supabase JWT; brez njega 401 (enak vzorec kot
//     delete-account/index.ts).
//   - profile/memory se NE zaupata iz telesa zahteve — funkcija ju sama
//     prebere iz baze za PREVERJENEGA uporabnika (RLS na profiles/coach_memory
//     to itak dovoljuje samo za lastno vrstico).
//   - Omejitev klicev: največ AI_COACH_RATE_LIMIT vprašanj na
//     AI_COACH_RATE_WINDOW_MIN minut na uporabnika (šteto iz ai_messages),
//     da en račun ne more ustvariti neomejenega (dragega) prometa.
//   - ai_messages zapisuje SAMO ta funkcija (ne več klient), da je štetje za
//     rate-limit avtoritativno.
//
// Deploy: supabase functions deploy ai-coach
// Nastavi (poljubno): supabase secrets set AI_COACH_RATE_LIMIT=30 AI_COACH_RATE_WINDOW_MIN=60

import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: cors });
}

// Builds the system prompt — now a LEARNING coach that knows the athlete.
// `memory` is the per-athlete blob: { setup, notes[], feedback[] } (see coach_memory).
function buildSystem(profile: Record<string, any> = {}, memory: Record<string, any> = {}) {
  const setup = (memory && memory.setup) || {};
  const notes: string[] = Array.isArray(memory?.notes) ? memory.notes : [];
  const feedback: any[] = Array.isArray(memory?.feedback) ? memory.feedback : [];

  const lines = [
    "Si ATHLOS Coach — oseben AI trener v aplikaciji ATHLOS, ki športnika POZNA in se z vsakim pogovorom uči o njem.",
    "Odgovarjaš IZKLJUČNO v slovenščini, jedrnato (2–6 stavkov), konkretno in prijazno.",
    "Pokrivaš: trening, periodizacijo, regeneracijo, prehrano, preventivo poškodb in motivacijo.",
    "Pri bolečinah svetuj previdnost; pri hujših težavah priporoči zdravnika ali fizioterapevta.",
    "Ne odgovarjaj na teme izven športa — prijazno preusmeri nazaj na trening.",
  ];

  // ── KAR VEŠ o športniku (profil + funnel memory) ──
  const know: string[] = [];
  if (profile.name) know.push(`Ime: ${profile.name}.`);
  if (profile.sport) know.push(`Šport: ${profile.sport}.`);
  if (profile.height) know.push(`Višina: ${profile.height} cm.`);
  if (profile.weight) know.push(`Teža: ${profile.weight} kg.`);
  if (setup.goal) know.push(`Glavni cilj: ${setup.goal}.`);
  if (setup.level) know.push(`Nivo: ${setup.level}.`);
  if (setup.seasonPhase) know.push(`Faza sezone: ${setup.seasonPhase}.`);
  if (Array.isArray(setup.equipment) && setup.equipment.length) know.push(`Oprema: ${setup.equipment.join(", ")}.`);
  if (setup.daysPerWeek) know.push(`Dni treninga na teden: ${setup.daysPerWeek}.`);
  if (setup.sessionMinutes) know.push(`Trajanje treninga: ${setup.sessionMinutes} min.`);
  if (Array.isArray(setup.injuries) && setup.injuries.length) {
    know.push(`Poškodbe/omejitve: ${setup.injuries.join(", ")} — OBVEZNO se izogni vajam, ki te predele boleče obremenijo.`);
  }
  if (know.length) lines.push("KAR VEŠ O ŠPORTNIKU (uporabi, NE sprašuj znova): " + know.join(" "));

  // ── zadnje povratne informacije s treningov ──
  if (feedback.length) {
    const recent = feedback.slice(-4).map((f) => {
      const p: string[] = [];
      if (f?.rpe != null) p.push(`RPE ${f.rpe}`);
      if (f?.completed != null) p.push(f.completed ? "opravljeno" : "ni opravljeno");
      if (Array.isArray(f?.pain) && f.pain.length) p.push(`bolečina: ${f.pain.join(", ")}`);
      if (f?.note) p.push(String(f.note));
      return p.join(", ");
    }).filter(Boolean);
    if (recent.length) lines.push("ZADNJE POVRATNE INFORMACIJE S TRENINGOV: " + recent.join(" | ") + ".");
  }

  // ── naučene opombe ──
  if (notes.length) lines.push("NAUČENE OPOMBE O ŠPORTNIKU: " + notes.slice(-12).join(" | ") + ".");

  // ── učna pravila ──
  lines.push("PRAVILA: Sklicuj se na to, kar že veš. Vsak nasvet/plan NADGRAJUJE prejšnje (progresivna obremenitev). Upoštevaj povratne informacije: pri RPE 9–10 ali 'ni opravljeno' znižaj obremenitev; pri nizkem RPE in vse opravljeno stopnjuj. Izogni se vajam, ki obremenjujejo poškodovane predele.");
  lines.push("UČENJE: ko izveš NOVO TRAJNO dejstvo o športniku (cilj, omejitev, preferenca, napredek), na KONEC odgovora dodaj oznako [[NOTE: kratko dejstvo]] — športnik je NE vidi, aplikacija si jo zapomni. Uporabi redko in samo za trajna dejstva.");

  return lines.filter(Boolean).join(" ");
}

// Strips [[NOTE: ...]] tags from a reply and returns the clean text + the
// extracted notes — mirrors parseCoachReply() in src/lib/api.js exactly.
function parseCoachReply(reply: string): { text: string; notes: string[] } {
  const r = String(reply || "");
  const notes: string[] = [];
  const re = /\[\[NOTE:\s*([^\]]+?)\s*\]\]/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(r)) !== null) { const t = m[1].trim(); if (t) notes.push(t); }
  const text = r.replace(/\[\[NOTE:[^\]]*\]\]/gi, "").replace(/\n{3,}/g, "\n\n").trim();
  return { text, notes };
}

type Msg = { role: "user" | "assistant"; content: string };
// Priponka iz aplikacije: slika ali PDF kot base64 — jo vidita OBA ponudnika.
type Attachment = { name?: string; mime: string; data: string };

function sanitizeHistory(history: unknown): Msg[] {
  const msgs = (Array.isArray(history) ? history : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content }));
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  return msgs;
}

function sanitizeAttachment(a: unknown): Attachment | null {
  if (!a || typeof a !== "object") return null;
  const { mime, data, name } = a as Record<string, unknown>;
  if (typeof mime !== "string" || typeof data !== "string" || !data) return null;
  if (!mime.startsWith("image/") && mime !== "application/pdf") return null;
  if (data.length > 8_000_000) return null; // ~6 MB datoteke; ščiti kvoto
  return { mime, data, name: typeof name === "string" ? name : undefined };
}

async function askClaude(system: string, msgs: Msg[], attachment: Attachment | null): Promise<string> {
  const client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });
  // zadnje uporabnikovo sporočilo postane multimodalno, ko je priložena datoteka
  const messages: any[] = msgs.map((m) => ({ role: m.role, content: m.content }));
  if (attachment && messages.length) {
    const last = messages[messages.length - 1];
    const media = attachment.mime === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: attachment.data } }
      : { type: "image", source: { type: "base64", media_type: attachment.mime, data: attachment.data } };
    last.content = [media, { type: "text", text: last.content }];
  }
  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    system,
    messages,
  });
  return response.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
}

async function askGemini(system: string, msgs: Msg[], attachment: Attachment | null): Promise<string> {
  const key = Deno.env.get("GEMINI_API_KEY");
  const contents = msgs.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }] as any[],
  }));
  if (attachment && contents.length) {
    contents[contents.length - 1].parts.unshift({
      inline_data: { mime_type: attachment.mime, data: attachment.data },
    });
  }
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { maxOutputTokens: 2048, thinkingConfig: { thinkingBudget: 0 } },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const reply = (data?.candidates?.[0]?.content?.parts || [])
    .map((p: { text?: string }) => p.text || "")
    .join("")
    .trim();
  if (!reply) throw new Error("Gemini: prazen odgovor");
  return reply;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    // ── 1. Preveri JWT — enak vzorec kot delete-account/index.ts ──
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "Not authenticated." }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const asUser = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
    const { data: userData, error: userErr } = await asUser.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Invalid session." }, 401);
    const userId = userData.user.id;

    const { question, history = [], attachment = null } = await req.json();
    if (!question || typeof question !== "string") {
      return json({ error: "Manjka vprašanje." }, 400);
    }

    // ── 2. Omejitev klicev — štej iz ai_messages, avtoritativno na strežniku ──
    const limit = Number(Deno.env.get("AI_COACH_RATE_LIMIT") ?? 30);
    const windowMin = Number(Deno.env.get("AI_COACH_RATE_WINDOW_MIN") ?? 60);
    const since = new Date(Date.now() - windowMin * 60_000).toISOString();
    const { count: recentCount } = await asUser
      .from("ai_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("role", "user").gte("created_at", since);
    if ((recentCount ?? 0) >= limit) {
      return json({ error: "rate_limited", retryAfterMin: windowMin }, 429);
    }

    // ── 3. profile/memory se BEREJO iz baze za preverjenega uporabnika —
    //     telo zahteve ju ne more več ponarediti. ──
    const [{ data: profileRow }, { data: memoryRow }] = await Promise.all([
      asUser.from("profiles").select("name, sport, height, weight").eq("id", userId).maybeSingle(),
      asUser.from("coach_memory").select("data").eq("user_id", userId).maybeSingle(),
    ]);
    const profile = profileRow || {};
    const memory = memoryRow?.data || {};

    const system = buildSystem(profile, memory);
    const msgs = sanitizeHistory(history);
    msgs.push({ role: "user", content: question });
    const att = sanitizeAttachment(attachment);

    // Zabeleži vprašanje TAKOJ (šteje za rate-limit tudi če LLM klic spodaj spodleti).
    await asUser.from("ai_messages").insert({ user_id: userId, role: "user", content: question });

    const errors: string[] = [];
    let rawReply: string | null = null;
    let provider = "";

    if (Deno.env.get("ANTHROPIC_API_KEY")) {
      try {
        rawReply = await askClaude(system, msgs, att);
        provider = "claude";
      } catch (e) {
        errors.push(`claude: ${e?.message || e}`);
      }
    }
    if (!rawReply && Deno.env.get("GEMINI_API_KEY")) {
      try {
        rawReply = await askGemini(system, msgs, att);
        provider = "gemini";
      } catch (e) {
        errors.push(`gemini: ${e?.message || e}`);
      }
    }

    if (!rawReply) {
      return json(
        { error: errors.length ? errors.join(" | ") : "Noben AI ključ ni nastavljen (ANTHROPIC_API_KEY ali GEMINI_API_KEY)." },
        500,
      );
    }

    const { text, notes } = parseCoachReply(rawReply);
    await asUser.from("ai_messages").insert({ user_id: userId, role: "assistant", content: text });

    return json({ reply: text, notes, provider });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
});
