import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function generarPasswordTemporal() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const valores = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(valores, (v) => alphabet[v % alphabet.length]).join("");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// Envía usuario y contraseña temporal desde la cuenta de Gmail del CDA (SMTP con contraseña de aplicación).
// motivo "bienvenida": cuenta nueva; "reinicio": contraseña nueva por olvido o porque el admin la reinició.
// Si el envío falla devuelve false; quien llama decide cómo avisar.
export async function enviarCredenciales(
  cuenta: { nombre: string; email: string; rol: string; password: string },
  motivo: "bienvenida" | "reinicio" = "bienvenida",
) {
  const gmailUser = Deno.env.get("GMAIL_USER");
  const gmailAppPassword = Deno.env.get("GMAIL_APP_PASSWORD")?.replaceAll(" ", "");
  const appUrl = Deno.env.get("APP_URL") ?? "https://samusst.github.io/Appparaseguimientodeventas/";
  if (!gmailUser || !gmailAppPassword) {
    console.error("Falta configurar GMAIL_USER o GMAIL_APP_PASSWORD; no se envió el correo.");
    return false;
  }

  const nombre = escapeHtml(cuenta.nombre);
  const email = escapeHtml(cuenta.email);
  const password = escapeHtml(cuenta.password);
  const url = escapeHtml(appUrl);
  const tipoCuenta = cuenta.rol === "admin" ? "administrador" : "vendedor";
  const titulo = motivo === "bienvenida"
    ? "Bienvenido(a) al Sistema de Gestión CDA 37"
    : "Tu nueva contraseña temporal";
  const intro = motivo === "bienvenida"
    ? `Se creó tu cuenta de <strong>${tipoCuenta}</strong>. Estos son tus datos de acceso:`
    : "Se generó una contraseña temporal nueva para tu cuenta. La anterior ya no funciona.";
  const introTexto = motivo === "bienvenida"
    ? `Se creó tu cuenta de ${tipoCuenta} en el Sistema de Gestión CDA 37.`
    : "Se generó una contraseña temporal nueva para tu cuenta. La anterior ya no funciona.";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #111827;">
      <h2 style="color: #1d4ed8;">${titulo}</h2>
      <p>Hola ${nombre},</p>
      <p>${intro}</p>
      <table style="border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 4px 12px 4px 0; color: #6b7280;">Correo</td><td><strong>${email}</strong></td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #6b7280;">Contraseña temporal</td><td><code style="background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 15px;">${password}</code></td></tr>
      </table>
      <p>
        <a href="${url}" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-weight: bold;">Iniciar sesión</a>
      </p>
      <p style="font-size: 13px; color: #6b7280;">Al ingresar deberás crear una contraseña propia. Si no esperabas este correo, avísale al administrador.</p>
    </div>`;

  const text = [
    `Hola ${cuenta.nombre},`,
    "",
    introTexto,
    `Correo: ${cuenta.email}`,
    `Contraseña temporal: ${cuenta.password}`,
    `Ingresa en: ${appUrl}`,
    "",
    "Al ingresar deberás crear una contraseña propia.",
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
      subject: motivo === "bienvenida" ? "Tu cuenta en el Sistema de Gestión CDA 37" : "Tu nueva contraseña temporal · CDA 37",
      content: text,
      html,
    });
    return true;
  } catch (error) {
    console.error("No se pudo enviar el correo:", error);
    return false;
  } finally {
    try {
      await client.close();
    } catch {
      // La conexión ya estaba cerrada.
    }
  }
}
