const { put } = require("@vercel/blob");
const { isAdmin } = require("../lib/auth");
async function handler(req, res) {
  if (req.method !== "PUT") return res.status(405).json({ error: "Método no permitido" });
  if (!isAdmin(req)) return res.status(401).json({ error: "No autorizado" });
  const type = String(req.headers["content-type"] || "").split(";")[0];
  if (!["image/jpeg", "image/png", "image/webp"].includes(type)) return res.status(415).json({ error: "Solo se admiten imágenes JPG, PNG o WebP." });
  if (Number(req.headers["content-length"] || 0) > 4.4e6) return res.status(413).json({ error: "La foto pesa más de 4,4 MB." });
  try {
    const name = String((req.query && req.query.name) || "foto.jpg").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
    const blob = await put("fotos/" + name, req, { access: "public", addRandomSuffix: true, contentType: type });
    res.status(200).json({ id: blob.url, url: blob.url });
  } catch (e) { console.error(e); res.status(500).json({ error: "No se pudo subir la foto." }); }
}
handler.config = { api: { bodyParser: false } };
module.exports = handler;
