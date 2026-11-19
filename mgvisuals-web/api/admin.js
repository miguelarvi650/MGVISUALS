const db = require("../lib/db");
const mail = require("../lib/mail");
const { isAdmin } = require("../lib/auth");
const U = require("../lib/users");
const IDRE = /^[a-z0-9-]{4,40}$/i;
const BLOB = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i;
const clip = (v, n) => String(v == null ? "" : v).trim().slice(0, n);
const num = (v) => (v === "" || v == null || isNaN(Number(v)) ? "" : Number(v));
function cleanCamp(d) {
  const fases = (Array.isArray(d.fases) ? d.fases : []).slice(0, 3).map((f) => ({ p1: num(f.p1), p2: num(f.p2), p3: num(f.p3), pc: num(f.pc), q1: num(f.q1), qc: num(f.qc) }));
  const s = ["open", "soon", "done", "closed"].includes(d.s) ? d.s : "open";
  return { n: clip(d.n, 120), d: clip(d.d, 120), s, fase: Math.max(0, Math.min(Number(d.fase) || 0, Math.max(fases.length - 1, 0))), fases,
    pruebas: (Array.isArray(d.pruebas) ? d.pruebas : []).slice(0, 60).map((x) => clip(x, 60)).filter(Boolean),
    cats: [...new Set((Array.isArray(d.cats) ? d.cats : []).filter((x) => U.CATS.includes(x)))],
    abre: s === "soon" && Number(d.abre) > 0 ? Number(d.abre) : 0, ts: Number(d.ts) || Date.now() };
}
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!isAdmin(req)) return res.status(401).json({ error: "No autorizado" });
  try {
    if (req.method === "GET") return res.status(200).json({ reservas: await db.all("reservas") });
    if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });
    if (!String(req.headers["content-type"] || "").includes("application/json")) return res.status(415).json({ error: "Formato no válido" });
    const b = req.body || {}, id = clip(b.id, 40), bad = (m) => res.status(400).json({ error: m });
    switch (b.action) {
      case "camp:set": {
        if (!IDRE.test(id)) return bad("Identificador no válido");
        const c = cleanCamp(b.data || {});
        if (!c.n) return bad("Pon un nombre al campeonato.");
        const prev = await db.get("camps", id);
        if (prev && prev.avisado) c.avisado = prev.avisado;
        let avisados = null, avisoError = false;
        if (b.data && b.data.avisar && c.cats.length && (c.s === "soon" || c.s === "open")) {
          try {
            const to = (await db.all("users")).filter((u) => u.verified && u.avisos && c.cats.includes(u.cat)).map((u) => u.id);
            const site = process.env.SITE_URL || "https://" + req.headers.host;
            for (let i = 0; i < to.length; i += 40) await mail.nuevoCampeonato(to.slice(i, i + 40), c, site);
            avisados = to.length; if (to.length) c.avisado = Date.now();
          } catch (e) { console.error("aviso campeonato", e); avisoError = true; }
        }
        await db.put("camps", id, c);
        return res.status(200).json({ ok: true, avisados, avisoError });
      }
      case "camp:delete":
        if (!IDRE.test(id)) return bad("Identificador no válido");
        await db.del("camps", id); await db.redis.del("pre:" + id);
        return res.status(200).json({ ok: true });
      case "foto:set": {
        const d = b.data || {};
        if (!IDRE.test(id) || !BLOB.test(String(d.url || ""))) return bad("Foto no válida");
        await db.put("fotos", id, { assetId: clip(d.assetId, 400), url: clip(d.url, 400), champ: clip(d.champ, 120), name: clip(d.name, 120), ts: Number(d.ts) || Date.now() });
        return res.status(200).json({ ok: true });
      }
      case "foto:delete":
        if (!IDRE.test(id)) return bad("Identificador no válido");
        await db.del("fotos", id); return res.status(200).json({ ok: true });
      case "blob:delete": {
        const u = String(b.url || "");
        if (!BLOB.test(u)) return bad("Archivo no válido");
        await require("@vercel/blob").del(u);
        return res.status(200).json({ ok: true });
      }
      case "ajustes:set": {
        const d = b.data || {};
        await db.setKey("ajustes", { email: clip(d.email, 120), ig: clip(d.ig, 60).replace(/^@/, ""), pago: clip(d.pago, 1000) });
        return res.status(200).json({ ok: true });
      }
      case "reserva:update": {
        const r = await db.get("reservas", id);
        if (!r) return res.status(404).json({ error: "Reserva no encontrada" });
        const est = clip(b.data && b.data.estado, 20);
        if (!["pendiente", "pagada", "prereserva"].includes(est)) return bad("Estado no válido");
        const was = r.estado; r.estado = est;
        if (est === "pagada") r.pagadaTs = Date.now();
        await db.put("reservas", id, r);
        let emailOk = null;
        if (est === "pagada" && was !== "pagada" && r.tipo !== "prereserva") {
          try { await mail.confirmada(r, (await db.getKey("ajustes")) || {}); emailOk = true; } catch (e) { console.error("email confirmada", e); emailOk = false; }
        }
        return res.status(200).json({ ok: true, emailOk });
      }
      case "reserva:delete":
        await db.del("reservas", id); return res.status(200).json({ ok: true });
      default: return bad("Acción no válida");
    }
  } catch (e) { console.error(e); return res.status(500).json({ error: "Error del servidor" }); }
};
