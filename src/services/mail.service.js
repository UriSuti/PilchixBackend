import { transporter, mailConfigurado, MAIL_FROM } from "../config/mail.js";

const FRONTEND = process.env.FRONTEND_URL || "http://pilchix.vercel.app";

// Escapa textos dinámicos para evitar que rompan o inyecten HTML.
function escapar(texto = "") {
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const mailService = {
  async enviarPruebaVirtual({ email, nombre, producto, imagen, mimetype }) {
    if (!mailConfigurado) {
      console.warn(
        "Mail del probador no enviado: falta configurar SMTP_* en el .env"
      );
      return false;
    }

    if (!email) return false;

    const ext = mimetype?.split("/").pop() || "png";
    const nombrePlano = producto?.nombre ?? "tu prenda";
    const nombreProducto = escapar(nombrePlano);
    const saludo = nombre
      ? `¡Hola ${escapar(nombre.split(" ")[0])}!`
      : "¡Hola!";

    const perfilUrl = `${FRONTEND.replace(/\/$/, "")}/perfil`;
    const perfilUrlHtml = escapar(perfilUrl);

    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="color-scheme" content="light">
        <title>Tu prueba virtual | Pilchix</title>

        <style>
          body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            background-color: #eef1f6;
            font-family: Arial, Helvetica, sans-serif;
          }

          table {
            border-collapse: collapse;
          }

          img {
            border: 0;
            outline: none;
            text-decoration: none;
          }

          @media screen and (max-width: 600px) {
            .email-container {
              width: 100% !important;
            }

            .stack-column {
              display: block !important;
              width: 100% !important;
              max-width: 100% !important;
              box-sizing: border-box !important;
            }

            .mobile-padding {
              padding: 24px 20px !important;
            }

            .hero-title {
              font-size: 32px !important;
              line-height: 1.12 !important;
            }

            .product-image {
              max-width: 320px !important;
            }

            .feature-column {
              display: inline-block !important;
              width: 48% !important;
              vertical-align: top !important;
            }
          }
        </style>
      </head>

      <body style="margin:0;padding:0;background-color:#eef1f6;">

        <!-- Previsualización del mail -->
        <div style="
          display:none;
          font-size:1px;
          color:#eef1f6;
          line-height:1px;
          max-height:0;
          max-width:0;
          opacity:0;
          overflow:hidden;
          mso-hide:all;
        ">
          ${saludo} Tu prueba virtual de ${nombreProducto} ya está lista.
          Descubrí cómo te queda con Pilchix.
        </div>

        <table
          role="presentation"
          width="100%"
          cellpadding="0"
          cellspacing="0"
          border="0"
          bgcolor="#eef1f6"
          style="width:100%;background-color:#eef1f6;"
        >
          <tr>
            <td align="center" style="padding:24px 10px;">

              <table
                role="presentation"
                class="email-container"
                width="700"
                cellpadding="0"
                cellspacing="0"
                border="0"
                style="
                  width:100%;
                  max-width:700px;
                  background-color:#ffffff;
                  border-radius:10px;
                  overflow:hidden;
                "
              >

                <!-- ENCABEZADO: PILCHIX + EXPO INFO -->
                <tr>
                  <td
                    bgcolor="#08152d"
                    style="
                      padding:22px 26px;
                      background-color:#08152d;
                      border-bottom:1px solid #344565;
                    "
                  >
                    <table
                      role="presentation"
                      width="100%"
                      cellpadding="0"
                      cellspacing="0"
                      border="0"
                    >
                      <tr>
                        <td valign="middle" style="padding-bottom:15px;">
                          <span style="
                            font-family:Arial,Helvetica,sans-serif;
                            font-weight:800;
                            font-size:31px;
                            letter-spacing:-1.2px;
                            color:#ffffff;
                          ">
                            Pilchix
                          </span>
                        </td>

                        <td align="right" valign="middle" style="padding-bottom:15px;">
                          <span style="
                            display:inline-block;
                            background-color:#a8c3ff;
                            color:#08152d;
                            padding:10px 16px;
                            border-radius:24px;
                            font-size:15px;
                            line-height:18px;
                            font-weight:800;
                            letter-spacing:1px;
                            white-space:nowrap;
                          ">
                            ✦ EXPO INFO
                          </span>
                        </td>
                      </tr>

                      <tr>
                        <td
                          colspan="2"
                          style="
                            border-top:1px solid #344565;
                            padding-top:15px;
                          "
                        >
                          <table
                            role="presentation"
                            width="100%"
                            cellpadding="0"
                            cellspacing="0"
                            border="0"
                          >
                            <tr>
                              <td
                                valign="middle"
                                style="
                                  color:#c8d4ec;
                                  font-size:12px;
                                  line-height:18px;
                                  letter-spacing:.5px;
                                "
                              >
                                &nbsp;·&nbsp; Auditorio de rio
                              </td>

                              <td
                                align="right"
                                valign="middle"
                                style="
                                  color:#ffffff;
                                  font-size:12px;
                                  font-weight:700;
                                  letter-spacing:1px;
                                  white-space:nowrap;
                                "
                              >
                                ¡TE ESPERAMOS! &nbsp; →
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- HERO: PROBADOR VIRTUAL -->
                <tr>
                  <td
                    bgcolor="#0a1730"
                    class="mobile-padding"
                    style="
                      padding:34px 26px 28px;
                      background-color:#0a1730;
                    "
                  >
                    <table
                      role="presentation"
                      width="100%"
                      cellpadding="0"
                      cellspacing="0"
                      border="0"
                    >
                      <tr>

                        <!-- TEXTO -->
                        <td
                          class="stack-column"
                          width="54%"
                          valign="middle"
                          style="width:54%;padding-right:15px;"
                        >
                          <p style="
                            margin:0 0 20px;
                            color:#b7ceff;
                            font-size:12px;
                            line-height:18px;
                            font-weight:700;
                            letter-spacing:2px;
                            text-transform:uppercase;
                          ">
                            ✦ &nbsp; PROBADOR VIRTUAL
                          </p>

                          <h1
                            class="hero-title"
                            style="
                              margin:0 0 20px;
                              color:#ffffff;
                              font-size:38px;
                              line-height:1.12;
                              font-weight:800;
                              letter-spacing:-1.1px;
                            "
                          >
                            Así te queda
                            <span style="color:#a8c3ff;">
                              ${nombreProducto}
                            </span>
                            👀
                          </h1>

                          <p style="
                            margin:0 0 24px;
                            color:#d7dfef;
                            font-size:15px;
                            line-height:1.8;
                          ">
                            ${saludo}<br><br>
                            Tu prueba virtual ya está lista.
                            Mirá cómo se ve esta prenda en vos y
                            descubrí tu próximo look antes de comprar.
                          </p>

                          <!-- BOTÓN PRINCIPAL -->
                          <table
                            role="presentation"
                            cellpadding="0"
                            cellspacing="0"
                            border="0"
                          >
                            <tr>
                              <td
                                bgcolor="#a8c3ff"
                                style="
                                  background-color:#a8c3ff;
                                  border-radius:6px;
                                "
                              >
                                <a
                                  href="${perfilUrlHtml}"
                                  target="_blank"
                                  style="
                                    display:inline-block;
                                    padding:15px 23px;
                                    color:#08152d;
                                    font-size:14px;
                                    line-height:18px;
                                    font-weight:800;
                                    text-decoration:none;
                                    border-radius:6px;
                                  "
                                >
                                  Ver mi prueba &nbsp; →
                                </a>
                              </td>
                            </tr>
                          </table>

                          <p style="
                            margin:24px 0 0;
                            color:#b7ceff;
                            font-size:12px;
                            line-height:1.6;
                          ">
                            ✦ &nbsp; EXPO INFO<br>
                            <span style="color:#ffffff;font-weight:700;">
                              Conocé Pilchix y descubrí más prendas.
                            </span>
                          </p>
                        </td>

                        <!-- IMAGEN DE LA PRUEBA -->
                        <td
                          class="stack-column"
                          width="46%"
                          valign="middle"
                          align="center"
                          style="width:46%;padding-top:12px;"
                        >
                          <table
                            role="presentation"
                            width="100%"
                            cellpadding="0"
                            cellspacing="0"
                            border="0"
                            bgcolor="#f0f1f3"
                            style="
                              width:100%;
                              background-color:#f0f1f3;
                              border-radius:10px;
                            "
                          >
                            <tr>
                              <td
                                align="center"
                                valign="middle"
                                style="padding:8px;"
                              >
                                <img
                                  class="product-image"
                                  src="cid:prueba-virtual"
                                  alt="Así te queda ${nombreProducto}"
                                  width="285"
                                  style="
                                    display:block;
                                    width:100%;
                                    max-width:285px;
                                    height:auto;
                                    margin:0 auto;
                                    border-radius:6px;
                                  "
                                >
                              </td>
                            </tr>
                          </table>

                          <p style="
                            margin:12px 0 0;
                            color:#b7c5df;
                            font-size:11px;
                            line-height:17px;
                            text-align:center;
                          ">
                            Tu look. Tu estilo. Tu próxima elección.
                          </p>
                        </td>

                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- BENEFICIOS -->
                <tr>
                  <td
                    bgcolor="#ffffff"
                    style="padding:30px 14px 32px;background-color:#ffffff;"
                  >
                    <table
                      role="presentation"
                      width="100%"
                      cellpadding="0"
                      cellspacing="0"
                      border="0"
                    >
                      <tr>

                        <td
                          class="feature-column"
                          width="25%"
                          valign="top"
                          align="center"
                          style="width:25%;padding:8px 6px;"
                        >
                          <div style="
                            color:#0a1730;
                            font-size:30px;
                            line-height:40px;
                          ">✧</div>

                          <p style="
                            margin:10px 0;
                            color:#0a1730;
                            font-size:13px;
                            line-height:18px;
                            font-weight:700;
                          ">
                            Probá desde donde estés
                          </p>

                          <p style="
                            margin:0;
                            color:#586782;
                            font-size:12px;
                            line-height:19px;
                          ">
                            Explorá prendas desde cualquier dispositivo.
                          </p>
                        </td>

                        <td
                          class="feature-column"
                          width="25%"
                          valign="top"
                          align="center"
                          style="width:25%;padding:8px 6px;"
                        >
                          <div style="
                            color:#0a1730;
                            font-size:30px;
                            line-height:40px;
                          ">♧</div>

                          <p style="
                            margin:10px 0;
                            color:#0a1730;
                            font-size:13px;
                            line-height:18px;
                            font-weight:700;
                          ">
                            Más confianza
                          </p>

                          <p style="
                            margin:0;
                            color:#586782;
                            font-size:12px;
                            line-height:19px;
                          ">
                            Visualizá tu look antes de elegir.
                          </p>
                        </td>

                        <td
                          class="feature-column"
                          width="25%"
                          valign="top"
                          align="center"
                          style="width:25%;padding:8px 6px;"
                        >
                          <div style="
                            color:#0a1730;
                            font-size:30px;
                            line-height:40px;
                          ">◷</div>

                          <p style="
                            margin:10px 0;
                            color:#0a1730;
                            font-size:13px;
                            line-height:18px;
                            font-weight:700;
                          ">
                            Ahorrá tiempo
                          </p>

                          <p style="
                            margin:0;
                            color:#586782;
                            font-size:12px;
                            line-height:19px;
                          ">
                            Explorá y compará antes de comprar.
                          </p>
                        </td>

                        <td
                          class="feature-column"
                          width="25%"
                          valign="top"
                          align="center"
                          style="width:25%;padding:8px 6px;"
                        >
                          <div style="
                            color:#0a1730;
                            font-size:30px;
                            line-height:40px;
                          ">☺</div>

                          <p style="
                            margin:10px 0;
                            color:#0a1730;
                            font-size:13px;
                            line-height:18px;
                            font-weight:700;
                          ">
                            Tu estilo, sin límites
                          </p>

                          <p style="
                            margin:0;
                            color:#586782;
                            font-size:12px;
                            line-height:19px;
                          ">
                            Descubrí nuevas formas de expresarte.
                          </p>
                        </td>

                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- BANNER DE MARCA -->
                <tr>
                  <td style="padding:0 20px 26px;">
                    <table
                      role="presentation"
                      width="100%"
                      cellpadding="0"
                      cellspacing="0"
                      border="0"
                      bgcolor="#101f3d"
                      style="
                        background-color:#101f3d;
                        border-radius:8px;
                      "
                    >
                      <tr>
                        <td
                          class="mobile-padding"
                          style="padding:25px 26px;"
                        >
                          <p style="
                            margin:0 0 8px;
                            color:#b7ceff;
                            font-size:10px;
                            line-height:16px;
                            font-weight:700;
                            letter-spacing:2px;
                          ">
                            MÁS QUE ROPA, ES TU ESTILO
                          </p>

                          <p style="
                            margin:0 0 8px;
                            color:#ffffff;
                            font-size:29px;
                            line-height:34px;
                            font-weight:800;
                            letter-spacing:-.5px;
                          ">
                            Pilchix
                          </p>

                          <p style="
                            margin:0;
                            color:#d7dfef;
                            font-size:14px;
                            line-height:22px;
                          ">
                            Tecnología, diseño y vos.
                          </p>

                          <table
                            role="presentation"
                            width="100%"
                            cellpadding="0"
                            cellspacing="0"
                            border="0"
                          >
                            <tr>
                              <td
                                style="
                                  padding-top:18px;
                                  border-bottom:1px solid #526486;
                                  height:1px;
                                  line-height:1px;
                                  font-size:1px;
                                "
                              >&nbsp;</td>
                            </tr>
                          </table>

                          <p style="
                            margin:17px 0 0;
                            color:#ffffff;
                            font-size:12px;
                            line-height:19px;
                          ">
                            Descubrí prendas, probá nuevos looks y encontrá
                            tu próxima favorita.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- CIERRE Y CTA -->
                <tr>
                  <td
                    align="center"
                    style="
                      padding:4px 28px 28px;
                      background-color:#ffffff;
                    "
                  >
                    <p style="
                      margin:0 0 12px;
                      color:#586782;
                      font-size:12px;
                      line-height:20px;
                    ">
                      Tu prueba queda guardada en tu perfil,
                      en la sección <b>Probador</b>.
                    </p>

                    <a
                      href="${perfilUrlHtml}"
                      target="_blank"
                      style="
                        color:#0a1730;
                        font-size:13px;
                        line-height:20px;
                        font-weight:700;
                        text-decoration:underline;
                      "
                    >
                      Ver mis prendas &nbsp; →
                    </a>

                    <table
                      role="presentation"
                      width="100%"
                      cellpadding="0"
                      cellspacing="0"
                      border="0"
                    >
                      <tr>
                        <td
                          style="
                            padding-top:25px;
                            border-bottom:1px solid #e2e7ef;
                            height:1px;
                            line-height:1px;
                            font-size:1px;
                          "
                        >&nbsp;</td>
                      </tr>
                    </table>

                    <p style="
                      margin:20px 0 5px;
                      color:#8995aa;
                      font-size:11px;
                      line-height:18px;
                    ">
                      Recibiste este mail porque usaste el probador virtual
                      de Pilchix.
                    </p>

                    <p style="
                      margin:0;
                      color:#8995aa;
                      font-size:11px;
                      line-height:18px;
                    ">
                      Pilchix · Tecnología, diseño y vos.
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>

      </body>
      </html>
    `;

    try {
      await transporter.sendMail({
        from: MAIL_FROM,
        to: email,
        subject: `Así te queda ${nombrePlano} 👀 | Pilchix`,
        text: `${saludo}

Tu prueba virtual de ${nombrePlano} ya está lista.

Descubrí cómo se ve la prenda en vos y explorá más opciones en Pilchix.

Ver mi prueba: ${perfilUrl}

EXPO INFO
Stand B12 · La Rural, Buenos Aires.

Tu prueba queda guardada en tu perfil, en la sección Probador.

Pilchix · Tecnología, diseño y vos.`,
        html,
        attachments: [
          {
            filename: `pilchix-prueba.${ext}`,
            content: imagen,
            contentType: mimetype,
            cid: "prueba-virtual",
          },
        ],
      });

      return true;
    } catch (err) {
      console.error("No se pudo enviar el mail del probador:", err.message);
      return false;
    }
  },
};