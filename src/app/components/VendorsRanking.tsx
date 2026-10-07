import { Trophy, TrendingUp, AlertTriangle } from "lucide-react";
import type { Vendedor } from "../data/mockCDAs";
import { percentageLabel, percentageWidth } from "../data/metrics";

interface VendorsRankingProps {
  vendedores: Vendedor[];
  currentVendorId: number;
  period: string;
}

type Status = "excelente" | "moderado" | "critico";

const getStatus = (percentage: number): Status =>
  percentage >= 75 ? "excelente" : percentage >= 50 ? "moderado" : "critico";

const getStatusColor = (status: Status) => {
  switch (status) {
    case "excelente":
      return {
        bg: "bg-green-50",
        border: "border-green-200",
        text: "text-green-700",
        icon: "bg-green-500",
        progress: "bg-green-500",
      };
    case "moderado":
      return {
        bg: "bg-orange-50",
        border: "border-orange-200",
        text: "text-orange-700",
        icon: "bg-orange-500",
        progress: "bg-orange-500",
      };
    case "critico":
      return {
        bg: "bg-red-50",
        border: "border-red-200",
        text: "text-red-700",
        icon: "bg-red-500",
        progress: "bg-red-500",
      };
  }
};

export function VendorsRanking({ vendedores, currentVendorId, period }: VendorsRankingProps) {
  const ranking = [...vendedores].sort(
    (a, b) => b.desempeñoMensual - a.desempeñoMensual || a.nombre.localeCompare(b.nombre, "es"),
  );

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4 max-w-7xl mx-auto pb-8 md:pb-4">
      <div className="bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <Trophy className="w-8 h-8" />
          <h2 className="text-xl font-bold">Ranking de Vendedores</h2>
        </div>
        <p className="text-sm text-yellow-50">{period} - cumplimiento de meta mensual</p>
      </div>

      {ranking.length === 0 ? (
        <div className="bg-white rounded-xl p-6 text-center text-sm text-gray-500">
          No hay vendedores disponibles para este CDA.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ranking.map((vendedor, index) => {
            const percentage = vendedor.desempeñoMensual;
            const status = getStatus(percentage);
            const colors = getStatusColor(status);
            const isCurrentUser = vendedor.id === currentVendorId;

            return (
              <div
                key={vendedor.id}
                className={`bg-white rounded-xl shadow-md overflow-hidden border-2 ${
                  isCurrentUser ? "border-blue-500 ring-2 ring-blue-200" : "border-transparent"
                }`}
              >
                <div className={`${colors.bg} border-b ${colors.border} p-3`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${colors.icon} flex items-center justify-center`}>
                      {index < 3 ? (
                        <Trophy className="w-5 h-5 text-white" />
                      ) : (
                        <span className="text-white font-bold">#{index + 1}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-gray-900 truncate">{vendedor.nombre}</p>
                        {isCurrentUser && (
                          <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">Tú</span>
                        )}
                      </div>
                      <div className={`flex items-center gap-2 mt-0.5 text-xs font-medium ${colors.text}`}>
                        {status === "excelente" ? (
                          <TrendingUp className="w-3.5 h-3.5" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {status === "excelente" ? "Excelente" : status === "moderado" ? "Moderado" : "Crítico"}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-gray-900">{percentageLabel(percentage)}</p>
                      <p className="text-xs text-gray-600">
                        {Math.round((vendedor.metaMensual * percentage) / 100)}/{vendedor.metaMensual}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-3 bg-white">
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${colors.progress} transition-all duration-500`}
                      style={{ width: `${percentageWidth(percentage)}%` }}
                    />
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
