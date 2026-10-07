import { Card } from "./ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Award } from "lucide-react";
import { allClients } from "../data/mockClients";
import { roundedShares } from "../data/metrics";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export function TopBrandsChart() {
  // Contar vehículos por marca
  const brandCounts = allClients.reduce((acc, client) => {
    if (!client.marca) return acc;
    
    acc[client.marca] = (acc[client.marca] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sortedBrands = Object.entries(brandCounts)
    .sort((a, b) => b[1] - a[1]);
  const topBrands = sortedBrands.slice(0, 5);
  const otherBrandsCount = sortedBrands.slice(5).reduce((sum, [, count]) => sum + count, 0);

  const chartData = [
    ...topBrands.map(([name, value]) => ({
      name,
      value,
    })),
    ...(otherBrandsCount > 0 ? [{ name: "Otras", value: otherBrandsCount }] : []),
  ];
  const shares = roundedShares(chartData.map((entry) => entry.value));
  const chartDataWithShares = chartData.map((entry, index) => ({
    ...entry,
    share: shares[index],
  }));

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <Award className="w-5 h-5 text-purple-600" />
        <h3 className="font-semibold text-gray-900">Marcas Más Atendidas</h3>
      </div>
      
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={chartDataWithShares}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, payload }) => `${name} ${Math.round(payload.share)}%`}
            outerRadius={70}
            fill="#8884d8"
            dataKey="value"
          >
            {chartDataWithShares.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ 
              backgroundColor: "#fff", 
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              fontSize: "12px"
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      
      <div className="mt-2 space-y-1">
        {sortedBrands.slice(0, 3).map(([brand, count], idx) => (
          <div key={brand} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: COLORS[idx] }}
              />
              <span className="text-gray-700">{brand}</span>
            </div>
            <span className="font-semibold text-gray-900">{count}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
