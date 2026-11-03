import { useEffect, useState } from "react";
import { AlertTriangle, Trophy, TrendingUp } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { percentageLabel, percentageOf, percentageWidth } from "../../data/metrics";
import { periodoMensual } from "../../../hooks/useSellerData";

type FilaRanking = {
  vendedor_id: string;
  nombre: string;
  meta: number | null;
  ventas_pagadas: number;
};

const colores = {
  excelente: { bg: "bg-green-50", border: "border-green-200", text: "text-green-700", icon: "bg-green-500" },
  moderado: { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", icon: "bg-orange-500" },
  critico: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", icon: "bg-red-500" },
  sinMeta: { bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-600", icon: "bg-gray-400" },
};

function estado(fila: FilaRanking) {
  if (!fila.meta) return "sinMeta" as const;
  const porcentaje = percentageOf(fila.ventas_pagadas, fila.meta);
  return porcentaje >= 75 ? "excelente" as const : porcentaje >= 50 ? "moderado" as const : "critico" as const;
}

const etiquetas = { excelente: "Excelente", moderado: "Moderado", critico: "Crítico", sinMeta: "Sin meta asignada" };

export function SellerRanking({ vendedorId }: { vendedorId: string }) {
  const [filas, setFilas] = useState<FilaRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const now = new Date();
  const periodo = periodoMensual(now);

  useEffect(() => {
    let activo = true;
    (async () => {
      const { data, error: rpcError } = await supabase.rpc("ranking_vendedores", { p_periodo: periodo });
      if (!activo) return;
      if (rpcError) {
        console.error("No se pudo cargar el ranking:", rpcError);
        setError(true);
      } else {
        setFilas((data ?? []).map((f: FilaRanking) => ({ ...f, ventas_pagadas: Number(f.ventas_pagadas) })));
      }
      setLoading(false);
    })();
    return () => {
      activo = false;
    };
  }, [periodo]);

  // Primero quienes tienen meta (por % de cumplimiento), luego el resto por ventas.
  const ranking = [...filas].sort((a, b) => {
    if (!!a.meta !== !!b.meta) return a.meta ? -1 : 1;
    const pa = a.meta ? percentageOf(a.ventas_pagadas, a.meta) : a.ventas_pagadas;
    const pb = b.meta ? percentageOf(b.ventas_pagadas, b.meta) : b.ventas_pagadas;
    return pb - pa || a.nombre.localeCompare(b.nombre, "es");
  });

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6 lg:p-8">
      <div className="rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 p-6 text-white shadow-lg">
        <div className="mb-2 flex items-center gap-3">
          <Trophy className="h-8 w-8" />
          <h2 className="text-xl font-bold">Ranking de vendedores</h2>
        </div>
        <p className="text-sm text-yellow-50">
          {now.toLocaleDateString("es-CO", { month: "long", year: "numeric" })} · cumplimiento de la meta mensual
        </p>
      </div>

      {loading ? (
        <div className="rounded-xl bg-white p-6 text-center text-sm text-gray-500">Cargando ranking...</div>
      ) : error ? (
        <div className="rounded-xl bg-white p-6 text-center text-sm text-red-600">No se pudo cargar el ranking.</div>
      ) : ranking.length === 0 ? (
        <div className="rounded-xl bg-white p-6 text-center text-sm text-gray-500">Aún no hay vendedores registrados.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {ranking.map((fila, index) => {
            const st = estado(fila);
            const c = colores[st];
            const porcentaje = fila.meta ? percentageOf(fila.ventas_pagadas, fila.meta) : 0;
            const soyYo = fila.vendedor_id === vendedorId;
            return (
              <div
                key={fila.vendedor_id}
                className={`overflow-hidden rounded-xl border-2 bg-white shadow-md ${
                  soyYo ? "border-blue-500 ring-2 ring-blue-200" : "border-transparent"
                }`}
              >
                <div className={`${c.bg} border-b ${c.border} p-3`}>
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${c.icon}`}>
                      {index < 3 && fila.meta ? (
                        <Trophy className="h-5 w-5 text-white" />
                      ) : (
                        <span className="font-bold text-white">#{index + 1}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-bold text-gray-900">{fila.nombre}</p>
                        {soyYo && <span className="rounded-full bg-blue-500 px-2 py-0.5 text-xs text-white">Tú</span>}
                      </div>
                      <div className={`mt-0.5 flex items-center gap-2 text-xs font-medium ${c.text}`}>
                        {st === "excelente" ? <TrendingUp className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                        <span>{etiquetas[st]}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-gray-900">{fila.meta ? percentageLabel(porcentaje) : fila.ventas_pagadas}</p>
                      <p className="text-xs text-gray-600">
                        {fila.meta ? `${fila.ventas_pagadas}/${fila.meta}` : "ventas"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-white p-3">
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                    <div className={`h-full ${c.icon} transition-all duration-500`} style={{ width: `${percentageWidth(porcentaje)}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
