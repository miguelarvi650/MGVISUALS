const crypto = require("crypto");
const db = require("../lib/db");
const mail = require("../lib/mail");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clip = (v, n) => String(v == null ? "" : v).trim().slice(0, n);
const num = (v) => (v === "" || v == null || isNaN(Number(v)) ? null : Number(v));
const fail = (status, msg) => { const e = new Error(msg); e.status = status; throw e; };

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });
  let r, aj;
  try {
    const b = req.body || {};
    const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "0";
    const rk = "rl:res:" + ip;
    const hits = await db.redis.incr(rk);
    if (hits === 1) await db.redis.expire(rk, 3600);
    if (hits > 15) fail(429, "Demasiados intentos. Inténtalo más tarde.");
    const nombre = clip(b.nombre, 100), sexo = clip(b.sexo, 30), email = clip(b.email, 120).toLowerCase();
    if (!nombre || !sexo || !EMAIL.test(email)) fail(400, "Completa nombre, sexo y un email válido.");
    const campId = clip(b.campId, 60);
    aj = (await db.getKey("ajustes")) || {};
    const lock = "lock:" + campId;
    let got = null;
    for (let i = 0; i < 20 && !got; i++) {
      got = await db.redis.set(lock, "1", { nx: true, ex: 10 });
      if (!got) await new Promise((s) => setTimeout(s, 150));
    }
    if (!got) fail(503, "Servidor ocupado, inténtalo de nuevo.");
    try {
      const c = await db.get("camps", campId);
      if (!c) fail(404, "Campeonato no encontrado.");
      const now = Date.now();
      let estado = c.s;
      if (c.s === "soon" && c.abre) {
        if (now >= c.abre) estado = "open";
        else if (now >= c.abre - 36e5 && (await db.redis.sismember("pre:" + c.id, email))) estado = "open";
      }
      const pre = estado === "soon";
      if (!pre && estado !== "open") fail(409, "Este campeonato no admite reservas ahora.");
      const list = c.pruebas || [];
      const sel = [...new Set((Array.isArray(b.pruebas) ? b.pruebas : []).map((x) => clip(x, 60)).filter((x) => list.includes(x)))];
      let pack = "Prereserva", precio = null, ch = sel;
      if (pre) {
        if (list.length && !sel.length) fail(400, "Elige al menos una prueba.");
      } else {
        const f = (c.fases || [])[c.fase || 0];
        if (!f) fail(409, "Todavía no hay precios disponibles.");
        let key;
        if (b.key === "pc") { key = "pc"; ch = []; }
        else if (list.length) { if (sel.length < 1 || sel.length > 3) fail(400, "Elige entre 1 y 3 pruebas."); key = "p" + sel.length; }
        else { key = ["p1", "p2", "p3"].includes(b.key) ? b.key : null; if (!key) fail(400, "Elige un pack de fotos."); ch = []; }
        precio = num(f[key]);
        if (precio === null) fail(400, "Ese pack no está disponible en esta fase.");
        const qk = key === "pc" ? "qc" : "q1", q = num(f[qk]);
        if (q !== null && q <= 0) fail(409, "Plazas agotadas en esta fase.");
        if (q !== null) f[qk] = q - 1;
        const tracked = [num(f.q1), num(f.qc)].filter((x) => x !== null);
        if (tracked.length && tracked.every((x) => x <= 0) && (c.fases || [])[(c.fase || 0) + 1]) c.fase = (c.fase || 0) + 1;
        pack = key === "pc" ? "Combinadas · " + precio + "€" : { p1: "1 prueba", p2: "2 pruebas", p3: "3 pruebas" }[key] + " · " + precio + "€";
        await db.put("camps", c.id, c);
      }
      const code = (pre ? "PRE-" : "MGV-") + Date.now().toString(36).toUpperCase().slice(-6) + crypto.randomBytes(2).toString("hex").toUpperCase();
      r = { code, tipo: pre ? "prereserva" : "reserva", abre: c.abre || 0, camp: c.n, campId: c.id, fecha: c.d || "", nombre, sexo, email,
        tel: clip(b.tel, 40), ig: clip(b.ig, 60), pack, pruebas: ch, precio, estado: pre ? "prereserva" : "pendiente", ts: now };
      await db.put("reservas", code, r);
      if (pre) await db.redis.sadd("pre:" + c.id, email);
    } finally { await db.redis.del(lock); }
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error(e);
    return res.status(500).json({ error: "Error del servidor. Inténtalo de nuevo." });
  }
  let emailOk = true;
  try { await (r.tipo === "prereserva" ? mail.prereserva(r, aj) : mail.recibida(r, aj)); } catch (e) { emailOk = false; console.error("email cliente", e); }
  try { await mail.aviso(r); } catch (e) { console.error("email aviso", e); }
  res.status(200).json({ reserva: r, emailOk });
};
