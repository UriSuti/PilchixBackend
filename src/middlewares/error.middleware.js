export function errorHandler(err, req, res, next) {
  console.error("ERROR:", err);
  console.error("CAUSA:", err.cause);   // ← esto es lo que necesito
  res.status(err.status || 500).json({ error: err.message || "Error del servidor" });
}