const nodemailer = require("nodemailer");
let tr;
const T = () => tr || (tr = nodemailer.createTransport({
  host: "smtp.gmail.com", port: 465, secure: true,
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
}));
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
async function send(to, subject, lines) {
  const html = '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#0a0a0a">'
    + '<h2 style="font-style:italic;text-transform:uppercase;border-bottom:3px solid #0a0a0a;padding-bottom:8px">MG Visuals</h2>'
    + lines.map((l) => (l === "" ? "<br>" : '<p style="margin:6px 0">' + esc(l) + "</p>")).join("") + "</div>";
  await T().sendMail({ from: '"MG Visuals" <' + process.env.GMAIL_USER + ">", to, subject, text: lines.join("\n"), html });
}
const firma = (aj) => ["", "MG Visuals" + (aj.email ? " · " + aj.email : "") + (aj.ig ? " · @" + aj.ig : "")];
const pagoLines = (aj) => (aj.pago ? ["", "Cómo pagar:"].concat(String(aj.pago).split("\n")) : []);
const resumen = (r) => ["Código: " + r.code, "Campeonato: " + r.camp + (r.fecha ? " (" + r.fecha + ")" : ""), "Pack: " + r.pack]
  .concat(r.pruebas && r.pruebas.length ? ["Pruebas: " + r.pruebas.join(", ")] : []);
const fmt = (ms) => new Date(ms).toLocaleString("es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

exports.recibida = (r, aj) => send(r.email, "Hemos recibido tu reserva " + r.code,
  ["Hola " + r.nombre + ",", "", "Hemos recibido el formulario de tu reserva.", ""].concat(resumen(r),
  ["", "Estado: pendiente de pago."], pagoLines(aj), ["", "Cuando confirmemos tu pago te enviaremos otro correo."], firma(aj)));
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
