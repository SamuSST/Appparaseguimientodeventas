import { Car, Bike, Truck } from "lucide-react";
import { allClients } from "../data/mockClients";
import { roundedShares } from "../data/metrics";

interface VehicleCategory {
  type: string;
  count: number;
  icon: typeof Car;
  color: string;
  key: "carro" | "moto" | "pesado";
}

interface VehicleStatsProps {
  onCategoryClick: (category: "carro" | "moto" | "pesado") => void;
}

const vehicleTypes: VehicleCategory[] = [
  { type: "Carros", count: 0, icon: Car, color: "bg-blue-500", key: "carro" },
  { type: "Motos", count: 0, icon: Bike, color: "bg-green-500", key: "moto" },
  { type: "Pesados", count: 0, icon: Truck, color: "bg-orange-500", key: "pesado" },
];

export function VehicleStats({ onCategoryClick }: VehicleStatsProps) {
  const vehicleData = vehicleTypes.map((vehicle) => ({
    ...vehicle,
    count: allClients.filter((client) => client.tipoVehiculo === vehicle.key).length,
  }));
  const total = vehicleData.reduce((sum, item) => sum + item.count, 0);
  const percentages = roundedShares(vehicleData.map((vehicle) => vehicle.count));

  return (
    <div className="bg-white rounded-xl shadow-md p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Vehículos Atendidos</h3>
      
      <div className="space-y-3">
        {vehicleData.map((vehicle, index) => {
          const Icon = vehicle.icon;
          const percentage = percentages[index];
          
          return (
            <div 
              key={vehicle.type} 
              className="flex items-center gap-3 cursor-pointer active:scale-95 transition-transform"
              onClick={() => onCategoryClick(vehicle.key)}
            >
              <div className={`w-10 h-10 rounded-lg ${vehicle.color} flex items-center justify-center`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900">{vehicle.type}</span>
                  <span className="text-sm font-bold text-gray-900">{vehicle.count}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${vehicle.color}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-600 min-w-[40px] text-right">{percentage}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="mt-4 pt-4 border-t">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-600">Total</span>
          <span className="text-xl font-bold text-gray-900">{total}</span>
        </div>
      </div>
    </div>
  );
}