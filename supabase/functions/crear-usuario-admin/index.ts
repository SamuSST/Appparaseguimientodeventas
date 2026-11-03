import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

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

  const emailEnviado = await enviarCorreoBienvenida({ nombre, email, rol, password });

  return jsonResponse({
    id: created.user.id,
    email,
    nombre,
    rol,
    emailEnviado,
  });
});

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// Envía las credenciales desde una cuenta de Gmail (SMTP con contraseña de aplicación).
// Si el envío falla, la cuenta ya existe y el administrador sigue viendo la contraseña
// temporal en pantalla para entregarla.
async function enviarCorreoBienvenida(cuenta: { nombre: string; email: string; rol: string; password: string }) {
  const gmailUser = Deno.env.get("GMAIL_USER");
  const gmailAppPassword = Deno.env.get("GMAIL_APP_PASSWORD")?.replaceAll(" ", "");
  const appUrl = Deno.env.get("APP_URL") ?? "https://samusst.github.io/Appparaseguimientodeventas/";
  if (!gmailUser || !gmailAppPassword) {
    console.error("Falta configurar GMAIL_USER o GMAIL_APP_PASSWORD; no se envió el correo de bienvenida.");
    return false;
  }

  const nombre = escapeHtml(cuenta.nombre);
  const email = escapeHtml(cuenta.email);
  const password = escapeHtml(cuenta.password);
  const url = escapeHtml(appUrl);
  const tipoCuenta = cuenta.rol === "admin" ? "administrador" : "vendedor";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #111827;">
      <h2 style="color: #1d4ed8;">Bienvenido(a) al Sistema de Gestión CDA 37</h2>
      <p>Hola ${nombre},</p>
      <p>Se creó tu cuenta de <strong>${tipoCuenta}</strong>. Estos son tus datos de acceso:</p>
      <table style="border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 4px 12px 4px 0; color: #6b7280;">Correo</td><td><strong>${email}</strong></td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #6b7280;">Contraseña temporal</td><td><code style="background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 15px;">${password}</code></td></tr>
      </table>
      <p>
        <a href="${url}" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-weight: bold;">Iniciar sesión</a>
      </p>
      <p style="font-size: 13px; color: #6b7280;">Al ingresar por primera vez deberás crear una contraseña propia. Si no esperabas este correo, ignóralo.</p>
    </div>`;

  const text = [
    `Hola ${cuenta.nombre},`,
    "",
    `Se creó tu cuenta de ${tipoCuenta} en el Sistema de Gestión CDA 37.`,
    `Correo: ${cuenta.email}`,
    `Contraseña temporal: ${cuenta.password}`,
    `Ingresa en: ${appUrl}`,
    "",
    "Al ingresar por primera vez deberás crear una contraseña propia.",
  ].join("\n");

  // Supabase bloquea los puertos 25 y 587, por eso se usa 465 con TLS directo.
  const client = new SMTPClient({
    connection: {
      hostname: "smtp.gmail.com",
      port: 465,
      tls: true,
      auth: { username: gmailUser, password: gmailAppPassword },
    },
  });

  try {
    await client.send({
      from: `CDA 37 <${gmailUser}>`,
      to: cuenta.email,
      subject: "Tu cuenta en el Sistema de Gestión CDA 37",
      content: text,
      html,
    });
    return true;
  } catch (error) {
    console.error("No se pudo enviar el correo de bienvenida:", error);
    return false;
  } finally {
    try {
      await client.close();
    } catch {
      // La conexión ya estaba cerrada.
    }
  }
}
