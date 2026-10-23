import { transporter, mailConfigurado, MAIL_FROM } from "../config/mail.js";

const FRONTEND = process.env.FRONTEND_URL || "http://localhost:5173";

// evita que un nombre de usuario/producto rompa (o inyecte) el HTML del mail
function escapar(texto = "") {
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const mailService = {
  // manda al usuario la imagen del probador virtual. La imagen va embebida en el
  // cuerpo (cid) y también como adjunto, así la puede guardar desde el mail.
  // Devuelve true si se envió; nunca lanza: el mail es un extra y no debe hacer
  // fallar la generación.
  async enviarPruebaVirtual({ email, nombre, producto, imagen, mimetype }) {
    if (!mailConfigurado) {
      console.warn("Mail del probador no enviado: falta configurar SMTP_* en el .env");
      return false;
    }
    if (!email) return false;

    const ext = mimetype?.split("/").pop() || "png";
    const nombreProducto = escapar(producto?.nombre ?? "la prenda");
    const saludo = nombre ? `¡Hola ${escapar(nombre.split(" ")[0])}!` : "¡Hola!";

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
        <h1 style="font-size:22px;margin:0 0 12px">${saludo}</h1>
        <p style="font-size:15px;line-height:1.5;margin:0 0 16px">
          Así te queda <b>${nombreProducto}</b> según nuestro probador virtual.
          ¡Te queda genial! 🔥
        </p>
        <img src="cid:prueba-virtual" alt="${nombreProducto} puesto"
             style="width:100%;max-width:560px;border-radius:12px;display:block" />
        <p style="font-size:15px;line-height:1.5;margin:16px 0">
          Si te gustó, ya podés comprarla en Pilchix. Además, todas tus pruebas
          quedan guardadas en tu perfil, en la sección <b>Probador</b>.
        </p>
        <p style="margin:24px 0">
          <a href="${FRONTEND}/perfil"
             style="background:#1a1a1a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:14px">
            Ver mis pruebas
          </a>
        </p>
        <p style="font-size:12px;color:#888;margin-top:32px">
          Recibiste este mail porque usaste el probador virtual de Pilchix.
        </p>
      </div>`;

    try {
      await transporter.sendMail({
        from: MAIL_FROM,
        to: email,
        subject: `Así te queda ${producto?.nombre ?? "tu prenda"} 👀`,
        text: `${saludo} Así te queda ${producto?.nombre ?? "la prenda"} según nuestro probador virtual. Te adjuntamos la foto. Todas tus pruebas quedan guardadas en tu perfil: ${FRONTEND}/perfil`,
        html,
        attachments: [
          { filename: `pilchix-prueba.${ext}`, content: imagen, contentType: mimetype, cid: "prueba-virtual" },
        ],
      });
      return true;
    } catch (err) {
      console.error("No se pudo enviar el mail del probador:", err.message);
      return false;
    }
  },
};
