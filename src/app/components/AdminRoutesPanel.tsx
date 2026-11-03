import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Download, MapPin, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { supabase } from "../../lib/supabase";
import { parseDateKey, toDateKey } from "../data/metrics";
import { Card } from "./ui/card";

type Vendedor = { id: string; nombre: string };

type Visita = {
  vendedor_id: string;
  fecha: string;
  hora: string;
  direccion: string | null;
  lat: number | null;
  lng: number | null;
  notas: string | null;
  foto_url: string | null;
};

const MAX_DIAS = 92;
const PAGINA_DB = 1000;

function diasEntre(desde: string, hasta: string) {
  return Math.round((parseDateKey(hasta).getTime() - parseDateKey(desde).getTime()) / 86_400_000) + 1;
}

function formatoFecha(fecha: string) {
  return parseDateKey(fecha).toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" });
}

export function AdminRoutesPanel() {
  const hoy = toDateKey(new Date());
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState(hoy);
  const [horaLimite, setHoraLimite] = useState("10:00");
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [loading, setLoading] = useState(true);

  const rangoValido = desde <= hasta && diasEntre(desde, hasta) <= MAX_DIAS;

  const cargar = useCallback(async () => {
    if (!rangoValido) return;
    setLoading(true);
    try {
      const usuariosRes = await supabase
        .from("usuarios")
        .select("id, nombre")
        .eq("rol", "vendedor")
        .eq("activo", true)
        .order("nombre");
      if (usuariosRes.error) throw usuariosRes.error;

      // Supabase devuelve hasta 1000 filas por consulta; se pide por páginas.
      const todas: Visita[] = [];
      for (let inicio = 0; ; inicio += PAGINA_DB) {
        const { data, error } = await supabase
          .from("visitas")
          .select("vendedor_id, fecha, hora, direccion, lat, lng, notas, foto_url")
          .gte("fecha", desde)
          .lte("fecha", hasta)
          .order("fecha")
          .order("hora")
          .range(inicio, inicio + PAGINA_DB - 1);
        if (error) throw error;
        todas.push(...(data ?? []));
        if (!data || data.length < PAGINA_DB) break;
      }

      setVendedores(usuariosRes.data ?? []);
      setVisitas(todas);
    } catch (error) {
      console.error("No se pudieron cargar los recorridos:", error);
      toast.error("No se pudieron cargar los recorridos.");
    } finally {
      setLoading(false);
    }
  }, [desde, hasta, rangoValido]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const nombres = useMemo(() => new Map(vendedores.map((v) => [v.id, v.nombre])), [vendedores]);
  const unDia = desde === hasta;
  const incluyeHoy = desde <= hoy && hoy <= hasta;
  const ahora = new Date().toTimeString().slice(0, 5);
  const pasoHoraLimite = ahora >= horaLimite;

  const resumen = vendedores
    .map((v) => {
      const propias = visitas.filter((x) => x.vendedor_id === v.id);
      const deHoy = propias.filter((x) => x.fecha === hoy);
      const dias = new Set(propias.map((x) => x.fecha)).size;
      const sinVisitas = propias.length === 0;
      const alerta = incluyeHoy ? deHoy.length === 0 && pasoHoraLimite : sinVisitas;
      return {
        ...v,
        total: propias.length,
        dias,
        primera: propias[0],
        ultima: propias[propias.length - 1],
        alerta,
      };
    })
    .sort((a, b) => Number(b.alerta) - Number(a.alerta) || b.total - a.total || a.nombre.localeCompare(b.nombre, "es"));

  const porDia = unDia
    ? []
    : Array.from({ length: diasEntre(desde, hasta) }, (_, i) => {
        const fecha = new Date(parseDateKey(desde));
        fecha.setDate(fecha.getDate() + i);
        const clave = toDateKey(fecha);
        return { fecha: clave, total: visitas.filter((x) => x.fecha === clave).length };
      });
  const maxDia = Math.max(1, ...porDia.map((d) => d.total));
  const alertas = resumen.filter((r) => r.alerta).length;

  const exportar = () => {
    if (visitas.length === 0) {
      toast.error("No hay visitas para exportar en ese rango.");
      return;
    }
    const filas = visitas.map((x) => ({
      Vendedor: nombres.get(x.vendedor_id) ?? "Vendedor inactivo",
      Fecha: x.fecha,
      Hora: x.hora.slice(0, 5),
      Dirección: x.direccion ?? "",
      Latitud: x.lat ?? "",
      Longitud: x.lng ?? "",
      "Google Maps": x.lat !== null && x.lng !== null ? `https://www.google.com/maps?q=${x.lat},${x.lng}` : "",
      Notas: x.notas ?? "",
      Foto: x.foto_url ? "Sí" : "No",
    }));
    const hoja = XLSX.utils.json_to_sheet(filas);
    hoja["!cols"] = [{ wch: 28 }, { wch: 12 }, { wch: 8 }, { wch: 45 }, { wch: 11 }, { wch: 11 }, { wch: 45 }, { wch: 40 }, { wch: 6 }];
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Visitas");
    XLSX.writeFile(libro, unDia ? `recorridos_${desde}.xlsx` : `recorridos_${desde}_a_${hasta}.xlsx`);
  };

  const inputClass =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200";

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-green-100 p-3 text-green-700">
            <MapPin className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Recorridos de vendedores</h2>
            <p className="mt-1 text-sm text-gray-500">Visitas registradas por cada vendedor en el rango elegido.</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto_auto] sm:items-end">
          <label className="text-xs text-gray-600">
            Desde
            <input type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} className={`mt-1 ${inputClass}`} />
          </label>
          <label className="text-xs text-gray-600">
            Hasta
            <input type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} className={`mt-1 ${inputClass}`} />
          </label>
          <label className="text-xs text-gray-600">
            Alerta si hoy no hay visitas a las
            <input type="time" value={horaLimite} onChange={(e) => setHoraLimite(e.target.value || "10:00")} className={`mt-1 ${inputClass}`} />
          </label>
          <button
            type="button"
            onClick={() => void cargar()}
            className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" /> Actualizar
          </button>
          <button
            type="button"
            onClick={exportar}
            disabled={loading || !rangoValido}
            className="flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
          >
            <Download className="h-4 w-4" /> Exportar Excel
          </button>
        </div>
        {!rangoValido && (
          <p className="text-sm text-red-600">
            Elige un rango válido de máximo {MAX_DIAS} días ("Desde" no puede ser después de "Hasta").
          </p>
        )}
      </Card>

      {rangoValido && (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="p-5">
              <p className="text-sm text-gray-500">Visitas en el rango</p>
              <p className="text-2xl font-bold text-gray-900">{loading ? "…" : visitas.length}</p>
            </Card>
            <Card className="p-5">
              <p className="text-sm text-gray-500">Vendedores con visitas</p>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? "…" : `${resumen.filter((r) => r.total > 0).length} de ${vendedores.length}`}
              </p>
            </Card>
            <Card className={`p-5 ${alertas ? "border-red-200 bg-red-50" : ""}`}>
              <p className={`text-sm ${alertas ? "text-red-700" : "text-gray-500"}`}>
                {incluyeHoy ? `Sin visitas hoy después de las ${horaLimite}` : "Sin visitas en el rango"}
              </p>
              <p className={`text-2xl font-bold ${alertas ? "text-red-700" : "text-gray-900"}`}>{loading ? "…" : alertas}</p>
            </Card>
          </section>

          <Card className="p-5">
            <h3 className="mb-4 font-semibold text-gray-900">Resumen por vendedor</h3>
            {loading ? (
              <p className="py-6 text-center text-sm text-gray-500">Cargando recorridos...</p>
            ) : resumen.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-500">No hay vendedores activos.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-gray-500">
                      <th className="py-2 pr-3 font-medium">Vendedor</th>
                      <th className="py-2 pr-3 text-right font-medium">Visitas</th>
                      {!unDia && <th className="py-2 pr-3 text-right font-medium">Días activos</th>}
                      <th className="py-2 pr-3 font-medium">Primera</th>
                      <th className="py-2 pr-3 font-medium">Última</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {resumen.map((r) => (
                      <tr key={r.id} className={r.alerta ? "bg-red-50" : undefined}>
                        <td className="py-3 pr-3">
                          <p className="font-medium text-gray-900">{r.nombre}</p>
                          {r.alerta && (
                            <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-red-700">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              {incluyeHoy ? "Sin visitas hoy" : "Sin visitas en el rango"}
                            </p>
                          )}
                        </td>
                        <td className="py-3 pr-3 text-right font-bold text-gray-900">{r.total}</td>
                        {!unDia && <td className="py-3 pr-3 text-right text-gray-700">{r.dias}</td>}
                        <td className="py-3 pr-3 text-gray-700">
                          {r.primera ? `${unDia ? "" : `${formatoFecha(r.primera.fecha)} · `}${r.primera.hora.slice(0, 5)}` : "—"}
                        </td>
                        <td className="py-3 pr-3 text-gray-700">
                          {r.ultima ? (
                            <>
                              {unDia ? "" : `${formatoFecha(r.ultima.fecha)} · `}
                              {r.ultima.hora.slice(0, 5)}
                              {r.ultima.direccion && <p className="max-w-[16rem] truncate text-xs text-gray-500">{r.ultima.direccion}</p>}
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {!unDia && !loading && (
            <Card className="p-5">
              <h3 className="mb-4 font-semibold text-gray-900">Visitas por día</h3>
              <div className="space-y-2">
                {porDia.map((d) => (
                  <div key={d.fecha} className="flex items-center gap-3 text-sm">
                    <span className="w-28 shrink-0 text-gray-600">{formatoFecha(d.fecha)}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full bg-green-500" style={{ width: `${(d.total / maxDia) * 100}%` }} />
                    </div>
                    <span className="w-8 text-right font-semibold text-gray-900">{d.total}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
