// Formato de cliente que usan los gráficos del diseño original de Figma.
export interface Client {
  id: number;
  nombre: string;
  vehiculo: string;
  placa: string;
  tipoVehiculo: "carro" | "moto" | "pesado";
  tipoServicio: "publico" | "particular";
  fecha: string;
  hora?: string;
  marca?: string;
  esRecurrente?: boolean;
  tiempoAtencion?: number; // en minutos
  ingresoEstimado?: number; // en miles de pesos
}
