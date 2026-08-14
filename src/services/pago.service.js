import { MercadoPagoConfig, Preference, Payment } from "mercadopago";

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,   // ← el token NUEVO, desde env
});

const FRONTEND = process.env.FRONTEND_URL || "http://localhost:5173";

export const pagoService = {
  async crearPreferencia(items) {
    if (!items || !items.length) {
      const err = new Error("El carrito está vacío");
      err.status = 400;
      throw err;
    }
    const preference = new Preference(client);
    const result = await preference.create({
      body: {
        items,
        back_urls: {
          success: `${FRONTEND}/carrito?pago=aprobado`,
          failure: `${FRONTEND}/carrito?pago=rechazado`,
          pending: `${FRONTEND}/carrito?pago=pendiente`,
        },
        statement_descriptor: "Pilchix",
      },
    });
    return { preferenceId: result.id };
  },

  async procesarPago(body) {
    const payment = new Payment(client);
    const result = await payment.create({ body });
    return {
      status: result.status,
      statusDetail: result.status_detail,
      id: result.id,
    };
  },
};