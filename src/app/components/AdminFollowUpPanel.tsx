import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CalendarClock, Download, RefreshCw, Wallet } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { supabase } from "../../lib/supabase";
import { parseDateKey } from "../data/metrics";
import { Card } from "./ui/card";
import { ContactButtons } from "./ContactButtons";
import { formatearTelefono, mensajeSeguimiento } from "../../lib/telefono";

export type Reinspeccion = {
  atencion_id: number;
  vendedor_id: string | null;
  vendedor: string | null;
  vendedor_telefono: string | null;
  fecha: string;
  placa: string;
  cliente_nombre: string | null;
  cliente_telefono: string | null;
  marca: string | null;
  vehiculo: string | null;
  tipo_vehiculo: string | null;
  fecha_limite: string;
  dias_restantes: number;
  estado: "En plazo" | "Vencida";
};

export type Renovacion = {
  atencion_id: number;
  vendedor_id: string | null;
  vendedor: string | null;
  vendedor_telefono: string | null;
  ultima_rtm: string;
  vence: string;
  dias_para_vencer: number;
  placa: string;
  cliente_nombre: string | null;
  cliente_telefono: string | null;
  marca: string | null;
  vehiculo: string | null;
  tipo_vehiculo: string | null;
  tipo_servicio: string | null;
};

type Pendiente = {
  id: number;
  fecha: string;
  placa: string;
  cliente_nombre: string | null;
  tipo_revision: string;
  ingreso: number | null;
  vendedor_id: string | null;
};

type Pestana = "reinspecciones" | "renovaciones" | "pagos";

export const fechaCorta = (fecha: string) =>
  parseDateKey(fecha).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });

export function textoDias(dias: number, futuro: string, pasado: string) {
  if (dias === 0) return "hoy";
  return dias > 0 ? `${futuro} ${dias} ${dias === 1 ? "día" : "días"}` : `${pasado} ${-dias} ${dias === -1 ? "día" : "días"}`;
}

