import { Card } from "./ui/card";
import type { ExcelMetrics } from "../data/mockCDAs";

export interface MonthlySnapshot {
  mes: string;
  fileName: string;
  timestamp: string;
  achieved: number;
  meta: number;
  progress: number;
  rtms?: ExcelMetrics;
  preventivas?: ExcelMetrics;
  facturacion?: ExcelMetrics;
}

interface MonthlyHistoryProps {
  snapshots: MonthlySnapshot[];
  showVendedores: boolean;
  onToggleVendedores: () => void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);

export function MonthlyHistory({ snapshots, showVendedores, onToggleVendedores }: MonthlyHistoryProps) {
  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 px-4 md:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h2 className="font-semibold text-gray-900 text-lg">Historial mensual</h2>
          <p className="text-sm text-gray-600">Revisa el desempeño por cada mes cargado desde Excel.</p>
        </div>
        <button
          onClick={onToggleVendedores}
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          {showVendedores ? "Ocultar vendedores" : "Ver vendedores"}
        </button>
      </div>

      {snapshots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-600">
          No hay datos mensuales cargados. Carga un Excel con hojas de mes para ver el histórico.
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {snapshots.map((snap) => (
            <Card key={`${snap.mes}-${snap.timestamp}`} className="p-4">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {snap.isGlobal ? "Resumen anual" : snap.mes}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {snap.isGlobal ? "Total del año" : new Date(snap.timestamp).toLocaleDateString("es-CO")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Cumplimiento</p>
                  <p className="text-xl font-bold text-gray-900">{snap.progress}%</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm text-gray-600">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide">Servicios</p>
                  <p className="mt-1 text-lg font-semibold text-gray-900">{snap.achieved}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide">Meta</p>
                  <p className="mt-1 text-lg font-semibold text-gray-900">{snap.meta}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 col-span-2">
                  <p className="text-xs uppercase tracking-wide">Facturación</p>
                  <p className="mt-1 text-lg font-semibold text-gray-900">{formatCurrency(snap.facturacion?.total ?? 0)}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-3 text-sm">
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <p className="text-xs text-gray-500">RTMs</p>
                  <p className="mt-1 font-semibold text-gray-900">{snap.rtms?.total ?? 0}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <p className="text-xs text-gray-500">Preventivas</p>
                  <p className="mt-1 font-semibold text-gray-900">{snap.preventivas?.total ?? 0}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <p className="text-xs text-gray-500">RTM moto</p>
                  <p className="mt-1 font-semibold text-gray-900">{snap.rtms?.motos ?? 0}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
