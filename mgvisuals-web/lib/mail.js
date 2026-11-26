const nodemailer = require("nodemailer");
let tr;
const T = () => tr || (tr = nodemailer.createTransport({
  host: "smtp.gmail.com", port: 465, secure: true,
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
}));
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
async function send(to, subject, lines, bcc) {
  const html = '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#0a0a0a">'
    + '<h2 style="font-style:italic;text-transform:uppercase;border-bottom:3px solid #0a0a0a;padding-bottom:8px">MG Visuals</h2>'
    + lines.map((l) => (l === "" ? "<br>" : /^https?:\/\//.test(l) ? '<p style="margin:6px 0"><a href="' + esc(l) + '">' + esc(l) + "</a></p>" : '<p style="margin:6px 0">' + esc(l) + "</p>")).join("") + "</div>";
  await T().sendMail({ from: '"MG Visuals" <' + process.env.GMAIL_USER + ">", to, bcc, subject, text: lines.join("\n"), html });
}
const firma = (aj) => ["", "MG Visuals" + (aj.email ? " · " + aj.email : "") + (aj.ig ? " · @" + aj.ig : "")];
const pagoLines = (aj) => (aj.pago ? ["", "Cómo pagar:"].concat(String(aj.pago).split("\n")) : []);
const resumen = (r) => ["Código: " + r.code, "Campeonato: " + r.camp + (r.fecha ? " (" + r.fecha + ")" : ""), "Pack: " + r.pack]
  .concat(r.pruebas && r.pruebas.length ? ["Pruebas: " + r.pruebas.join(", ")] : []);
const fmt = (ms) => new Date(ms).toLocaleString("es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

exports.recibida = (r, aj, payUrl) => send(r.email, "Hemos recibido tu reserva " + r.code,
  ["Hola " + r.nombre + ",", "", "Hemos recibido el formulario de tu reserva.", ""].concat(resumen(r),
  ["", "Estado: pendiente de pago."], payUrl ? ["", "Paga ahora con tarjeta:", payUrl] : [], pagoLines(aj), ["", "Cuando confirmemos tu pago te enviaremos otro correo."], firma(aj)));
exports.prereserva = (r, aj) => send(r.email, "Prereserva recibida " + r.code,
  ["Hola " + r.nombre + ",", "", "Hemos registrado tu prereserva (sin pago).", ""].concat(resumen(r),
  r.abre ? ["", "Podrás reservar desde el " + fmt(r.abre - 36e5) + " (1 hora antes de la apertura general, el " + fmt(r.abre) + ")."]
         : ["", "Te avisaremos cuando abran las reservas."], firma(aj)));
exports.confirmada = (r, aj) => send(r.email, "Reserva confirmada " + r.code,
  ["Hola " + r.nombre + ",", "", "Hemos recibido tu pago y tu reserva queda confirmada.", ""].concat(resumen(r),
  ["", "Cuando las fotos estén disponibles podrás verlas y descargarlas en la web."], firma(aj)));
exports.aviso = (r) => send(process.env.ADMIN_NOTIFY || process.env.GMAIL_USER,
  (r.tipo === "prereserva" ? "Nueva prereserva " : "Nueva reserva ") + r.code + " - " + r.camp,
  resumen(r).concat(["Nombre: " + r.nombre, "Sexo: " + r.sexo, "Email: " + r.email, "Teléfono: " + (r.tel || "-"), "Instagram: " + (r.ig || "-")]));

exports.verificar = (u, link) => send(u.email, "Confirma tu cuenta de MG Visuals",
  ["Hola " + u.nombre + ",", "", "Para activar tu cuenta y elegir tu contraseña, abre este enlace (válido 48 horas):", link, "", "Si no has sido tú, ignora este correo.", "", "MG Visuals"]);
exports.recuperar = (u, link) => send(u.email, "Restablecer tu contraseña de MG Visuals",
  ["Hola " + u.nombre + ",", "", "Para elegir una contraseña nueva, abre este enlace (válido 1 hora):", link, "", "Si no lo has pedido tú, ignora este correo.", "", "MG Visuals"]);
exports.nuevoCampeonato = (bcc, c, base) => send(process.env.GMAIL_USER, "Nuevo campeonato: " + c.n,
  ["Hola,", "", "Hay un nuevo campeonato para tu categoría (" + (c.cats || []).join(", ") + "):", "", c.n + (c.d ? " · " + c.d : ""), ""].concat(
    c.s === "soon"
      ? [c.abre ? "Las reservas se abren el " + fmt(c.abre) + "." : "Pronto abriremos las reservas.",
         "Ya puedes hacer la prereserva (sin pago)" + (c.abre ? " y entrarás 1 hora antes, desde las " + fmt(c.abre - 36e5) + "." : ".")]
      : ["Las reservas ya están abiertas."],
    ["", "Entra aquí:", base + "/#campeonatos", "", "Recibes este aviso porque activaste los avisos de tu categoría. Puedes desactivarlos en tu cuenta:", base + "/cuenta", "", "MG Visuals"]), bcc);
exports.fotos = (r, aj) => send(r.email, "Tus fotos de " + r.camp + " ya están listas",
  ["Hola " + r.nombre + ",", "", "Ya puedes ver y descargar las fotos de tu reserva:", ""].concat(resumen(r),
  ["", "Abre tus fotos aquí:", r.enlace, "", "También las encontrarás entrando en tu cuenta de la web."], firma(aj)));
