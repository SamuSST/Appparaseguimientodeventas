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

// Resumen del mes (periodo AAAA-MM) por vendedor y meta general del CDA, desde Supabase.
export function useAdminResumen(periodo: string) {
  const [vendedores, setVendedores] = useState<ResumenVendedor[]>([]);
  const [metaCda, setMetaCda] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [resumenRes, metaRes] = await Promise.all([
        supabase.rpc("resumen_vendedores", { p_periodo: periodo }),
        supabase.from("metas").select("meta").eq("tipo", "mensual").eq("periodo", periodo).is("vendedor_id", null).maybeSingle(),
      ]);
      if (resumenRes.error) throw resumenRes.error;
      if (metaRes.error) throw metaRes.error;

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
      setMetaCda(metaRes.data?.meta ?? null);
    } catch (err) {
      console.error("No se pudo cargar el resumen del administrador:", err);
      setError("No se pudo cargar el resumen. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }, [periodo]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const guardarMetaCda = useCallback(
    async (meta: number) => {
      const { error: upsertError } = await supabase
        .from("metas")
        .upsert({ tipo: "mensual", periodo, vendedor_id: null, meta }, { onConflict: "tipo,periodo,vendedor_id" });
      if (upsertError) throw upsertError;
      setMetaCda(meta);
    },
    [periodo],
  );

  return { vendedores, metaCda, loading, error, recargar: cargar, guardarMetaCda };
}
