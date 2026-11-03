import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, enviarCredenciales, jsonResponse } from "../_shared/correo.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Método no permitido." }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Debes iniciar sesión como administrador." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("Falta configurar el entorno de la función crear-usuario-admin.");
    return jsonResponse({ error: "El servicio de cuentas no está configurado." }, 500);
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

  const { data: adminProfile, error: profileError } = await adminClient
    .from("usuarios")
    .select("rol, activo")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (profileError) {
    console.error("No se pudo verificar el rol del administrador:", profileError.message);
    return jsonResponse({ error: "No se pudo verificar el permiso de administrador." }, 500);
  }
  if (!adminProfile || adminProfile.rol !== "admin" || !adminProfile.activo) {
    return jsonResponse({ error: "Solo un administrador activo puede crear cuentas." }, 403);
  }

  let input: { nombre?: unknown; email?: unknown; rol?: unknown; password?: unknown };
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ error: "La solicitud no contiene datos válidos." }, 400);
  }
  if (!input || typeof input !== "object") {
    return jsonResponse({ error: "La solicitud no contiene datos válidos." }, 400);
  }

  const nombre = typeof input.nombre === "string" ? input.nombre.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const rol = input.rol;
  const password = input.password;
  if (
    !nombre ||
    nombre.length > 120 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254 ||
    (rol !== "admin" && rol !== "vendedor") ||
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 128
  ) {
    return jsonResponse({ error: "Revisa el nombre, correo, rol y contraseña temporal." }, 400);
  }

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre, rol },
  });
  if (createError || !created.user) {
    console.error("No se pudo crear el usuario de autenticación:", createError?.message);
    if (createError?.message.toLowerCase().includes("already")) {
      return jsonResponse({ error: "Ya existe una cuenta con ese correo." }, 409);
    }
    return jsonResponse({ error: "No se pudo crear la cuenta. Verifica los datos e inténtalo de nuevo." }, 400);
  }

  const { error: saveProfileError } = await adminClient
    .from("usuarios")
    .upsert(
      {
        id: created.user.id,
        nombre,
        email,
        rol,
        activo: true,
        debe_cambiar_password: true,
      },
      { onConflict: "id" },
    );
  if (saveProfileError) {
    console.error("No se pudo guardar el perfil de la cuenta:", saveProfileError.message);
    const { error: cleanupError } = await adminClient.auth.admin.deleteUser(created.user.id);
    if (cleanupError) {
      console.error("No se pudo limpiar la cuenta de autenticación incompleta:", cleanupError.message);
    }
    return jsonResponse({ error: "No se pudo guardar el perfil. No se creó la cuenta." }, 500);
  }

  const emailEnviado = await enviarCredenciales({ nombre, email, rol, password }, "bienvenida");

  return jsonResponse({
    id: created.user.id,
    email,
    nombre,
    rol,
    emailEnviado,
  });
});
