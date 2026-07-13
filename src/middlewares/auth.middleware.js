import jwt from "jsonwebtoken";

export function autenticar(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No autenticado" });
  }
  try {
    const token = header.split(" ")[1];
    req.auth = jwt.verify(token, process.env.JWT_SECRET); // { id, tipo }
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
}

// exige que sea una MARCA (para el back-office)
export function soloMarca(req, res, next) {
  if (req.auth?.tipo !== "marca") {
    return res.status(403).json({ error: "Acceso solo para marcas" });
  }
  next();
}

// exige que sea un USUARIO (cliente)
export function soloUsuario(req, res, next) {
  if (req.auth?.tipo !== "usuario") {
    return res.status(403).json({ error: "Acceso solo para usuarios" });
  }
  next();
}