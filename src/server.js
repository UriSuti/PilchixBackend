import dotenv from "dotenv";
dotenv.config();
import app from "./app.js";

console.log("CA EXTRA:", process.env.NODE_EXTRA_CA_CERTS);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API escuchando en http://localhost:${PORT}`));