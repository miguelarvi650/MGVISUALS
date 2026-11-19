const db = require("../lib/db");
module.exports = async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ error: "Método no permitido" });
  try {
    const [campeonatos, fotos, aj] = await Promise.all([db.all("camps"), db.all("fotos"), db.getKey("ajustes")]);
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ campeonatos, fotos, ajustes: aj || {} });
  } catch (e) { console.error(e); res.status(500).json({ error: "Error del servidor" }); }
};
