# MG Visuals · Web de reservas de fotos

Web con reservas, prereservas con acceso anticipado, panel del creador, galería con descargas
y **correos automáticos por Gmail**:

1. El cliente rellena el formulario → recibe un correo "Hemos recibido tu reserva" (con las instrucciones de pago) y a ti te llega un aviso.
2. Tú marcas la reserva como **pagada** en el panel → el cliente recibe "Reserva confirmada".

## Qué necesitas (todo gratis para empezar)
- Una cuenta de **GitHub** (para subir el proyecto) o el programa `vercel` en tu ordenador.
- Una cuenta de **Vercel** (vercel.com).
- Una cuenta de **Gmail** con la verificación en 2 pasos activada.

## Paso 1 · Contraseña de aplicación de Gmail
1. Entra en tu cuenta de Google → **Seguridad** → activa la **Verificación en 2 pasos**.
2. Busca **Contraseñas de aplicaciones** (en el buscador de la cuenta de Google) y crea una con el nombre "MG Visuals".
3. Google te da una clave de 16 letras. Guárdala: es `GMAIL_APP_PASSWORD`.

## Paso 2 · Subir el proyecto a Vercel
Opción A (la más fácil): sube esta carpeta a un repositorio nuevo de GitHub → en Vercel pulsa **Add New → Project** → importa ese repositorio → **Deploy**. La primera vez no funcionará del todo: faltan los pasos 3 y 4.

Opción B: en una terminal, dentro de esta carpeta: `npm i -g vercel` y luego `vercel`.

## Paso 3 · Conectar el almacenamiento
En el panel de Vercel, dentro de tu proyecto → pestaña **Storage**:
1. **Create → Blob** (guarda las fotos). Conéctalo al proyecto.
2. **Marketplace → Upstash Redis** (plan Free; guarda campeonatos y reservas). Conéctalo al proyecto.

Vercel añade solo las variables de conexión.

## Paso 4 · Variables de entorno
Proyecto → **Settings → Environment Variables** (mira `.env.example`):

| Variable | Valor |
|---|---|
| `ADMIN_USER` | el usuario con el que entrarás al panel |
| `ADMIN_PASSWORD` | una contraseña larga y segura |
| `SESSION_SECRET` | texto aleatorio de 32 caracteres o más |
| `GMAIL_USER` | tu dirección de Gmail |
| `GMAIL_APP_PASSWORD` | la clave de 16 letras del paso 1 |
| `ADMIN_NOTIFY` | (opcional) correo donde recibir los avisos de reservas; si no, el mismo Gmail |

Después: **Deployments → ⋯ → Redeploy**.

## Paso 5 · Primer uso
1. Abre tu web → pie de página → **Acceso creador** → entra con tu usuario y contraseña.
2. En **Ajustes** pon tu email, tu Instagram y las **instrucciones de pago** (Bizum, transferencia…). Salen en el correo al cliente.
3. Crea un campeonato: nombre, fecha, estado, pruebas (botones rápidos 100 m, 400 m…), fases y precios.
4. Haz una reserva de prueba con tu propio correo y comprueba que llegan los dos correos.

## Cómo funciona cada cosa
- **Plazas:** cada reserva descuenta una plaza de la fase actual. Cuando se agotan las plazas de todos los tipos de esa fase, pasa sola a la siguiente (el precio sube). Si solo se agota un tipo (individuales o combinadas), esa opción da "plazas agotadas" hasta que subas la fase a mano.
- **Abren pronto:** pones la fecha y hora de apertura. Hay cuenta atrás y prereserva (sin pago). Quien prereserva puede reservar **1 hora antes**; el servidor lo comprueba por su email.
- **Reservas:** en el panel, filtra por campeonato, prueba o estado. **Marcar pagada** envía el correo de confirmación. Se puede exportar a CSV.
- **Fotos:** se suben por campeonato. Si pesan mucho, se reducen a 3200 px de lado largo (límite de 4,4 MB por foto en Vercel). Los clientes las descargan desde la galería.
- **Cuenta del cliente:** guarda sus datos y su historial **solo en su navegador** (sin contraseña). Reservar no exige cuenta.

## Importante
- **Plan de Vercel:** el plan gratuito (Hobby) es solo para uso personal y no comercial. Si vas a cobrar por las fotos, revisa las condiciones de Vercel; probablemente necesites el plan Pro.
- **Gmail:** permite unos 500 correos al día desde una cuenta normal, de sobra para empezar.
- **Cobro:** el pago sigue siendo manual (Bizum, transferencia…). Conectar Stripe es un paso aparte.
- **Textos legales:** los enlaces de Términos y Privacidad no llevan a ninguna página. Guardas datos personales de clientes, así que necesitas tus propios textos legales.
- **Seguridad:** cambia la contraseña si sospechas que alguien la conoce. Tras 8 intentos fallidos el acceso se bloquea 15 minutos.

## Estructura
```
public/index.html   La web (diseño y lógica)
public/shim.js      Conecta la web con la API
api/reservar.js     Crea reservas y prereservas, descuenta plazas, envía correos
api/admin.js        Acciones del creador (campeonatos, reservas, pagos, fotos, ajustes)
api/login.js        Entrada y salida del creador
api/public.js       Datos públicos (campeonatos, galería, ajustes)
api/foto.js         Subida de fotos
api/descarga.js     Descarga de fotos
lib/                Base de datos, sesión y correos
```
