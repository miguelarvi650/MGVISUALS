const OK = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i;
module.exports = async (req, res) => {
  const u = String((req.query && req.query.u) || "");
  if (!OK.test(u)) return res.status(400).json({ error: "Archivo no válido" });
  try {
    const r = await fetch(u);
    if (!r.ok) return res.status(404).json({ error: "No encontrada" });
    const type = r.headers.get("content-type") || "application/octet-stream";
    let name = String((req.query && req.query.n) || "foto.jpg").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
    if (/jpeg/.test(type) && !/\.jpe?g$/i.test(name)) name = name.replace(/\.[a-z0-9]+$/i, "") + ".jpg";
    res.setHeader("Content-Type", type);
    res.setHeader("Content-Disposition", 'attachment; filename="' + name + '"');
    res.status(200).send(Buffer.from(await r.arrayBuffer()));
  } catch (e) { console.error(e); res.status(500).json({ error: "No se pudo descargar" }); }
};
