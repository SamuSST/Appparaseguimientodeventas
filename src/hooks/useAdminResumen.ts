import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export type ResumenVendedor = {
  vendedor_id: string;
  nombre: string;
  activo: boolean;
  meta: number | null;
  atenciones: number;
  ventas_pagadas: number;
  ingresos: number;
  rtm: number;
  preventivas: number;
  rechazadas: number;
  reinspecciones: number;
};

// Resumen del mes (periodo AAAA-MM) por vendedor y metas del CDA (del mes y del año), desde Supabase.
export function useAdminResumen(periodo: string) {
  const anio = periodo.slice(0, 4);
  const [vendedores, setVendedores] = useState<ResumenVendedor[]>([]);
  const [metaCda, setMetaCda] = useState<number | null>(null);
  const [metaAnualCda, setMetaAnualCda] = useState<number | null>(null);
  const [ventasAnio, setVentasAnio] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [resumenRes, metasRes, anioRes] = await Promise.all([
        supabase.rpc("resumen_vendedores", { p_periodo: periodo }),
        supabase.from("metas").select("tipo, periodo, meta").is("vendedor_id", null).in("periodo", [periodo, anio]),
        supabase
          .from("atenciones")
          .select("id", { count: "exact", head: true })
          .gte("fecha", `${anio}-01-01`)
          .lte("fecha", `${anio}-12-31`)
          .eq("pagado", true)
          .neq("tipo_revision", "Reinspección"),
      ]);
      if (resumenRes.error) throw resumenRes.error;
      if (metasRes.error) throw metasRes.error;
      if (anioRes.error) throw anioRes.error;

      // count() y sum() llegan como texto o número según el tipo; se normalizan a número.
      setVendedores(
        ((resumenRes.data ?? []) as ResumenVendedor[])
          .map((v) => ({
            ...v,
            atenciones: Number(v.atenciones),
            ventas_pagadas: Number(v.ventas_pagadas),
            ingresos: Number(v.ingresos),
            rtm: Number(v.rtm),
            preventivas: Number(v.preventivas),
            rechazadas: Number(v.rechazadas),
            reinspecciones: Number(v.reinspecciones),
          }))
          .sort((a, b) => b.ventas_pagadas - a.ventas_pagadas || a.nombre.localeCompare(b.nombre, "es")),
      );
      setMetaCda(metasRes.data?.find((m) => m.tipo === "mensual" && m.periodo === periodo)?.meta ?? null);
      setMetaAnualCda(metasRes.data?.find((m) => m.tipo === "anual" && m.periodo === anio)?.meta ?? null);
      setVentasAnio(anioRes.count ?? 0);
    } catch (err) {
      console.error("No se pudo cargar el resumen del administrador:", err);
      setError("No se pudo cargar el resumen. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }, [periodo, anio]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const guardarMetaCda = useCallback(
    async (meta: number, tipo: "mensual" | "anual" = "mensual") => {
      const { error: upsertError } = await supabase
        .from("metas")
        .upsert(
          { tipo, periodo: tipo === "mensual" ? periodo : anio, vendedor_id: null, meta },
          { onConflict: "tipo,periodo,vendedor_id" },
        );
      if (upsertError) throw upsertError;
      if (tipo === "mensual") setMetaCda(meta);
      else setMetaAnualCda(meta);
    },
    [periodo, anio],
  );

  return { vendedores, metaCda, metaAnualCda, ventasAnio, loading, error, recargar: cargar, guardarMetaCda };
}
