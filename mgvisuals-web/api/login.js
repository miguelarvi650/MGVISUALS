const db = require("../lib/db");
const { makeToken, isAdmin, setCookie, clearCookie, safeEq } = require("../lib/auth");
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET") return res.status(200).json({ admin: isAdmin(req) });
  if (req.method === "DELETE") { clearCookie(res); return res.status(200).json({ ok: true }); }
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });
  const { ADMIN_USER, ADMIN_PASSWORD, SESSION_SECRET } = process.env;
  if (!ADMIN_USER || !ADMIN_PASSWORD || !SESSION_SECRET) return res.status(500).json({ error: "Faltan las variables de entorno del administrador." });
  try {
    const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "0";
    const k = "rl:login:" + ip;
    const n = await db.redis.incr(k);
    if (n === 1) await db.redis.expire(k, 900);
    if (n > 8) return res.status(429).json({ error: "Demasiados intentos. Espera 15 minutos." });
    const b = req.body || {};
    const okU = safeEq(b.user || "", ADMIN_USER), okP = safeEq(b.pass || "", ADMIN_PASSWORD);
    if (!(okU && okP)) { await new Promise((r) => setTimeout(r, 500)); return res.status(401).json({ error: "Usuario o contraseña incorrectos." }); }
    setCookie(res, makeToken(ADMIN_USER));
    res.status(200).json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: "Error del servidor" }); }
};
