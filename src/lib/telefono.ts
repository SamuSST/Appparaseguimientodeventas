// Teléfonos de Colombia: se guardan solo con dígitos (10 para celular) y se muestran como "300 123 4567".

export function limpiarTelefono(valor: unknown): string | null {
  let digitos = String(valor ?? "").replace(/\D/g, "");
  if (digitos.length === 12 && digitos.startsWith("57")) digitos = digitos.slice(2);
  return digitos.length >= 7 && digitos.length <= 10 ? digitos : null;
}

export function formatearTelefono(tel: string | null | undefined) {
  if (!tel) return "";
  return tel.length === 10 ? `${tel.slice(0, 3)} ${tel.slice(3, 6)} ${tel.slice(6)}` : tel;
}

export function enlaceLlamar(tel: string) {
  return `tel:+57${tel}`;
}

export function enlaceWhatsApp(tel: string, mensaje: string) {
  return `https://wa.me/57${tel}?text=${encodeURIComponent(mensaje)}`;
}

// Mensaje listo para que el vendedor avise al cliente.
export function mensajeSeguimiento(opciones: {
  tipo: "reinspeccion" | "renovacion";
  cliente: string | null;
  placa: string;
  fecha: string; // fecha límite o de vencimiento, ya formateada
  vendedor: string | null;
  vendedorTelefono: string | null;
}) {
  const saludo = opciones.cliente ? `Hola ${opciones.cliente.split(" ")[0]}` : "Hola";
  const firma = [opciones.vendedor, opciones.vendedorTelefono ? `(${formatearTelefono(opciones.vendedorTelefono)})` : ""]
    .filter(Boolean)
    .join(" ");
  const cuerpo =
    opciones.tipo === "reinspeccion"
      ? `te recordamos que el vehículo de placa ${opciones.placa} puede volver GRATIS a la reinspección de la revisión técnico-mecánica hasta el ${opciones.fecha}.`
      : `la revisión técnico-mecánica del vehículo de placa ${opciones.placa} vence el ${opciones.fecha}. Te esperamos para renovarla a tiempo.`;
  return `${saludo}, ${cuerpo} CDA La 37${firma ? ` · ${firma}` : ""}.`;
}
