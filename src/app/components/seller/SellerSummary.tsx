import { Calendar, Target, TrendingUp } from "lucide-react";
import { Card } from "../ui/card";
import { MetricCard } from "../MetricCard";
import { percentageOf } from "../../data/metrics";
import { esVenta, type Atencion, type MetasVendedor } from "../../../hooks/useSellerData";

interface SellerSummaryProps {
  atenciones: Atencion[];
  metas: MetasVendedor;
  hoy: string;
  mes: string;
}

// Días de trabajo (lunes a sábado) desde hoy hasta fin de mes, incluyendo hoy.
function diasHabilesRestantes(fecha: Date) {
  const ultimoDia = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0).getDate();
  let dias = 0;
  for (let dia = fecha.getDate(); dia <= ultimoDia; dia += 1) {
    if (new Date(fecha.getFullYear(), fecha.getMonth(), dia).getDay() !== 0) dias += 1;
  }
  return Math.max(dias, 1);
}

export function SellerSummary({ atenciones: todas, metas, hoy, mes }: SellerSummaryProps) {
  const now = new Date();
  const atenciones = todas.filter(esVenta);
  const deHoy = atenciones.filter((a) => a.fecha === hoy);
  const delMes = atenciones.filter((a) => a.fecha.startsWith(mes));
  const pagadasMes = delMes.filter((a) => a.pagado).length;
  const pagadasAnio = atenciones.filter((a) => a.pagado).length;
  const pendientesMes = delMes.length - pagadasMes;

  const faltanMes = metas.mensual ? Math.max(metas.mensual - pagadasMes, 0) : 0;
  const ritmoNecesario = Math.ceil(faltanMes / diasHabilesRestantes(now));

  const nombreMes = now.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
  const fechaHoy = now.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="space-y-4">
      <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="mb-1 text-xs text-gray-600">Meta del mes</p>
            <p className="text-lg font-bold text-blue-900">{metas.mensual ?? "—"}</p>
          </div>
          <div>
            <p className="mb-1 text-xs text-gray-600">Meta del año</p>
            <p className="text-lg font-bold text-blue-900">{metas.anual ?? "—"}</p>
          </div>
          <div>
            <p className="mb-1 text-xs text-gray-600">Ritmo diario</p>
            <p className="text-lg font-bold text-blue-900">{metas.mensual ? ritmoNecesario : "—"}</p>
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-gray-600">
          {!metas.mensual
            ? "Aún no tienes meta asignada para este mes. El administrador la definirá."
            : faltanMes === 0
              ? "¡Cumpliste la meta del mes!"
              : `Te faltan ${faltanMes} ventas pagadas; necesitas ${ritmoNecesario} por día hábil para lograrla.`}
        </p>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard title="Hoy" value={deHoy.length} icon={Calendar} period={fechaHoy} color="bg-blue-600" />
        <MetricCard
          title="Este mes"
          percentage={metas.mensual ? percentageOf(pagadasMes, metas.mensual) : undefined}
          icon={TrendingUp}
          period={`${pagadasMes} pagadas${pendientesMes ? ` · ${pendientesMes} pendientes` : ""} · ${nombreMes}`}
          color="bg-green-600"
          emptyMessage="Sin meta mensual asignada"
        />
        <MetricCard
          title="Este año"
          percentage={metas.anual ? percentageOf(pagadasAnio, metas.anual) : undefined}
          icon={Target}
          period={`${pagadasAnio} pagadas · ${now.getFullYear()}`}
          color="bg-purple-600"
          emptyMessage="Sin meta anual asignada"
        />
      </div>
    </div>
  );
}
