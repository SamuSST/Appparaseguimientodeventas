import { useState } from "react";
import { Building2, ChevronRight, DollarSign, LogOut, RefreshCw, TrendingUp, Trophy, Users } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useAuth } from "../../lib/auth";
import { periodoMensual } from "../../hooks/useSellerData";
import { useAdminResumen } from "../../hooks/useAdminResumen";
import { percentageLabel, percentageOf, percentageWidth } from "../data/metrics";
import { Card } from "./ui/card";
import { CreateAccountPanel } from "./CreateAccountPanel";
import { SellerGoalsPanel } from "./SellerGoalsPanel";
import { AdminRoutesPanel } from "./AdminRoutesPanel";
import { ImportExcelPanel } from "./ImportExcelPanel";
import logo from "figma:asset/9b6752e4935d81eb0c34c840e006a7ba641d4c8e.png";

type AdminTab = "inicio" | "recorridos";

const adminTabs: { id: AdminTab; label: string }[] = [
  { id: "inicio", label: "Inicio" },
  { id: "recorridos", label: "Recorridos" },
];

const pesos = (valor: number) => `$${Math.round(valor).toLocaleString("es-CO")}`;

const colorAvance = (porcentaje: number) =>
  porcentaje >= 75 ? "bg-green-500" : porcentaje >= 50 ? "bg-amber-500" : "bg-red-500";

