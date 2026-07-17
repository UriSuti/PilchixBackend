import multer from "multer";

const MAX_SIZE_MB = 8;

const configBase = {
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Solo se permiten archivos de imagen"));
    }
    cb(null, true);
  },
};

export const uploadImagenes = multer(configBase).array("imagenes");
export const uploadFotoPerfil = multer(configBase).single("foto");
