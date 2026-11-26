const db = require("../lib/db");
const S = require("../lib/stripe");
const base = (req) => process.env.SITE_URL || "https://" + req.headers.host;
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "Método no permitido" });
  const home = base(req);
  try {
    if (!S.enabled()) return res.status(503).json({ error: "El pago con tarjeta no está activado." });
    const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "0";
    const rk = "rl:pay:" + ip, n = await db.redis.incr(rk);
    if (n === 1) await db.redis.expire(rk, 3600);
    if (n > 40) return res.status(429).json({ error: "Demasiados intentos. Inténtalo más tarde." });
    const code = String((req.query && req.query.code) || "").slice(0, 40), k = String((req.query && req.query.k) || "");
    if (!S.checkPayToken(code, k)) return res.status(403).json({ error: "Enlace de pago no válido." });
    const r = await db.get("reservas", code);
    if (!r || r.tipo === "prereserva") return res.status(404).json({ error: "Reserva no encontrada." });
    if (r.estado === "pagada") { res.statusCode = 303; res.setHeader("Location", home + "/?pago=ok"); return res.end(); }
    if (!(Number(r.precio) > 0)) return res.status(400).json({ error: "Esta reserva no tiene importe a pagar." });
    const s = await S.createSession(r, home);
    r.stripeSession = s.id;
    await db.put("reservas", code, r);
    res.statusCode = 303; res.setHeader("Location", s.url); res.end();
  } catch (e) {
    console.error("pagar", e);
    res.statusCode = 303; res.setHeader("Location", home + "/?pago=error"); res.end();
  }
};