export function AdminCDAList() {
  const [tab, setTab] = useState<AdminTab>("inicio");
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const now = new Date();
  const periodo = periodoMensual(now);
  const nombreMes = now.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
  const { vendedores, metaCda, loading, error, recargar, guardarMetaCda } = useAdminResumen(periodo);
  const [showMetaPanel, setShowMetaPanel] = useState(false);
  const [newMeta, setNewMeta] = useState("");
  const [guardandoMeta, setGuardandoMeta] = useState(false);
  // Cambia cuando se importa un Excel o se crean cuentas, para que los paneles vuelvan a leer Supabase.
  const [version, setVersion] = useState(0);

  const handleUpdateMeta = async () => {
    const value = Number(newMeta);
    if (!Number.isInteger(value) || value <= 0) {
      toast.error("Ingresa una meta mensual mayor a cero.");
      return;
    }
    setGuardandoMeta(true);
    try {
      await guardarMetaCda(value);
      toast.success("Meta mensual del CDA guardada.");
      setShowMetaPanel(false);
    } catch (err) {
      console.error("No se pudo actualizar la meta mensual:", err);
      toast.error("No se pudo guardar la meta.");
    } finally {
      setGuardandoMeta(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      navigate("/", { replace: true });
    } catch (err) {
      console.error("No se pudo cerrar la sesión:", err);
      toast.error("No se pudo cerrar la sesión.");
    }
  };

  const actualizarTodo = () => {
    void recargar();
    setVersion((v) => v + 1);
  };

  const activos = vendedores.filter((v) => v.activo);
  const atencionesMes = vendedores.reduce((s, v) => s + v.atenciones, 0);
  const ventasMes = vendedores.reduce((s, v) => s + v.ventas_pagadas, 0);
  const ingresosMes = vendedores.reduce((s, v) => s + v.ingresos, 0);
  const rtmMes = vendedores.reduce((s, v) => s + v.rtm, 0);
  const rechazadasMes = vendedores.reduce((s, v) => s + v.rechazadas, 0);
  const percentage = metaCda ? percentageOf(ventasMes, metaCda) : 0;
  const statusText = percentage >= 75 ? "Buen avance" : percentage >= 50 ? "Avance intermedio" : "Requiere atención";

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="sticky top-0 z-40 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
          <img src={logo} alt="CDA La 37" className="h-10 w-auto" />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setNewMeta(metaCda ? String(metaCda) : "");
                setShowMetaPanel((visible) => !visible);
                setTab("inicio");
              }}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Trophy className="h-4 w-4" />
              Meta mensual
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-6">
        <section className="rounded-2xl bg-gradient-to-r from-blue-700 to-blue-900 p-6 text-white">
          <div className="flex items-center gap-3">
            <Building2 className="h-9 w-9" />
            <div>
              <p className="text-sm text-blue-100">Panel administrativo</p>
              <h1 className="text-2xl font-bold">CDA La 37</h1>
            </div>
          </div>
          <p className="mt-3 text-sm text-blue-100">
            Gestión de vendedores, metas e información comercial de este centro.
          </p>
          <nav className="mt-4 flex gap-2">
            {adminTabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                  tab === item.id ? "bg-white text-blue-700" : "bg-blue-800/60 text-blue-100 hover:bg-blue-800"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </section>

        {tab === "recorridos" ? (
          <AdminRoutesPanel key={version} />
        ) : (
          <>
            {showMetaPanel && (
              <Card className="space-y-3 border-blue-200 p-5">
                <h2 className="font-bold text-gray-900">Meta mensual del CDA · {nombreMes}</h2>
                <label htmlFor="monthly-goal" className="block text-sm text-gray-700">
                  Ventas pagadas que debe lograr el CDA este mes (sin contar reinspecciones)
                </label>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    id="monthly-goal"
                    type="number"
                    min="1"
                    value={newMeta}
                    onChange={(event) => setNewMeta(event.target.value)}
                    className="w-full rounded-lg border px-3 py-2 sm:max-w-xs"
                  />
                  <button
                    type="button"
                    onClick={() => void handleUpdateMeta()}
                    disabled={guardandoMeta}
                    className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {guardandoMeta ? "Guardando..." : "Guardar meta"}
                  </button>
                </div>
              </Card>
            )}

            {error && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                <span>{error}</span>
                <button type="button" onClick={() => void recargar()} className="font-semibold underline">
                  Reintentar
                </button>
              </div>
            )}

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="p-5">
                <Users className="mb-3 h-6 w-6 text-green-600" />
                <p className="text-sm text-gray-500">Vendedores activos</p>
                <p className="text-2xl font-bold text-gray-900">{loading ? "…" : activos.length}</p>
              </Card>
              <Card className="p-5">
                <TrendingUp className="mb-3 h-6 w-6 text-purple-600" />
                <p className="text-sm text-gray-500">Atenciones de {nombreMes}</p>
                <p className="text-2xl font-bold text-gray-900">{loading ? "…" : atencionesMes.toLocaleString("es-CO")}</p>
              </Card>
              <Card className="p-5">
                <DollarSign className="mb-3 h-6 w-6 text-emerald-600" />
                <p className="text-sm text-gray-500">Ingresos pagados del mes</p>
                <p className="text-2xl font-bold text-gray-900">{loading ? "…" : pesos(ingresosMes)}</p>
              </Card>
              <Card className="p-5">
                <Building2 className="mb-3 h-6 w-6 text-red-600" />
                <p className="text-sm text-gray-500">RTM rechazadas del mes</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loading ? "…" : rtmMes ? percentageLabel(percentageOf(rechazadasMes, rtmMes)) : "—"}
                </p>
              </Card>
            </section>

            <Card className="space-y-4 p-5">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Cumplimiento de la meta</h2>
                  <p className="text-sm text-gray-500">CDA La 37 · {nombreMes}</p>
                </div>
                <span className="text-2xl font-bold text-blue-700">{metaCda ? percentageLabel(percentage) : "—"}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-gray-200">
                <div
                  className={`h-full rounded-full transition-all ${colorAvance(percentage)}`}
                  style={{ width: `${percentageWidth(percentage)}%` }}
                />
              </div>
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <span className="text-gray-600">
                  {metaCda
                    ? `${ventasMes.toLocaleString("es-CO")} de ${metaCda.toLocaleString("es-CO")} ventas pagadas`
                    : `${ventasMes.toLocaleString("es-CO")} ventas pagadas · sin meta del CDA para este mes (usa "Meta mensual")`}
                </span>
                {metaCda && <span className="font-semibold text-gray-700">{statusText}</span>}
              </div>
            </Card>

            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Vendedores</h2>
                  <p className="text-sm text-gray-500">Desempeño de {nombreMes} · toca un vendedor para ver su panel</p>
                </div>
                <button
                  type="button"
                  onClick={actualizarTodo}
                  className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-50"
                  title="Actualizar"
                  aria-label="Actualizar datos"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
              {loading ? (
                <p className="py-6 text-center text-sm text-gray-500">Cargando vendedores...</p>
              ) : vendedores.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-500">Aún no hay vendedores. Créalos al importar el Excel o en "Crear una cuenta".</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase text-gray-500">
                        <th className="py-2 pr-3 font-medium">Vendedor</th>
                        <th className="py-2 pr-3 text-right font-medium">Atenciones</th>
                        <th className="py-2 pr-3 text-right font-medium">RTM / Prev.</th>
                        <th className="py-2 pr-3 text-right font-medium">Pagadas / meta</th>
                        <th className="w-40 py-2 pr-3 font-medium">Cumplimiento</th>
                        <th className="py-2 text-right font-medium">Ingresos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {vendedores.map((v) => {
                        const pct = v.meta ? percentageOf(v.ventas_pagadas, v.meta) : 0;
                        return (
                          <tr
                            key={v.vendedor_id}
                            onClick={() => navigate(`/vendedor/${v.vendedor_id}`)}
                            className={`cursor-pointer hover:bg-blue-50 ${v.activo ? "" : "opacity-60"}`}
                          >
                            <td className="py-3 pr-3">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/vendedor/${v.vendedor_id}`);
                                }}
                                className="flex items-center gap-1 text-left font-medium text-blue-700 hover:underline"
                              >
                                {v.nombre}
                                <ChevronRight className="h-4 w-4" />
                              </button>
                              {!v.activo && <p className="text-xs text-gray-500">Cuenta inactiva</p>}
                            </td>
                            <td className="py-3 pr-3 text-right font-semibold text-gray-900">{v.atenciones.toLocaleString("es-CO")}</td>
                            <td className="py-3 pr-3 text-right text-gray-700">
                              {v.rtm} / {v.preventivas}
                            </td>
                            <td className="py-3 pr-3 text-right text-gray-700">
                              {v.ventas_pagadas}
                              {v.meta ? ` / ${v.meta}` : ""}
                            </td>
                            <td className="py-3 pr-3">
                              {v.meta ? (
                                <div className="flex items-center gap-2">
                                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                                    <div className={`h-full ${colorAvance(pct)}`} style={{ width: `${percentageWidth(pct)}%` }} />
                                  </div>
                                  <span className="w-10 text-right text-xs font-semibold text-gray-700">{percentageLabel(pct)}</span>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">Sin meta</span>
                              )}
                            </td>
                            <td className="py-3 text-right text-gray-700">{pesos(v.ingresos)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <ImportExcelPanel onImported={actualizarTodo} />

            <SellerGoalsPanel key={`metas-${version}`} />

            <CreateAccountPanel />
          </>
        )}
      </main>
    </div>
  );
}
