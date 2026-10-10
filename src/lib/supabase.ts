/// <reference types="vite/client" />
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  throw new Error(
    "Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Revisa tu archivo .env.local " +
      "(en desarrollo) o los secretos del workflow de GitHub (en producción).",
  );
}


export const supabase = createClient(url, anonKey);