import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

// SMTP genérico. Con Gmail: SMTP_HOST=smtp.gmail.com, SMTP_PORT=465 y en
// SMTP_PASS una "contraseña de aplicación" (no la contraseña normal de la cuenta).
export const mailConfigurado = Boolean(
  process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
);

const puerto = Number(process.env.SMTP_PORT) || 465;

export const transporter = mailConfigurado
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: puerto,
      secure: puerto === 465, // 465 = SSL directo; 587 = STARTTLS
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : null;

export const MAIL_FROM = process.env.MAIL_FROM || `Pilchix <${process.env.SMTP_USER}>`;
