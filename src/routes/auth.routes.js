import { Router } from "express";
import { authController } from "../controllers/auth.controller.js";

const router = Router();

router.post("/usuario/registro", authController.registrarUsuario);
router.post("/usuario/login", authController.loginUsuario);
router.post("/marca/registro", authController.registrarMarca);
router.post("/marca/login", authController.loginMarca);

export default router;