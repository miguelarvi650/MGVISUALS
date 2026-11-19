const crypto = require("crypto");
const secret = () => process.env.SESSION_SECRET || "";
const sign = (p) => crypto.createHmac("sha256", secret()).update(p).digest("base64url");
function makeToken(user) {
  const p = Buffer.from(JSON.stringify({ u: user, exp: Date.now() + 7 * 864e5 })).toString("base64url");
  return p + "." + sign(p);
}
function readToken(t) {
  if (!t || !secret()) return null;
  const [p, s] = String(t).split(".");
  if (!p || !s) return null;
  const a = Buffer.from(s), b = Buffer.from(sign(p));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { const o = JSON.parse(Buffer.from(p, "base64url").toString()); return o.exp > Date.now() ? o : null; }
  catch (e) { return null; }
}
function cookies(req) {
  const o = {};
  (req.headers.cookie || "").split(";").forEach((c) => {
    const i = c.indexOf("=");
    if (i > 0) o[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim());
  });
  return o;
}
const isAdmin = (req) => !!readToken(cookies(req).mgv_session);
const FLAGS = "; HttpOnly; Secure; SameSite=Strict; Path=/";
const setCookie = (res, t) => res.setHeader("Set-Cookie", "mgv_session=" + encodeURIComponent(t) + FLAGS + "; Max-Age=604800");
const clearCookie = (res) => res.setHeader("Set-Cookie", "mgv_session=" + FLAGS + "; Max-Age=0");
const h = (x) => crypto.createHash("sha256").update(String(x)).digest();
const safeEq = (a, b) => crypto.timingSafeEqual(h(a), h(b));
module.exports = { makeToken, isAdmin, setCookie, clearCookie, safeEq };
