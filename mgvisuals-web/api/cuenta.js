const db = require("../lib/db");
const mail = require("../lib/mail");
const A = require("../lib/auth");
const U = require("../lib/users");
const S = require("../lib/stripe");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clip = (v, n) => String(v == null ? "" : v).trim().slice(0, n);
const base = (req) => process.env.SITE_URL || "https://" + req.headers.host;
const ipOf = (req) => String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "0";
async function limit(key, max, secs) {
  const n = await db.redis.incr(key);
  if (n === 1) await db.redis.expire(key, secs);
  return n <= max;
}
async function sessionUser(req) {
  const t = A.userCookie(req);
  if (!t || t.t !== "user") return null;
  const u = await db.get("users", t.e);
  if (!u || !u.verified || String(u.hash).slice(0, 10) !== t.p) return null;
  return u;
}
const startSession = (res, u) => A.setUserCookie(res, A.makePayloadToken({ t: "user", e: u.id, p: String(u.hash).slice(0, 10) }, 30 * 864e5));
const save = (u) => { const { id, ...rec } = u; return db.put("users", id, rec); };

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      const u = await sessionUser(req);
      if (!u) return res.status(200).json({ user: null });
      const rs = (await db.all("reservas")).filter((r) => U.norm(r.email) === u.id).sort((a, b) => b.ts - a.ts);
      const site = base(req);
      const rsp = rs.map((r) => (S.enabled() && r.tipo === "reserva" && r.estado === "pendiente" && Number(r.precio) > 0 ? { ...r, pagoUrl: S.payUrl(site, r.code) } : r));
      return res.status(200).json({ user: U.pub(u), reservas: rsp, pre: rs.filter((r) => r.tipo === "prereserva" && r.campId).map((r) => r.campId) });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });
    if (!String(req.headers["content-type"] || "").includes("application/json")) return res.status(415).json({ error: "Formato no válido" });
    const b = req.body || {}, ip = ipOf(req);
    const bad = (m, s) => res.status(s || 400).json({ error: m });
    const pwOk = (p) => typeof p === "string" && p.length >= 8 && p.length <= 100;
    switch (b.action) {
      case "register": {
        if (!(await limit("rl:reg:" + ip, 10, 3600))) return bad("Demasiados intentos. Inténtalo más tarde.", 429);
        const email = U.norm(b.email), nombre = clip(b.nombre, 100);
        if (!nombre || !EMAIL.test(email)) return bad("Pon tu nombre y un email válido.");
        if (!U.CATS.includes(b.cat)) return bad("Elige tu categoría.");
        const prev = await db.get("users", email);
        if (prev && prev.verified) return bad("Ya existe una cuenta con ese correo. Entra o recupera tu contraseña.", 409);
        const rec = { id: email, nombre, sexo: clip(b.sexo, 30), tel: clip(b.tel, 40), ig: clip(b.ig, 60).replace(/^@/, ""), cat: b.cat, avisos: b.avisos !== false, verified: false, ts: Date.now() };
        await save(rec);
        const link = base(req) + "/cuenta?verificar=" + encodeURIComponent(A.makePayloadToken({ t: "verify", e: email, v: rec.ts }, 48 * 36e5));
        try { await mail.verificar({ nombre, email }, link); } catch (e) { console.error(e); return bad("No pudimos enviar el correo de confirmación. Inténtalo más tarde.", 502); }
        return res.status(200).json({ ok: true });
      }
      case "verify": {
        if (!(await limit("rl:ver:" + ip, 20, 3600))) return bad("Demasiados intentos.", 429);
        const t = A.readToken(String(b.token || ""));
        if (!t || t.t !== "verify") return bad("El enlace no es válido o ha caducado. Vuelve a crear la cuenta.");
        if (!pwOk(b.password)) return bad("La contraseña debe tener entre 8 y 100 caracteres.");
        const u = await db.get("users", t.e);
        if (!u || u.verified || u.ts !== t.v) return bad("El enlace no es válido o ya se ha usado.");
        Object.assign(u, await U.hashPw(b.password), { verified: true });
        await save(u); startSession(res, u);
        return res.status(200).json({ ok: true });
      }
      case "login": {
        const email = U.norm(b.email);
        if (!(await limit("rl:lgu:" + ip, 30, 900)) || !(await limit("rl:lge:" + email, 8, 900))) return bad("Demasiados intentos. Espera 15 minutos.", 429);
        const u = await db.get("users", email);
        const good = await U.checkPw(String(b.password || ""), u);
        if (u && !u.verified) return bad("Tu correo aún no está confirmado. Revisa tu bandeja de entrada o vuelve a crear la cuenta para recibir otro enlace.", 403);
        if (!good) return bad("Correo o contraseña incorrectos.", 401);
        startSession(res, u);
        return res.status(200).json({ ok: true });
      }
      case "logout": A.clearUserCookie(res); return res.status(200).json({ ok: true });
      case "forgot": {
        if (!(await limit("rl:fg:" + ip, 5, 3600))) return bad("Demasiados intentos. Inténtalo más tarde.", 429);
        const u = await db.get("users", U.norm(b.email));
        if (u && u.verified) {
          const link = base(req) + "/cuenta?reset=" + encodeURIComponent(A.makePayloadToken({ t: "reset", e: u.id, p: String(u.hash).slice(0, 10) }, 36e5));
          try { await mail.recuperar({ nombre: u.nombre, email: u.id }, link); } catch (e) { console.error(e); }
        }
        return res.status(200).json({ ok: true });
      }
      case "reset": {
        if (!(await limit("rl:rs:" + ip, 20, 3600))) return bad("Demasiados intentos.", 429);
        const t = A.readToken(String(b.token || ""));
        if (!t || t.t !== "reset") return bad("El enlace no es válido o ha caducado.");
        if (!pwOk(b.password)) return bad("La contraseña debe tener entre 8 y 100 caracteres.");
        const u = await db.get("users", t.e);
        if (!u || !u.verified || String(u.hash).slice(0, 10) !== t.p) return bad("El enlace no es válido o ya se ha usado.");
        Object.assign(u, await U.hashPw(b.password));
        await save(u); A.clearUserCookie(res);
        return res.status(200).json({ ok: true });
      }
    }
    const u = await sessionUser(req);
    if (!u) return bad("Inicia sesión para continuar.", 401);
    switch (b.action) {
      case "update": {
        if (!U.CATS.includes(b.cat)) return bad("Elige tu categoría.");
        const nombre = clip(b.nombre, 100);
        if (!nombre) return bad("Pon tu nombre.");
        Object.assign(u, { nombre, sexo: clip(b.sexo, 30), tel: clip(b.tel, 40), ig: clip(b.ig, 60).replace(/^@/, ""), cat: b.cat, avisos: !!b.avisos });
        await save(u);
        return res.status(200).json({ ok: true, user: U.pub(u) });
      }
      case "password": {
        if (!(await limit("rl:pw:" + u.id, 8, 900))) return bad("Demasiados intentos.", 429);
        if (!(await U.checkPw(String(b.actual || ""), u))) return bad("La contraseña actual no es correcta.", 401);
        if (!pwOk(b.nueva)) return bad("La contraseña nueva debe tener entre 8 y 100 caracteres.");
        Object.assign(u, await U.hashPw(b.nueva));
        await save(u); startSession(res, u);
        return res.status(200).json({ ok: true });
      }
      case "delete": {
        if (!(await limit("rl:dl:" + u.id, 5, 900))) return bad("Demasiados intentos.", 429);
        if (!(await U.checkPw(String(b.password || ""), u))) return bad("La contraseña no es correcta.", 401);
        await db.del("users", u.id); A.clearUserCookie(res);
        return res.status(200).json({ ok: true });
      }
      default: return bad("Acción no válida");
    }
  } catch (e) { console.error(e); return res.status(500).json({ error: "Error del servidor" }); }
};
