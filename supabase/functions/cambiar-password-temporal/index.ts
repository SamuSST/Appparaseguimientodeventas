import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Método no permitido." }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Debes iniciar sesión para cambiar la contraseña." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("Falta configurar el entorno de la función cambiar-password-temporal.");
    return jsonResponse({ error: "El servicio de contraseñas no está configurado." }, 500);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: authData, error: authError } = await authClient.auth.getUser();
  if (authError || !authData.user) {
    return jsonResponse({ error: "La sesión no es válida. Inicia sesión de nuevo." }, 401);
  }

  let input: { password?: unknown };
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ error: "La solicitud no contiene datos válidos." }, 400);
  }
  if (!input || typeof input !== "object") {
    return jsonResponse({ error: "La solicitud no contiene datos válidos." }, 400);
  }
  if (typeof input.password !== "string" || input.password.length < 8 || input.password.length > 128) {
    return jsonResponse({ error: "La contraseña debe tener entre 8 y 128 caracteres." }, 400);
  }

  const { data: profile, error: profileError } = await adminClient
    .from("usuarios")
    .select("debe_cambiar_password")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (profileError) {
    console.error("No se pudo verificar el estado de la contraseña:", profileError.message);
    return jsonResponse({ error: "No se pudo verificar el estado de la cuenta." }, 500);
  }
  if (!profile) return jsonResponse({ error: "No se encontró el perfil de esta cuenta." }, 404);
  if (!profile.debe_cambiar_password) {
    return jsonResponse({ error: "Esta cuenta no requiere cambiar su contraseña temporal." }, 409);
  }

  const { error: passwordError } = await adminClient.auth.admin.updateUserById(authData.user.id, {
    password: input.password,
  });
  if (passwordError) {
    console.error("No se pudo actualizar la contraseña:", passwordError.message);
    return jsonResponse({ error: "No se pudo actualizar la contraseña. Verifica que cumpla los requisitos." }, 400);
  }

  const { data: updatedProfile, error: updateProfileError } = await adminClient
    .from("usuarios")
    .update({ debe_cambiar_password: false })
    .eq("id", authData.user.id)
    .select("id")
    .maybeSingle();
  if (updateProfileError || !updatedProfile) {
    console.error("No se pudo quitar el requisito de cambio de contraseña:", updateProfileError?.message);
    return jsonResponse({
      error: "La contraseña se actualizó, pero no se pudo completar el acceso. Intenta guardar de nuevo.",
    }, 500);
  }

  return jsonResponse({ ok: true });
});
