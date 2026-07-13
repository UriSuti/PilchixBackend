import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

console.log("SUPABASE_URL:", process.env.SUPABASE_URL);
console.log("KEY presente:", Boolean(process.env.SUPABASE_SERVICE_KEY));
console.log("KEY length:", process.env.SUPABASE_SERVICE_KEY?.length);

export const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
)