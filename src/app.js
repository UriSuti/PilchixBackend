import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes.js";
import catalogoRoutes from "./routes/catalogo.routes.js";
import { errorHandler } from "./middlewares/error.middleware.js";

const app = express();

app.use(cors({ origin: "http://localhost:5173" })); // el front de Vite
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/catalogo", catalogoRoutes);

app.use(errorHandler);

export default app;