import { useState } from "react";
import { Search, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../../lib/supabase";
import { Card } from "../ui/card";
import { parseDateKey } from "../../data/metrics";
import { estadoReinspeccion, type Atencion } from "../../../hooks/useSellerData";
import { toDateKey } from "../../data/metrics";
import { enlaceLlamar, formatearTelefono } from "../../../lib/telefono";

const PAGINA = 20;

// puedeBorrar: el vendedor puede borrar las atenciones que registró él mismo hoy (no las del Excel).
export function SellerClients({ atenciones, puedeBorrar = false, onCambio }: { atenciones: Atencion[]; puedeBorrar?: boolean; onCambio?: () => void }) {
  const hoy = toDateKey(new Date());
  const [busqueda, setBusqueda] = useState("");
  const [visibles, setVisibles] = useState(PAGINA);

  const texto = busqueda.trim().toLowerCase();
  const filtradas = texto
    ? atenciones.filter((a) =>
        [a.placa, a.cliente_nombre, a.marca, a.vehiculo, a.cliente_telefono].some((campo) => campo?.toLowerCase().includes(texto)),
      )
    : atenciones;

  return (
    <Card className="p-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">Clientes atendidos este año</h3>
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
            {atenciones.length}
          </span>
        </div>
        <div className="relative sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={busqueda}
            onChange={(event) => {
              setBusqueda(event.target.value);
              setVisibles(PAGINA);
            }}
            placeholder="Buscar placa, cliente o marca"
            aria-label="Buscar clientes"
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </div>
      </div>

      {filtradas.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">
          {atenciones.length === 0 ? "Aún no tienes clientes registrados." : "No hay resultados para esa búsqueda."}
        </p>
      ) : (
        <>
          <ul className="divide-y divide-gray-100">
            {filtradas.slice(0, visibles).map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900">
                    {a.cliente_nombre || "Cliente sin nombre"}
                    {a.cliente_telefono && (
                      <a href={enlaceLlamar(a.cliente_telefono)} className="ml-2 font-mono text-xs font-normal text-blue-700 hover:underline">
                        {formatearTelefono(a.cliente_telefono)}
                      </a>
                    )}
                  </p>
                  <p className="truncate text-xs text-gray-500">
                    <span className="font-mono font-semibold text-gray-700">{a.placa}</span>
                    {[a.marca, a.vehiculo, a.tipo_revision].filter(Boolean).map((d) => ` · ${d}`)}
                    {a.resultado && (
                      <span className={a.resultado === "Rechazada" ? "font-medium text-red-600" : "text-green-700"}> · {a.resultado}</span>
                    )}
                    {(() => {
                      const estado = estadoReinspeccion(a, atenciones, hoy);
                      return estado ? <span className="text-gray-500"> (reinspección: {estado.toLowerCase()})</span> : null;
                    })()}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-right">
                  {puedeBorrar && a.carga_id === null && a.fecha === hoy && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!window.confirm(`¿Borrar la atención de la placa ${a.placa}?`)) return;
                        const { error } = await supabase.from("atenciones").delete().eq("id", a.id);
                        if (error) {
                          console.error("No se pudo borrar la atención:", error);
                          toast.error("No se pudo borrar la atención.");
                          return;
                        }
                        toast.success("Atención borrada.");
                        onCambio?.();
                      }}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      aria-label={`Borrar atención de ${a.placa}`}
                      title="Borrar (solo lo registrado hoy)"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                  <div>
                  <p className="text-xs text-gray-500">
                    {parseDateKey(a.fecha).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}
                    {a.hora ? ` · ${a.hora.slice(0, 5)}` : ""}
                  </p>
                  <span
                    className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      a.tipo_revision === "Reinspección"
                        ? "bg-blue-100 text-blue-800"
                        : a.pagado
                          ? "bg-green-100 text-green-800"
                          : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {a.tipo_revision === "Reinspección" ? "Gratis" : a.pagado ? "Pagado" : "Pendiente"}
                  </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {filtradas.length > visibles && (
            <button
              type="button"
              onClick={() => setVisibles((v) => v + PAGINA)}
              className="mt-3 w-full rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Ver más ({filtradas.length - visibles} restantes)
            </button>
          )}
        </>
      )}
    </Card>
  );
}
