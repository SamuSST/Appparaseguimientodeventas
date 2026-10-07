import { Card } from "./ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp } from "lucide-react";
import { allClients } from "../data/mockClients";
import { parseDateKey, toDateKey } from "../data/metrics";

export function DailyTrendChart() {
  const dailyData = allClients.reduce((acc, client) => {
    acc[client.fecha] = (acc[client.fecha] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const latestDateKey = allClients.reduce(
    (latest, client) => (client.fecha > latest ? client.fecha : latest),
    "",
  );
  const latestDate = latestDateKey ? parseDateKey(latestDateKey) : new Date();
  const chartData = Array.from({ length: 10 }, (_, index) => {
    const date = new Date(latestDate);
    date.setDate(latestDate.getDate() - 9 + index);
    const dateKey = toDateKey(date);
    return {
      fecha: date.toLocaleDateString("es-CO", { day: "numeric", month: "short" }),
      clientes: dailyData[dateKey] ?? 0,
    };
  });

  const recentDays = chartData.slice(-3);
  const previousDays = chartData.slice(-6, -3);
  const average = (values: typeof chartData) =>
    values.length ? values.reduce((sum, item) => sum + item.clientes, 0) / values.length : 0;
  const recentAverage = average(recentDays);
  const previousAverage = average(previousDays);
  const change = previousAverage
    ? Math.round(((recentAverage - previousAverage) / previousAverage) * 100)
    : null;
  const trend = change === null || change >= 0 ? "positiva" : "negativa";
  const trendLabel = change === null
    ? "Sin comparación"
    : `${change >= 0 ? "+" : "-"}${Math.abs(change)}%`;
  const promedio = chartData.length
    ? chartData.reduce((sum, item) => sum + item.clientes, 0) / chartData.length
    : 0;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-600" />
          <h3 className="font-semibold text-gray-900">Tendencia Diaria</h3>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Últimos 3 días</p>
          <p className={`text-sm font-bold ${trend === "positiva" ? "text-emerald-600" : "text-red-600"}`}>
            {trendLabel}
          </p>
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="fecha" 
            tick={{ fontSize: 11 }}
            stroke="#6b7280"
          />
          <YAxis 
            allowDecimals={false}
            tick={{ fontSize: 11 }}
            stroke="#6b7280"
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: "#fff", 
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              fontSize: "12px"
            }}
            formatter={(value: number) => [`${value} clientes`, ""]}
          />
          <Line 
            type="monotone" 
            dataKey="clientes" 
            stroke="#10b981" 
            strokeWidth={3}
            dot={{ fill: "#10b981", r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
      
      <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100">
        <p className="text-xs text-gray-500">Promedio: {promedio.toFixed(1)} clientes/día</p>
        <p className="text-xs text-gray-500">10 días calendario</p>
      </div>
    </Card>
  );
}
