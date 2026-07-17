import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes.js";
import catalogoRoutes from "./routes/catalogo.routes.js";
import localesRoutes from "./routes/locales.routes.js";
import productosPublicosRoutes from "./routes/productos-publicos.routes.js";
import opinionRoutes from "./routes/opinion.routes.js";
import compraRoutes from "./routes/compra.routes.js";
import carritoRoutes from "./routes/carrito.routes.js";
import favoritoRoutes from "./routes/favorito.routes.js";
import suscripcionRoutes from "./routes/suscripcion.routes.js";
import busquedaRoutes from "./routes/busqueda.routes.js";
import usuarioRoutes from "./routes/usuario.routes.js";
import { errorHandler } from "./middlewares/error.middleware.js";

const app = express();

app.use(cors({ origin: "http://localhost:5173" })); // el front de Vite
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/catalogo", catalogoRoutes);
app.use("/api/locales", localesRoutes);
app.use("/api/productos", productosPublicosRoutes);
app.use("/api/opiniones", opinionRoutes);
app.use("/api/compras", compraRoutes);
app.use("/api/carrito", carritoRoutes);
app.use("/api/favoritos", favoritoRoutes);
app.use("/api/suscripciones", suscripcionRoutes);
app.use("/api/busquedas", busquedaRoutes);
app.use("/api/usuarios", usuarioRoutes);

app.use(errorHandler);

export default app;