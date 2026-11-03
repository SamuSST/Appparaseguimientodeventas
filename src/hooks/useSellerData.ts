import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { toDateKey } from "../app/data/metrics";
import type { Client } from "../app/data/clientes";

// El vendedor no ve ingresos, por eso no se pide la columna `ingreso`.
export type Atencion = {
  id: number;
  fecha: string;
  hora: string | null;
  cliente_nombre: string | null;
  cliente_telefono: string | null;
  vehiculo: string | null;
  placa: string;
  marca: string | null;
  tipo_vehiculo: string | null;
  tipo_servicio: string | null;
  tipo_revision: "RTM" | "Preventiva" | "Reinspección";
  electrico: boolean;
  resultado: "Aprobada" | "Rechazada" | null;
  estado_reinspeccion: "Realizada" | "En plazo" | "Vencida" | null;
  fecha_limite_reinspeccion: string | null;
  carga_id: number | null;
  tiempo_atencion_min: number | null;
  pagado: boolean;
};

export type MetasVendedor = {
  mensual: number | null;
  anual: number | null;
  porMes: Record<string, number>; // "AAAA-MM" -> meta mensual
};

const COLUMNAS =
  "id, fecha, hora, cliente_nombre, cliente_telefono, vehiculo, placa, marca, tipo_vehiculo, tipo_servicio, tipo_revision, electrico, tiempo_atencion_min, resultado, estado_reinspeccion, fecha_limite_reinspeccion, carga_id, pagado";
const PAGINA = 1000; // máximo de filas que Supabase devuelve por consulta

// Las reinspecciones son gratis: no cuentan como atención ni como venta.
export const esVenta = (a: Atencion) => a.tipo_revision !== "Reinspección";

// Estado de la reinspección calculado con la fecha de hoy (el del Excel queda desactualizado con los días).
export function estadoReinspeccion(a: Atencion, todas: Atencion[], hoy: string): "Realizada" | "En plazo" | "Vencida" | null {
  if (a.tipo_revision !== "RTM" || a.resultado !== "Rechazada") return null;
  const limite = a.fecha_limite_reinspeccion;
  const volvio = todas.some(
    (r) => r.tipo_revision === "Reinspección" && r.placa === a.placa && r.fecha > a.fecha && (!limite || r.fecha <= limite),
  );
  if (volvio) return "Realizada";
  if (!limite) return a.estado_reinspeccion;
  return limite >= hoy ? "En plazo" : "Vencida";
}

export function periodoMensual(date: Date) {
  return toDateKey(date).slice(0, 7);
}

export function useSellerData(vendedorId: string | undefined) {
  const [atenciones, setAtenciones] = useState<Atencion[]>([]);
  const [metas, setMetas] = useState<MetasVendedor>({ mensual: null, anual: null, porMes: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!vendedorId) return;
    setLoading(true);
    setError(null);

    const hoy = new Date();
    const anio = String(hoy.getFullYear());
    const mes = periodoMensual(hoy);

    try {
      const metasRes = await supabase
        .from("metas")
        .select("tipo, periodo, meta")
        .eq("vendedor_id", vendedorId);
      if (metasRes.error) throw metasRes.error;

      const todas: Atencion[] = [];
      for (let inicio = 0; ; inicio += PAGINA) {
        const { data, error: pageError } = await supabase
          .from("atenciones")
          .select(COLUMNAS)
          .eq("vendedor_id", vendedorId)
          // Desde el año anterior, para que el gráfico de actividad pueda comparar mes a mes.
          .gte("fecha", `${Number(anio) - 1}-01-01`)
          .order("fecha", { ascending: false })
          .order("hora", { ascending: false, nullsFirst: false })
          .order("id", { ascending: false })
          .range(inicio, inicio + PAGINA - 1);
        if (pageError) throw pageError;
        todas.push(...((data ?? []) as Atencion[]));
        if (!data || data.length < PAGINA) break;
      }

      setAtenciones(todas);
      setMetas({
        mensual: metasRes.data?.find((m) => m.tipo === "mensual" && m.periodo === mes)?.meta ?? null,
        anual: metasRes.data?.find((m) => m.tipo === "anual" && m.periodo === anio)?.meta ?? null,
        porMes: Object.fromEntries((metasRes.data ?? []).filter((m) => m.tipo === "mensual").map((m) => [m.periodo, m.meta])),
      });
    } catch (err) {
      console.error("No se pudieron cargar los datos del vendedor:", err);
      setError("No se pudieron cargar tus datos. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }, [vendedorId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return { atenciones, metas, loading, error, recargar: cargar };
}

// Convierte las atenciones al formato que usan los gráficos originales de Figma.
// El ingreso no se incluye porque el vendedor no ve valores en pesos.
export function atencionesAClientes(atenciones: Atencion[]): Client[] {
  const placasVistas = new Set<string>();
  return [...atenciones]
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hora ?? "").localeCompare(b.hora ?? ""))
    .map((a) => {
      const esRecurrente = placasVistas.has(a.placa);
      placasVistas.add(a.placa);
      return {
        id: a.id,
        nombre: a.cliente_nombre || "Cliente sin nombre",
        vehiculo: [a.marca, a.vehiculo].filter(Boolean).join(" ") || "Vehículo",
        placa: a.placa,
        tipoVehiculo: a.tipo_vehiculo === "moto" || a.tipo_vehiculo === "pesado" ? a.tipo_vehiculo : "carro",
        tipoServicio: a.tipo_servicio === "publico" ? "publico" : "particular",
        fecha: a.fecha,
        hora: a.hora?.slice(0, 5),
        marca: a.marca ?? undefined,
        esRecurrente,
        tiempoAtencion: a.tiempo_atencion_min ?? undefined,
      };
    });
}