function exportar(nombre: string, filas: Record<string, unknown>[]) {
  if (filas.length === 0) {
    toast.error("No hay datos para exportar.");
    return;
  }
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(filas), "Datos");
  XLSX.writeFile(libro, `${nombre}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// Pendientes del CDA: reinspecciones que pueden volver gratis, RTM por renovar y ventas sin pagar.
export function AdminFollowUpPanel() {
  const [pestana, setPestana] = useState<Pestana>("reinspecciones");
  const [reinspecciones, setReinspecciones] = useState<Reinspeccion[]>([]);
  const [renovaciones, setRenovaciones] = useState<Renovacion[]>([]);
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [nombres, setNombres] = useState<Map<string, string>>(new Map());
  const [verVencidas, setVerVencidas] = useState(false);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const desde = new Date();
      desde.setDate(desde.getDate() - 90);
      const [reinsRes, renovRes, pagosRes, usuariosRes] = await Promise.all([
        supabase.rpc("reinspecciones_pendientes", { p_dias: 60 }),
        supabase.rpc("renovaciones_proximas", { p_dias_antes: 45, p_dias_despues: 30 }),
        supabase
          .from("atenciones")
          .select("id, fecha, placa, cliente_nombre, tipo_revision, ingreso, vendedor_id")
          .eq("pagado", false)
          .neq("tipo_revision", "Reinspección")
          .gte("fecha", desde.toISOString().slice(0, 10))
          .order("fecha", { ascending: false })
          .limit(500),
        supabase.from("usuarios").select("id, nombre"),
      ]);
      if (reinsRes.error) throw reinsRes.error;
      if (renovRes.error) throw renovRes.error;
      if (pagosRes.error) throw pagosRes.error;
      setReinspecciones((reinsRes.data ?? []) as Reinspeccion[]);
      setRenovaciones((renovRes.data ?? []) as Renovacion[]);
      setPendientes((pagosRes.data ?? []) as Pendiente[]);
      setNombres(new Map((usuariosRes.data ?? []).map((u) => [u.id, u.nombre])));
    } catch (error) {
      console.error("No se pudo cargar el seguimiento:", error);
      toast.error("No se pudo cargar el seguimiento.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const reinsVisibles = verVencidas ? reinspecciones : reinspecciones.filter((r) => r.estado === "En plazo");
  const enPlazo = reinspecciones.filter((r) => r.estado === "En plazo").length;
  const totalPendiente = pendientes.reduce((s, p) => s + Number(p.ingreso ?? 0), 0);

  const pestanas: { id: Pestana; label: string; n: number; icon: typeof AlertTriangle }[] = [
    { id: "reinspecciones", label: "Reinspecciones", n: enPlazo, icon: AlertTriangle },
    { id: "renovaciones", label: "Por renovar", n: renovaciones.length, icon: CalendarClock },
    { id: "pagos", label: "Pagos pendientes", n: pendientes.length, icon: Wallet },
  ];

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Seguimiento</h2>
            <p className="mt-1 text-sm text-gray-500">Clientes a los que conviene llamar hoy.</p>
          </div>
          <button
            type="button"
            onClick={() => void cargar()}
            className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-50"
            aria-label="Actualizar seguimiento"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {pestanas.map(({ id, label, n, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setPestana(id)}
              className={`flex items-center justify-between gap-2 rounded-xl border p-3 text-left transition-colors ${
                pestana === id ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-medium text-gray-900">
                <Icon className="h-4 w-4 text-blue-600" /> {label}
              </span>
              <span className="text-xl font-bold text-gray-900">{loading ? "…" : n}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        {loading ? (
          <p className="py-6 text-center text-sm text-gray-500">Cargando...</p>
        ) : pestana === "reinspecciones" ? (
          <>
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-gray-600">RTM rechazadas que todavía no han vuelto a su reinspección gratis (15 días).</p>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input type="checkbox" checked={verVencidas} onChange={(e) => setVerVencidas(e.target.checked)} /> Ver vencidas
                </label>
                <button
                  type="button"
                  onClick={() =>
                    exportar(
                      "reinspecciones",
                      reinsVisibles.map((r) => ({
                        Vendedor: r.vendedor ?? "",
                        Cliente: r.cliente_nombre ?? "",
                        "Celular cliente": formatearTelefono(r.cliente_telefono),
                        "Celular vendedor": formatearTelefono(r.vendedor_telefono),
                        Placa: r.placa,
                        Vehículo: [r.marca, r.vehiculo].filter(Boolean).join(" "),
                        "Fecha RTM": r.fecha,
                        "Fecha límite": r.fecha_limite,
                        "Días restantes": r.dias_restantes,
                        Estado: r.estado,
                      })),
                    )
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Download className="h-3.5 w-3.5" /> Excel
                </button>
              </div>
            </div>
            <Tabla
              vacio="No hay reinspecciones pendientes."
              columnas={["Cliente", "Contacto", "Placa", "Vendedor", "Rechazada", "Plazo"]}
              filas={reinsVisibles.map((r) => ({
                key: r.atencion_id,
                rojo: r.estado === "Vencida",
                celdas: [
                  r.cliente_nombre ?? "—",
                  <ContactButtons
                    key="c"
                    telefono={r.cliente_telefono}
                    mensaje={mensajeSeguimiento({
                      tipo: "reinspeccion",
                      cliente: r.cliente_nombre,
                      placa: r.placa,
                      fecha: fechaCorta(r.fecha_limite),
                      vendedor: r.vendedor,
                      vendedorTelefono: r.vendedor_telefono,
                    })}
                  />,
                  r.placa,
                  <Vendedor key="v" nombre={r.vendedor} telefono={r.vendedor_telefono} />,
                  fechaCorta(r.fecha),
                  r.estado === "Vencida" ? `Venció ${fechaCorta(r.fecha_limite)}` : `Vence ${textoDias(r.dias_restantes, "en", "hace")}`,
                ],
              }))}
            />
          </>
        ) : pestana === "renovaciones" ? (
          <>
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-gray-600">Vehículos cuya RTM vence en los próximos 45 días o venció hace menos de 30.</p>
              <button
                type="button"
                onClick={() =>
                  exportar(
                    "renovaciones",
                    renovaciones.map((r) => ({
                      Vendedor: r.vendedor ?? "",
                      Cliente: r.cliente_nombre ?? "",
                      "Celular cliente": formatearTelefono(r.cliente_telefono),
                      "Celular vendedor": formatearTelefono(r.vendedor_telefono),
                      Placa: r.placa,
                      Vehículo: [r.marca, r.vehiculo].filter(Boolean).join(" "),
                      "Última RTM": r.ultima_rtm,
                      Vence: r.vence,
                      "Días para vencer": r.dias_para_vencer,
                    })),
                  )
                }
                className="inline-flex items-center gap-1 self-start rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <Download className="h-3.5 w-3.5" /> Excel
              </button>
            </div>
            <Tabla
              vacio="No hay vehículos por renovar en este periodo. Si aún no cargaste los datos de 2025, súbelos para ver las renovaciones."
              columnas={["Cliente", "Contacto", "Placa", "Vendedor", "Última RTM", "Vence"]}
              filas={renovaciones.map((r) => ({
                key: r.atencion_id,
                rojo: r.dias_para_vencer < 0,
                celdas: [
                  r.cliente_nombre ?? "—",
                  <ContactButtons
                    key="c"
                    telefono={r.cliente_telefono}
                    mensaje={mensajeSeguimiento({
                      tipo: "renovacion",
                      cliente: r.cliente_nombre,
                      placa: r.placa,
                      fecha: fechaCorta(r.vence),
                      vendedor: r.vendedor,
                      vendedorTelefono: r.vendedor_telefono,
                    })}
                  />,
                  r.placa,
                  <Vendedor key="v" nombre={r.vendedor} telefono={r.vendedor_telefono} />,
                  fechaCorta(r.ultima_rtm),
                  `${fechaCorta(r.vence)} (${textoDias(r.dias_para_vencer, "en", "hace")})`,
                ],
              }))}
            />
          </>
        ) : (
          <>
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-gray-600">
                Atenciones sin pagar de los últimos 90 días · total{" "}
                <strong>${Math.round(totalPendiente).toLocaleString("es-CO")}</strong>
              </p>
              <button
                type="button"
                onClick={() =>
                  exportar(
                    "pagos_pendientes",
                    pendientes.map((p) => ({
                      Vendedor: (p.vendedor_id && nombres.get(p.vendedor_id)) ?? "",
                      Cliente: p.cliente_nombre ?? "",
                      Placa: p.placa,
                      Revisión: p.tipo_revision,
                      Fecha: p.fecha,
                      Valor: Number(p.ingreso ?? 0),
                    })),
                  )
                }
                className="inline-flex items-center gap-1 self-start rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <Download className="h-3.5 w-3.5" /> Excel
              </button>
            </div>
            <Tabla
              vacio="No hay pagos pendientes."
              columnas={["Cliente", "Placa", "Vendedor", "Fecha", "Valor"]}
              filas={pendientes.map((p) => ({
                key: p.id,
                celdas: [
                  p.cliente_nombre ?? "—",
                  `${p.placa} · ${p.tipo_revision}`,
                  (p.vendedor_id && nombres.get(p.vendedor_id)) ?? "—",
                  fechaCorta(p.fecha),
                  `$${Math.round(Number(p.ingreso ?? 0)).toLocaleString("es-CO")}`,
                ],
              }))}
            />
          </>
        )}
      </Card>
    </div>
  );
}

function Vendedor({ nombre, telefono }: { nombre: string | null; telefono: string | null }) {
  return (
    <div>
      <p>{nombre ?? "—"}</p>
      {telefono && (
        <a href={`tel:+57${telefono}`} className="font-mono text-xs text-blue-700 hover:underline">
          {formatearTelefono(telefono)}
        </a>
      )}
    </div>
  );
}

function Tabla({
  columnas,
  filas,
  vacio,
}: {
  columnas: string[];
  filas: { key: number; rojo?: boolean; celdas: React.ReactNode[] }[];
  vacio: string;
}) {
  if (filas.length === 0) return <p className="py-6 text-center text-sm text-gray-500">{vacio}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase text-gray-500">
            {columnas.map((c) => (
              <th key={c} className="py-2 pr-3 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {filas.map((f) => (
            <tr key={f.key} className={f.rojo ? "bg-red-50" : undefined}>
              {f.celdas.map((c, i) => (
                <td key={i} className={`py-2.5 pr-3 ${i === 0 ? "font-medium text-gray-900" : "text-gray-700"}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
