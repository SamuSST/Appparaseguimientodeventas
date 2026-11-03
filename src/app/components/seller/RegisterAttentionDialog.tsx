import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "../../../lib/supabase";
import { toDateKey } from "../../data/metrics";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";

type TipoVehiculo = "moto" | "carro" | "pesado";
type TipoRevision = "RTM" | "Preventiva" | "Reinspección";

const vacio = () => ({
  fecha: toDateKey(new Date()),
  hora: new Date().toTimeString().slice(0, 5),
  cliente_nombre: "",
  placa: "",
  marca: "",
  vehiculo: "",
  tipo_vehiculo: "carro" as TipoVehiculo,
  electrico: false,
  tipo_revision: "RTM" as TipoRevision,
  tipo_servicio: "particular" as "particular" | "publico",
  tiempo_atencion_min: "",
  resultado: "Aprobada" as "Aprobada" | "Rechazada",
  pagado: true,
});

// El vendedor registra una atención desde la app. El precio y la fecha límite de reinspección
// los calcula Supabase (el vendedor no ve valores en pesos).
export function RegisterAttentionDialog({
  vendedorId,
  open,
  onOpenChange,
  onSaved,
}: {
  vendedorId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(vacio);
  const [guardando, setGuardando] = useState(false);
  const set = <K extends keyof ReturnType<typeof vacio>>(campo: K, valor: ReturnType<typeof vacio>[K]) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const placa = form.placa.trim().toUpperCase().replace(/\s+/g, "");
    if (!placa) {
      toast.error("Escribe la placa.");
      return;
    }
    if (form.fecha > toDateKey(new Date())) {
      toast.error("La fecha no puede ser futura.");
      return;
    }
    setGuardando(true);
    try {
      const { error } = await supabase.from("atenciones").insert({
        vendedor_id: vendedorId,
        fecha: form.fecha,
        hora: form.hora || null,
        cliente_nombre: form.cliente_nombre.trim() || null,
        placa,
        marca: form.marca.trim() || null,
        vehiculo: form.vehiculo.trim() || null,
        tipo_vehiculo: form.tipo_vehiculo,
        electrico: form.tipo_vehiculo !== "moto" && form.electrico,
        tipo_revision: form.tipo_revision,
        tipo_servicio: form.tipo_servicio,
        tiempo_atencion_min: form.tiempo_atencion_min ? Math.round(Number(form.tiempo_atencion_min)) : null,
        resultado: form.tipo_revision === "Preventiva" ? null : form.resultado,
        pagado: form.tipo_revision === "Reinspección" ? true : form.pagado,
        ingreso: null,
      });
      if (error) {
        if (error.code === "23505") throw new Error(`La placa ${placa} ya tiene una ${form.tipo_revision} registrada ese día.`);
        throw error;
      }
      toast.success("Atención registrada.");
      setForm(vacio());
      onOpenChange(false);
      onSaved();
    } catch (error) {
      console.error("No se pudo registrar la atención:", error);
      toast.error(error instanceof Error ? error.message : "No se pudo registrar la atención.");
    } finally {
      setGuardando(false);
    }
  };

  const input = "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar atención</DialogTitle>
        </DialogHeader>
        <form onSubmit={guardar} className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-gray-600">
            Fecha
            <input type="date" value={form.fecha} max={toDateKey(new Date())} onChange={(e) => set("fecha", e.target.value)} className={input} required />
          </label>
          <label className="text-xs text-gray-600">
            Hora
            <input type="time" value={form.hora} onChange={(e) => set("hora", e.target.value)} className={input} />
          </label>
          <label className="text-xs text-gray-600 sm:col-span-2">
            Cliente
            <input value={form.cliente_nombre} onChange={(e) => set("cliente_nombre", e.target.value)} className={input} placeholder="Nombre o empresa" />
          </label>
          <label className="text-xs text-gray-600">
            Placa
            <input value={form.placa} onChange={(e) => set("placa", e.target.value)} className={`${input} font-mono uppercase`} placeholder="ABC123" required />
          </label>
          <label className="text-xs text-gray-600">
            Tipo de vehículo
            <select value={form.tipo_vehiculo} onChange={(e) => set("tipo_vehiculo", e.target.value as TipoVehiculo)} className={`${input} bg-white`}>
              <option value="carro">Liviano (carro)</option>
              <option value="moto">Moto</option>
              <option value="pesado">Pesado</option>
            </select>
          </label>
          <label className="text-xs text-gray-600">
            Marca
            <input value={form.marca} onChange={(e) => set("marca", e.target.value)} className={input} placeholder="Mazda" />
          </label>
          <label className="text-xs text-gray-600">
            Línea
            <input value={form.vehiculo} onChange={(e) => set("vehiculo", e.target.value)} className={input} placeholder="CX-5" />
          </label>
          <label className="text-xs text-gray-600">
            Revisión
            <select value={form.tipo_revision} onChange={(e) => set("tipo_revision", e.target.value as TipoRevision)} className={`${input} bg-white`}>
              <option value="RTM">RTM</option>
              <option value="Preventiva">Preventiva</option>
              <option value="Reinspección">Reinspección (gratis)</option>
            </select>
          </label>
          <label className="text-xs text-gray-600">
            Servicio
            <select value={form.tipo_servicio} onChange={(e) => set("tipo_servicio", e.target.value as "particular" | "publico")} className={`${input} bg-white`}>
              <option value="particular">Particular</option>
              <option value="publico">Público</option>
            </select>
          </label>
          {form.tipo_revision !== "Preventiva" && (
            <label className="text-xs text-gray-600">
              Resultado
              <select value={form.resultado} onChange={(e) => set("resultado", e.target.value as "Aprobada" | "Rechazada")} className={`${input} bg-white`}>
                <option value="Aprobada">Aprobada</option>
                <option value="Rechazada">Rechazada</option>
              </select>
            </label>
          )}
          <label className="text-xs text-gray-600">
            Tiempo (minutos)
            <input type="number" min={0} value={form.tiempo_atencion_min} onChange={(e) => set("tiempo_atencion_min", e.target.value)} className={input} />
          </label>
          {form.tipo_vehiculo !== "moto" && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.electrico} onChange={(e) => set("electrico", e.target.checked)} /> Vehículo eléctrico
            </label>
          )}
          {form.tipo_revision !== "Reinspección" && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.pagado} onChange={(e) => set("pagado", e.target.checked)} /> Ya pagó
            </label>
          )}
          {form.tipo_revision === "RTM" && form.resultado === "Rechazada" && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 sm:col-span-2">
              El cliente tendrá 15 días para volver gratis a la reinspección. Aparecerá en tu Seguimiento.
            </p>
          )}
          <button
            type="submit"
            disabled={guardando}
            className="rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-60 sm:col-span-2"
          >
            {guardando ? "Guardando..." : "Guardar atención"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
