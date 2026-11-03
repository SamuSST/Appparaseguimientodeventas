import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CalendarClock, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../../lib/supabase";
import { Card } from "../ui/card";
import { fechaCorta, textoDias, type Reinspeccion, type Renovacion } from "../AdminFollowUpPanel";

// Clientes del vendedor a los que conviene llamar: rechazados que pueden volver gratis y RTM por renovar.
export function SellerFollowUp({ vendedorId }: { vendedorId: string }) {
  const [reinspecciones, setReinspecciones] = useState<Reinspeccion[]>([]);
  const [renovaciones, setRenovaciones] = useState<Renovacion[]>([]);
  const [verVencidas, setVerVencidas] = useState(false);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [reinsRes, renovRes] = await Promise.all([
        supabase.rpc("reinspecciones_pendientes", { p_dias: 60 }),
        supabase.rpc("renovaciones_proximas", { p_dias_antes: 45, p_dias_despues: 30 }),
      ]);
      if (reinsRes.error) throw reinsRes.error;
      if (renovRes.error) throw renovRes.error;
      // El vendedor solo recibe las suyas; el admin recibe todas y aquí se filtran por el vendedor que está viendo.
      setReinspecciones(((reinsRes.data ?? []) as Reinspeccion[]).filter((r) => r.vendedor_id === vendedorId));
      setRenovaciones(((renovRes.data ?? []) as Renovacion[]).filter((r) => r.vendedor_id === vendedorId));
    } catch (error) {
      console.error("No se pudo cargar el seguimiento del vendedor:", error);
      toast.error("No se pudo cargar tu seguimiento.");
    } finally {
      setLoading(false);
    }
  }, [vendedorId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const visibles = verVencidas ? reinspecciones : reinspecciones.filter((r) => r.estado === "En plazo");

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Seguimiento</h2>
          <p className="text-sm text-gray-500">Clientes a los que conviene llamar.</p>
        </div>
        <button
          type="button"
          onClick={() => void cargar()}
          className="rounded-lg border border-gray-300 bg-white p-2 text-gray-600 hover:bg-gray-50"
          aria-label="Actualizar seguimiento"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <Card className="p-4">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <h3 className="font-semibold text-gray-900">Reinspecciones pendientes</h3>
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
              {reinspecciones.filter((r) => r.estado === "En plazo").length}
            </span>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={verVencidas} onChange={(e) => setVerVencidas(e.target.checked)} /> Ver vencidas
          </label>
        </div>
        <p className="mb-3 text-xs text-gray-500">Su RTM fue rechazada y tienen 15 días para volver gratis.</p>
        {loading ? (
          <p className="py-4 text-center text-sm text-gray-500">Cargando...</p>
        ) : visibles.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-500">No tienes reinspecciones pendientes.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {visibles.map((r) => (
              <li key={r.atencion_id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900">{r.cliente_nombre || "Cliente sin nombre"}</p>
                  <p className="truncate text-xs text-gray-500">
                    <span className="font-mono font-semibold text-gray-700">{r.placa}</span>
                    {[r.marca, r.vehiculo].filter(Boolean).map((d) => ` · ${d}`)} · rechazada el {fechaCorta(r.fecha)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    r.estado === "Vencida" ? "bg-gray-200 text-gray-700" : r.dias_restantes <= 3 ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {r.estado === "Vencida" ? "Vencida" : `Vence ${textoDias(r.dias_restantes, "en", "hace")}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-4">
        <div className="mb-1 flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">Clientes por renovar</h3>
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">{renovaciones.length}</span>
        </div>
        <p className="mb-3 text-xs text-gray-500">Su RTM vence en los próximos 45 días o venció hace menos de 30: llámalos para que vuelvan.</p>
        {loading ? (
          <p className="py-4 text-center text-sm text-gray-500">Cargando...</p>
        ) : renovaciones.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-500">No tienes clientes por renovar en este periodo.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {renovaciones.map((r) => (
              <li key={r.atencion_id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900">{r.cliente_nombre || "Cliente sin nombre"}</p>
                  <p className="truncate text-xs text-gray-500">
                    <span className="font-mono font-semibold text-gray-700">{r.placa}</span>
                    {[r.marca, r.vehiculo].filter(Boolean).map((d) => ` · ${d}`)} · última RTM {fechaCorta(r.ultima_rtm)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    r.dias_para_vencer < 0 ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"
                  }`}
                >
                  {r.dias_para_vencer < 0 ? `Venció ${textoDias(r.dias_para_vencer, "en", "hace")}` : `Vence ${textoDias(r.dias_para_vencer, "en", "hace")}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
