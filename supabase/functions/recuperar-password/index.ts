import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, enviarCredenciales, generarPasswordTemporal, jsonResponse } from "../_shared/correo.ts";

// "¿Olvidaste tu contraseña?": se usa sin sesión. Si el correo es de una cuenta activa, se genera
// una contraseña temporal nueva y se envía a ese correo. La respuesta es siempre la misma para no
// revelar qué correos tienen cuenta, y solo se permite una solicitud cada 10 minutos por cuenta.
const ESPERA_MINUTOS = 10;
const RESPUESTA = { ok: true, mensaje: "Si el correo tiene una cuenta activa, te enviamos una contraseña temporal." };

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Método no permitido." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Falta configurar el entorno de la función recuperar-password.");
    return jsonResponse({ error: "El servicio no está configurado." }, 500);
  }

  let email = "";
  try {
    const input = await request.json();
    email = typeof input?.email === "string" ? input.email.trim().toLowerCase() : "";
  } catch {
    return jsonResponse({ error: "La solicitud no contiene datos válidos." }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return jsonResponse({ error: "Escribe un correo válido." }, 400);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: cuenta } = await adminClient
    .from("usuarios")
    .select("id, nombre, email, rol, activo, ultimo_reinicio_password")
    .eq("email", email)
    .maybeSingle();
  if (!cuenta || !cuenta.activo) return jsonResponse(RESPUESTA);

  const ultimo = cuenta.ultimo_reinicio_password ? new Date(cuenta.ultimo_reinicio_password).getTime() : 0;
  if (Date.now() - ultimo < ESPERA_MINUTOS * 60_000) return jsonResponse(RESPUESTA);

  const password = generarPasswordTemporal();
  const { error: passError } = await adminClient.auth.admin.updateUserById(cuenta.id, { password });
  if (passError) {
    console.error("No se pudo generar la contraseña de recuperación:", passError.message);
    return jsonResponse(RESPUESTA);
  }
  await adminClient
    .from("usuarios")
    .update({ debe_cambiar_password: true, ultimo_reinicio_password: new Date().toISOString() })
    .eq("id", cuenta.id);
  await enviarCredenciales({ ...cuenta, password }, "reinicio");
  return jsonResponse(RESPUESTA);
});
