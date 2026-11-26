const crypto = require("crypto");
// Stripe se activa solo si están las dos claves; si no, la web sigue con el pago manual.
const enabled = () => !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_WEBHOOK_SECRET;
const payToken = (code) => crypto.createHmac("sha256", process.env.SESSION_SECRET || "").update("pay:" + code).digest("hex").slice(0, 32);
const payUrl = (base, code) => base + "/api/pagar?code=" + encodeURIComponent(code) + "&k=" + payToken(code);
function checkPayToken(code, k) {
  const a = Buffer.from(String(k || "")), b = Buffer.from(payToken(code));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
async function createSession(r, base) {
  const p = new URLSearchParams();
  p.set("mode", "payment");
  p.set("locale", "es");
  p.set("success_url", base + "/?pago=ok");
  p.set("cancel_url", base + "/?pago=cancelado");
  p.set("customer_email", r.email);
  p.set("client_reference_id", r.code);
  p.set("metadata[code]", r.code);
  p.set("payment_intent_data[metadata][code]", r.code);
  p.set("payment_intent_data[description]", ("Reserva " + r.code + " - " + r.camp).slice(0, 300));
  p.set("line_items[0][quantity]", "1");
  p.set("line_items[0][price_data][currency]", "eur");
  p.set("line_items[0][price_data][unit_amount]", String(Math.round(Number(r.precio) * 100)));
  p.set("line_items[0][price_data][product_data][name]", ("Fotos · " + r.camp + " · " + r.pack).slice(0, 240));
  const resp = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: "Bearer " + process.env.STRIPE_SECRET_KEY, "Content-Type": "application/x-www-form-urlencoded" },
    body: p.toString(),
  });
  const d = await resp.json();
  if (!resp.ok) throw new Error((d.error && d.error.message) || "Error de Stripe");
  return d;
}
// Comprobación de la firma del webhook (esquema documentado por Stripe: t=...,v1=...)
function verify(rawBody, header, secret, toleranceSec) {
  if (!header || !secret) return false;
  const parts = String(header).split(",").map((x) => x.trim().split("="));
  const t = (parts.find((x) => x[0] === "t") || [])[1];
  const sigs = parts.filter((x) => x[0] === "v1").map((x) => x[1]);
  if (!t || !sigs.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > (toleranceSec || 300)) return false;
  const expected = crypto.createHmac("sha256", secret).update(t + "." + rawBody.toString("utf8")).digest("hex");
  return sigs.some((s) => s.length === expected.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
}
module.exports = { enabled, payToken, payUrl, checkPayToken, createSession, verify };
