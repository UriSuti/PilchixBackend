import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { usuarioRepository } from "../repositories/usuario.repository.js";
import { marcaRepository } from "../repositories/marca.repository.js";

const SALT_ROUNDS = 10;

function generarToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES,
  });
}

export const authService = {
  // ---------- USUARIO (cliente) ----------
  async registrarUsuario({ nombre, email, password }) {
    const existente = await usuarioRepository.findByEmail(email);
    if (existente) {
      const err = new Error("Ese email ya está registrado");
      err.status = 409;
      throw err;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const usuario = await usuarioRepository.create({ nombre, email, passwordHash });

    const token = generarToken({ id: usuario.id_usuario, tipo: "usuario" });
    return { usuario, token };
  },

  async loginUsuario({ email, password }) {
    const usuario = await usuarioRepository.findByEmail(email);
    if (!usuario) {
      const err = new Error("Email o contraseña incorrectos");
      err.status = 401;
      throw err;
    }

    const coincide = await bcrypt.compare(password, usuario.contraseña);
    if (!coincide) {
      const err = new Error("Email o contraseña incorrectos");
      err.status = 401;
      throw err;
    }

    // nunca devolvemos la contraseña
    const { contraseña, ...usuarioSinPassword } = usuario;
    const token = generarToken({ id: usuario.id_usuario, tipo: "usuario" });
    return { usuario: usuarioSinPassword, token };
  },

  // ---------- MARCA (vendedor) ----------
  async registrarMarca({ nombre, email, password }) {
    const existente = await marcaRepository.findByEmail(email);
    if (existente) {
      const err = new Error("Ese email ya está registrado");
      err.status = 409;
      throw err;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const marca = await marcaRepository.create({ nombre, email, passwordHash });

    // NO devolvemos token: queda pendiente de aprobación
    return { marca };
  },

  async loginMarca({ email, password }) {
    const marca = await marcaRepository.findByEmail(email);
    if (!marca) {
      const err = new Error("Email o contraseña incorrectos");
      err.status = 401;
      throw err;
    }

    const coincide = await bcrypt.compare(password, marca.contraseña);
    if (!coincide) {
      const err = new Error("Email o contraseña incorrectos");
      err.status = 401;
      throw err;
    }

    if (marca.estado !== true) {
      const err = new Error("Tu marca todavía está pendiente de aprobación");
      err.status = 403;
      throw err;
    }

    const { contraseña, ...marcaSinPassword } = marca;
    const token = generarToken({ id: marca.id_marca, tipo: "marca" });
    return { marca: marcaSinPassword, token };
  },
};