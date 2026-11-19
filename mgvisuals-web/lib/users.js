const crypto = require("crypto");
const scrypt = (pw, salt) => new Promise((ok, ko) => crypto.scrypt(pw, salt, 64, (e, k) => (e ? ko(e) : ok(k))));
async function hashPw(pw) {
  const salt = crypto.randomBytes(16), k = await scrypt(pw, salt);
  return { salt: salt.toString("hex"), hash: k.toString("hex") };
}
async function checkPw(pw, u) {
  if (!u || !u.salt || !u.hash) { await hashPw("x"); return false; }
  const k = await scrypt(pw, Buffer.from(u.salt, "hex")), a = Buffer.from(u.hash, "hex");
  return a.length === k.length && crypto.timingSafeEqual(a, k);
}
const norm = (e) => String(e || "").trim().toLowerCase();
const CATS = ["SUB 16", "SUB 20", "SUB 23", "Absoluta"];
const pub = (u) => ({ email: u.id, nombre: u.nombre, sexo: u.sexo, tel: u.tel, ig: u.ig, cat: u.cat, avisos: !!u.avisos });
module.exports = { hashPw, checkPw, norm, CATS, pub };
