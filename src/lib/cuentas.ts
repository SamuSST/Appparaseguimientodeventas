import { supabase } from "./supabase";

export type Rol = "admin" | "vendedor";

export type CuentaCreada = {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  emailEnviado: boolean;
};

export function generarPasswordTemporal() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const randomValues = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(randomValues, (value) => alphabet[value % alphabet.length]).join("");
}

// Crea la cuenta con la función crear-usuario-admin, que además envía el correo de bienvenida.
export async function crearCuenta(cuenta: { nombre: string; email: string; rol: Rol; password: string }) {
  const { data, error } = await supabase.functions.invoke<CuentaCreada>("crear-usuario-admin", {
    body: {
      nombre: cuenta.nombre.trim(),
      email: cuenta.email.trim().toLowerCase(),
      rol: cuenta.rol,
      password: cuenta.password,
    },
  });

  if (error) {
    const response = error.context;
    if (response instanceof Response) {
      const result = await response.json() as { error?: string };
      throw new Error(result.error || error.message);
    }
    throw error;
  }
  if (!data) throw new Error("El servidor no devolvió los datos de la cuenta.");
  return data;
}
