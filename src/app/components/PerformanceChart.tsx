import { useState } from "react";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { allClients } from "../data/mockClients";
import { parseDateKey, toDateKey } from "../data/metrics";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";
import { Button } from "./ui/button";

type View = "week" | "month" | "year";
type ChartPoint = { periodo: string; actual: number; anterior: number };

const dateCounts = allClients.reduce<Record<string, number>>((counts, client) => {
  counts[client.fecha] = (counts[client.fecha] ?? 0) + 1;
  return counts;
}, {});

const yearlyCounts = allClients.reduce<Record<number, number>>((counts, client) => {
  const year = parseDateKey(client.fecha).getFullYear();
  counts[year] = (counts[year] ?? 0) + 1;
  return counts;
}, {});

const latestDateKey = allClients.reduce(
  (latest, client) => (client.fecha > latest ? client.fecha : latest),
  "",
);
const latestDate = latestDateKey ? parseDateKey(latestDateKey) : new Date();
const latestYear = latestDate.getFullYear();
const previousYear = latestYear - 1;
const latestMonth = latestDate.getMonth();

function countMonth(year: number, month: number): number {
  const prefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
  return Object.entries(dateCounts).reduce(
    (total, [date, count]) => total + (date.startsWith(prefix) ? count : 0),
    0,
  );
}

function countDate(date: Date): number {
  return dateCounts[toDateKey(date)] ?? 0;
}

const weekData: ChartPoint[] = Array.from({ length: 7 }, (_, index) => {
  const date = new Date(latestDate);
  date.setDate(latestDate.getDate() - 6 + index);
  const previousDate = new Date(date);
  previousDate.setDate(date.getDate() - 7);
  return {
    periodo: date.toLocaleDateString("es-CO", { weekday: "short" }),
    actual: countDate(date),
    anterior: countDate(previousDate),
  };
});

const monthData: ChartPoint[] = Array.from({ length: latestMonth + 1 }, (_, index) => ({
  periodo: new Date(latestYear, index, 1, 12).toLocaleDateString("es-CO", { month: "short" }),
  actual: countMonth(latestYear, index),
  anterior: countMonth(previousYear, index),
}));

const availableYears = Object.keys(yearlyCounts).map(Number).sort((a, b) => a - b);
const yearData: ChartPoint[] = availableYears.map((year) => ({
  periodo: String(year),
  actual: yearlyCounts[year] ?? 0,
  anterior: yearlyCounts[year - 1] ?? 0,
}));

const comparisonAvailableByView: Record<View, boolean> = {
  week: weekData.some((point) => point.anterior > 0),
  month: monthData.some((point) => point.anterior > 0),
  year: yearData.some((point) => point.anterior > 0),
};

export function PerformanceChart() {
  const [showComparison, setShowComparison] = useState(false);
  const [view, setView] = useState<View>("week");
  const chartData = view === "week" ? weekData : view === "month" ? monthData : yearData;
  const total = chartData.reduce((sum, point) => sum + point.actual, 0);
  const comparisonTotal = chartData.reduce((sum, point) => sum + point.anterior, 0);
  const comparisonAvailable = comparisonAvailableByView[view];
  const mainColor = view === "week" ? "#3b82f6" : view === "month" ? "#10b981" : "#8b5cf6";
  const mainLabel = view === "week"
    ? "Últimos 7 días"
    : view === "month"
      ? String(latestYear)
      : "Clientes registrados";
  const totalLabel = view === "week"
    ? "Clientes en los últimos 7 días"
    : view === "month"
      ? `Clientes registrados en ${latestYear}`
      : "Clientes registrados en el histórico disponible";
  const comparisonLabel = view === "week"
    ? "7 días anteriores"
    : String(previousYear);

  return (
    <div className="bg-white rounded-xl shadow-md p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Actividad registrada</h3>
        <div className="flex items-center gap-2">
          <Switch
            id="comparison"
            checked={showComparison && comparisonAvailable}
            onCheckedChange={setShowComparison}
            disabled={!comparisonAvailable}
          />
          <Label
            htmlFor="comparison"
            className={`text-xs ${comparisonAvailable ? "text-gray-600 cursor-pointer" : "text-gray-400"}`}
          >
            {comparisonAvailable ? "Comparar" : "Sin datos para comparar"}
          </Label>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {(["week", "month", "year"] as const).map((period) => (
          <Button
            key={period}
            variant={view === period ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setView(period);
              setShowComparison(false);
            }}
            className="flex-1 text-xs h-8"
          >
            {period === "week" ? "Semana" : period === "month" ? "Meses" : "Años"}
          </Button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="performance-current" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={mainColor} stopOpacity={0.3} />
              <stop offset="95%" stopColor={mainColor} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="performance-previous" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="periodo"
            tick={{ fontSize: view === "month" ? 10 : 11, fill: "#64748b" }}
            axisLine={{ stroke: "#e2e8f0" }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={{ stroke: "#e2e8f0" }}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={(value: number) => [`${value} clientes`, ""]}
          />
          {showComparison && comparisonAvailable && (
            <Legend wrapperStyle={{ fontSize: "11px" }} iconType="line" />
          )}
          <Area
            type="monotone"
            dataKey="actual"
            stroke={mainColor}
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#performance-current)"
            name={mainLabel}
          />
          {showComparison && comparisonAvailable && (
            <Area
              type="monotone"
              dataKey="anterior"
              stroke="#94a3b8"
              strokeWidth={2}
              strokeDasharray="5 5"
              fillOpacity={1}
              fill="url(#performance-previous)"
              name={comparisonLabel}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>

      <div className="mt-3 pt-3 border-t">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-600">{totalLabel}</span>
          <span className="text-base font-bold text-gray-900">{total}</span>
        </div>
        {showComparison && comparisonAvailable && (
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-gray-500">{comparisonLabel}</span>
            <span className="text-sm font-semibold text-gray-600">{comparisonTotal}</span>
          </div>
        )}
      </div>
    </div>
  );
}
