import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Target } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import { periodoMensual } from "../../hooks/useSellerData";
import { Card } from "./ui/card";

type FilaMeta = {
  id: string;
  nombre: string;
  activo: boolean;
  mensual: string;
  anual: string;
};

export function SellerGoalsPanel() {
  const [filas, setFilas] = useState<FilaMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState<string | null>(null);
  const now = new Date();
  const mes = periodoMensual(now);
  const anio = String(now.getFullYear());

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [usuariosRes, metasRes] = await Promise.all([
        supabase.from("usuarios").select("id, nombre, activo").eq("rol", "vendedor").order("nombre"),
        supabase.from("metas").select("tipo, periodo, vendedor_id, meta").not("vendedor_id", "is", null).in("periodo", [mes, anio]),
      ]);
      if (usuariosRes.error) throw usuariosRes.error;
      if (metasRes.error) throw metasRes.error;

      const buscar = (vendedorId: string, tipo: string, periodo: string) =>
        metasRes.data?.find((m) => m.vendedor_id === vendedorId && m.tipo === tipo && m.periodo === periodo)?.meta;

      setFilas(
        (usuariosRes.data ?? []).map((u) => ({
          id: u.id,
          nombre: u.nombre,
          activo: u.activo,
          mensual: String(buscar(u.id, "mensual", mes) ?? ""),
          anual: String(buscar(u.id, "anual", anio) ?? ""),
        })),
      );
    } catch (error) {
      console.error("No se pudieron cargar las metas de los vendedores:", error);
      toast.error("No se pudieron cargar las metas de los vendedores.");
    } finally {
      setLoading(false);
    }
  }, [mes, anio]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const actualizar = (id: string, campo: "mensual" | "anual", valor: string) =>
    setFilas((actuales) => actuales.map((f) => (f.id === id ? { ...f, [campo]: valor } : f)));

  const guardar = async (fila: FilaMeta) => {
    const valores = [
      { tipo: "mensual", periodo: mes, texto: fila.mensual },
      { tipo: "anual", periodo: anio, texto: fila.anual },
    ];
    for (const v of valores) {
      if (v.texto.trim() && !(Number.isInteger(Number(v.texto)) && Number(v.texto) > 0)) {
        toast.error("Las metas deben ser números enteros mayores a cero.");
        return;
      }
    }

    setGuardando(fila.id);
    try {
      const conMeta = valores.filter((v) => v.texto.trim());
      const sinMeta = valores.filter((v) => !v.texto.trim());
      if (conMeta.length) {
        const { error } = await supabase.from("metas").upsert(
          conMeta.map((v) => ({ tipo: v.tipo, periodo: v.periodo, vendedor_id: fila.id, meta: Number(v.texto) })),
          { onConflict: "tipo,periodo,vendedor_id" },
        );
        if (error) throw error;
      }
      for (const v of sinMeta) {
        const { error } = await supabase
          .from("metas")
          .delete()
          .eq("vendedor_id", fila.id)
          .eq("tipo", v.tipo)
          .eq("periodo", v.periodo);
        if (error) throw error;
      }
      toast.success(`Metas de ${fila.nombre} guardadas.`);
    } catch (error) {
      console.error("No se pudieron guardar las metas:", error);
      toast.error("No se pudieron guardar las metas.");
    } finally {
      setGuardando(null);
    }
  };

  const nombreMes = now.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
  const inputClass =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200";

  return (
    <Card className="space-y-5 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-purple-100 p-3 text-purple-700">
            <Target className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Metas de vendedores</h2>
            <p className="mt-1 text-sm text-gray-500">
              Ventas pagadas que debe lograr cada vendedor en {nombreMes} y en {anio}. Déjalo vacío para quitar la meta.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void cargar()}
          className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-50"
          title="Actualizar lista"
          aria-label="Actualizar lista de vendedores"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <p className="py-4 text-center text-sm text-gray-500">Cargando vendedores...</p>
      ) : filas.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-500">Aún no hay vendedores. Créalos en "Crear una cuenta".</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {filas.map((fila) => (
            <li key={fila.id} className="grid gap-3 py-3 sm:grid-cols-[1fr_8rem_8rem_auto] sm:items-end">
              <div className="min-w-0 sm:pb-2">
                <p className="truncate font-medium text-gray-900">{fila.nombre}</p>
                {!fila.activo && <p className="text-xs text-gray-500">Cuenta inactiva</p>}
              </div>
              <label className="text-xs text-gray-600">
                Meta del mes
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={fila.mensual}
                  onChange={(e) => actualizar(fila.id, "mensual", e.target.value)}
                  className={`mt-1 ${inputClass}`}
                />
              </label>
              <label className="text-xs text-gray-600">
                Meta del año
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={fila.anual}
                  onChange={(e) => actualizar(fila.id, "anual", e.target.value)}
                  className={`mt-1 ${inputClass}`}
                />
              </label>
              <button
                type="button"
                onClick={() => void guardar(fila)}
                disabled={guardando === fila.id}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {guardando === fila.id ? "Guardando..." : "Guardar"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
