import { MessageCircle, Phone } from "lucide-react";
import { enlaceLlamar, enlaceWhatsApp, formatearTelefono } from "../../lib/telefono";

// Botones para llamar o escribir por WhatsApp al cliente desde Seguimiento.
export function ContactButtons({ telefono, mensaje }: { telefono: string | null; mensaje: string }) {
  if (!telefono) return <span className="text-xs text-gray-400">Sin teléfono</span>;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 font-mono text-xs text-gray-700">{formatearTelefono(telefono)}</span>
      <a
        href={enlaceLlamar(telefono)}
        className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
      >
        <Phone className="h-3.5 w-3.5" /> Llamar
      </a>
      <a
        href={enlaceWhatsApp(telefono, mensaje)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100"
      >
        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
      </a>
    </div>
  );
}
