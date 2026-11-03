import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, enviarCredenciales, generarPasswordTemporal, jsonResponse } from "../_shared/correo.ts";

// Acciones del administrador sobre una cuenta existente:
// desactivar / activar el acceso, generar una contraseña temporal nueva y corregir nombre o correo.
type Accion = "desactivar" | "activar" | "reiniciar_password" | "editar";
const ACCIONES: Accion[] = ["desactivar", "activar", "reiniciar_password", "editar"];
const SIN_LIMITE = "876000h"; // ~100 años: bloqueo hasta que el admin la reactive

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
    console.error("Falta configurar el entorno de la función gestionar-usuario-admin.");
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
  const { data: admin } = await adminClient.from("usuarios").select("rol, activo").eq("id", authData.user.id).maybeSingle();
  if (!admin || admin.rol !== "admin" || !admin.activo) {
    return jsonResponse({ error: "Solo un administrador activo puede gestionar cuentas." }, 403);
  }

  let input: { accion?: unknown; usuarioId?: unknown; nombre?: unknown; email?: unknown };
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ error: "La solicitud no contiene datos válidos." }, 400);
  }
  const accion = input?.accion as Accion;
  const usuarioId = typeof input?.usuarioId === "string" ? input.usuarioId : "";
  if (!ACCIONES.includes(accion) || !usuarioId) {
    return jsonResponse({ error: "Acción o cuenta no válida." }, 400);
  }
  if (usuarioId === authData.user.id && accion === "desactivar") {
    return jsonResponse({ error: "No puedes desactivar tu propia cuenta." }, 400);
  }

  const { data: cuenta, error: cuentaError } = await adminClient
    .from("usuarios")
    .select("id, nombre, email, rol, activo")
    .eq("id", usuarioId)
    .maybeSingle();
  if (cuentaError || !cuenta) return jsonResponse({ error: "No se encontró la cuenta." }, 404);

  if (accion === "desactivar" || accion === "activar") {
    const activo = accion === "activar";
    const { error: banError } = await adminClient.auth.admin.updateUserById(usuarioId, {
      ban_duration: activo ? "none" : SIN_LIMITE,
    });
    if (banError) {
      console.error("No se pudo cambiar el acceso:", banError.message);
      return jsonResponse({ error: "No se pudo cambiar el acceso de la cuenta." }, 500);
    }
    const { error } = await adminClient.from("usuarios").update({ activo }).eq("id", usuarioId);
    if (error) return jsonResponse({ error: "No se pudo actualizar el perfil." }, 500);
    return jsonResponse({ ok: true, activo });
  }

  if (accion === "reiniciar_password") {
    const password = generarPasswordTemporal();
    const { error: passError } = await adminClient.auth.admin.updateUserById(usuarioId, { password });
    if (passError) {
      console.error("No se pudo reiniciar la contraseña:", passError.message);
      return jsonResponse({ error: "No se pudo generar la contraseña nueva." }, 500);
    }
    await adminClient
      .from("usuarios")
      .update({ debe_cambiar_password: true, ultimo_reinicio_password: new Date().toISOString() })
      .eq("id", usuarioId);
    const emailEnviado = await enviarCredenciales({ ...cuenta, password }, "reinicio");
    return jsonResponse({ ok: true, password, email: cuenta.email, emailEnviado });
  }

  // editar
  const nombre = typeof input.nombre === "string" ? input.nombre.trim() : cuenta.nombre;
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : cuenta.email;
  if (!nombre || nombre.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return jsonResponse({ error: "Revisa el nombre y el correo." }, 400);
  }
  if (email !== cuenta.email) {
    const { error: emailError } = await adminClient.auth.admin.updateUserById(usuarioId, { email, email_confirm: true });
    if (emailError) {
      console.error("No se pudo cambiar el correo:", emailError.message);
      const ocupado = emailError.message.toLowerCase().includes("already");
      return jsonResponse({ error: ocupado ? "Ya existe otra cuenta con ese correo." : "No se pudo cambiar el correo." }, ocupado ? 409 : 400);
    }
  }
  const { error } = await adminClient.from("usuarios").update({ nombre, email }).eq("id", usuarioId);
  if (error) return jsonResponse({ error: "No se pudo actualizar el perfil." }, 500);
  return jsonResponse({ ok: true, nombre, email });
});
