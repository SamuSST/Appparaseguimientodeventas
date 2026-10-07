import { Card } from "./ui/card";
import { ChevronRight, Mail, Phone, Target, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router";
import type { CDA } from "../data/mockCDAs";
import { percentageLabel, percentageWidth } from "../data/metrics";

interface VendorListPanelProps {
  cda: CDA;
  duplicateVendorNames: { name: string; count: number }[];
}

const getStatusColor = (desempeño: number) => {
  if (desempeño >= 75) return "bg-green-500";
  if (desempeño >= 50) return "bg-orange-500";
  return "bg-red-500";
};

const getAvatarColor = (id: number) => {
  const colors = [
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-indigo-500",
    "bg-yellow-500",
  ];
  return colors[id % colors.length];
};

const getInitials = (nombre: string) => {
  const parts = nombre.split(" ");
  return parts.length >= 2
    ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    : nombre.substring(0, 2).toUpperCase();
};

export function VendorListPanel({ cda, duplicateVendorNames }: VendorListPanelProps) {
  const navigate = useNavigate();

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 px-4 md:px-6 lg:px-8">
      <h2 className="font-semibold text-gray-900 text-lg mb-4">Vendedores</h2>

      {duplicateVendorNames.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">Nombres duplicados detectados:</p>
          <ul className="list-disc list-inside mt-2">
            {duplicateVendorNames.map((item) => (
              <li key={item.name}>
                {item.name} ({item.count} veces)
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cda.vendedores
          .slice()
          .sort((a, b) => b.desempeñoMensual - a.desempeñoMensual)
          .map((vendedor, index) => (
            <Card
              key={vendedor.id}
              className="p-4 cursor-pointer hover:shadow-lg transition-all active:scale-98"
              onClick={() => navigate(`/cda/${cda.id}/vendedor/${vendedor.id}`)}
            >
              <div className="flex items-start gap-3 mb-3">
                <div
                  className={`w-12 h-12 rounded-full ${getAvatarColor(vendedor.id)} flex items-center justify-center text-white font-bold shrink-0`}
                >
                  {getInitials(vendedor.nombre)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <h3 className="font-bold text-gray-900">{vendedor.nombre}</h3>
                      {index === 0 && (
                        <span className="inline-block bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded mt-1">
                          🏆 Top Vendedor
                        </span>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                  </div>

                  <div className="space-y-1 text-xs text-gray-600 mb-2">
                    <div className="flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      <span className="truncate">{vendedor.email}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      <span>{vendedor.telefono}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-blue-50 rounded-lg p-2">
                  <div className="flex items-center gap-1 mb-1">
                    <Target className="w-3 h-3 text-blue-600" />
                    <p className="text-xs text-gray-600">Meta Mensual</p>
                  </div>
                  <p className="text-lg font-bold text-gray-900">{vendedor.metaMensual}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-2">
                  <div className="flex items-center gap-1 mb-1">
                    <TrendingUp className="w-3 h-3 text-green-600" />
                    <p className="text-xs text-gray-600">Desempeño</p>
                  </div>
                  <p className="text-lg font-bold text-gray-900">{percentageLabel(vendedor.desempeñoMensual)}</p>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">Progreso del mes</span>
                  <span className="font-semibold text-gray-900">
                    {Math.round((vendedor.metaMensual * vendedor.desempeñoMensual) / 100)}/{vendedor.metaMensual}
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getStatusColor(vendedor.desempeñoMensual)} transition-all`}
                    style={{ width: `${percentageWidth(vendedor.desempeñoMensual)}%` }}
                  />
                </div>
              </div>
            </Card>
          ))}
      </div>
    </div>
  );
}
