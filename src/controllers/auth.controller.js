import { authService } from "../services/auth.service.js";

export const authController = {
  async registrarUsuario(req, res, next) {
    try {
      const { nombre, email, password } = req.body;
      if (!nombre || !email || !password) {
        return res.status(400).json({ error: "Faltan campos obligatorios" });
      }
      const data = await authService.registrarUsuario({ nombre, email, password });
      res.status(201).json(data);
    } catch (err) { next(err); }
  },

  async loginUsuario(req, res, next) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Faltan credenciales" });
      }
      const data = await authService.loginUsuario({ email, password });
      res.json(data);
    } catch (err) { next(err); }
  },

  async registrarMarca(req, res, next) {
    try {
      const { nombre, email, password, descripcion, ubicacion } = req.body;
      if (!nombre || !email || !password) {
        return res.status(400).json({ error: "Faltan campos obligatorios" });
      }
      const data = await authService.registrarMarca({ nombre, email, password, descripcion, ubicacion });
      res.status(201).json(data);
    } catch (err) { next(err); }
  },

  async loginMarca(req, res, next) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Faltan credenciales" });
      }
      const data = await authService.loginMarca({ email, password });
      res.json(data);
    } catch (err) { next(err); }
  },
};