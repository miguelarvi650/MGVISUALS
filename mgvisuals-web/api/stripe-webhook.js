const db = require("../lib/db");
const mail = require("../lib/mail");
const S = require("../lib/stripe");
async function raw(req) { const c = []; for await (const x of req) c.push(x); return Buffer.concat(c); }
async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return res.status(503).json({ error: "Webhook no configurado" });
  const body = await raw(req);
  if (!S.verify(body, req.headers["stripe-signature"], secret)) return res.status(400).json({ error: "Firma no válida" });
  let ev;
  try { ev = JSON.parse(body.toString("utf8")); } catch (e) { return res.status(400).json({ error: "JSON no válido" }); }
  try {
    if (["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(ev.type)) {
      const s = (ev.data && ev.data.object) || {};
      const code = (s.metadata && s.metadata.code) || s.client_reference_id;
      if (s.payment_status === "paid" && code) {
        const lock = "lock:pay:" + code;
        if (await db.redis.set(lock, "1", { nx: true, ex: 30 })) {
          try {
            const r = await db.get("reservas", code);
            if (r && r.estado !== "pagada") {
              if (String(s.currency).toLowerCase() === "eur" && s.amount_total === Math.round(Number(r.precio) * 100)) {
                r.estado = "pagada"; r.pagadaTs = Date.now(); r.pagadoPor = "stripe"; r.stripeSession = s.id;
                await db.put("reservas", code, r);
                try { await mail.confirmada(r, (await db.getKey("ajustes")) || {}); } catch (e) { console.error("email confirmada", e); }
              } else {
                console.error("Importe de Stripe no coincide", code, s.amount_total, s.currency, r.precio);
                r.stripeAviso = "El importe pagado en Stripe no coincide con el de la reserva (" + s.amount_total + " " + s.currency + ")";
                await db.put("reservas", code, r);
              }
            }
          } finally { await db.redis.del(lock); }
        }
      }
    }
    res.status(200).json({ received: true });
  } catch (e) { console.error("webhook", e); res.status(500).json({ error: "Error del servidor" }); }
}
handler.config = { api: { bodyParser: false } };
module.exports = handler;
