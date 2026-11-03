import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Eye, LogOut, Plus, RefreshCw } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { atencionesAClientes, periodoMensual, useSellerData } from "../../hooks/useSellerData";
import type { Client } from "../data/clientes";
import { toDateKey } from "../data/metrics";
import { BottomNav, type SellerTab } from "./BottomNav";
import { MonthlyHistory, type MonthlySnapshot } from "./MonthlyHistory";
import { SellerFollowUp } from "./seller/SellerFollowUp";
import { RegisterAttentionDialog } from "./seller/RegisterAttentionDialog";
import { nombreDeMes, percentageOf, periodosAlrededor } from "../data/metrics";
import { SellerSummary } from "./seller/SellerSummary";
import { PerformanceChart } from "./PerformanceChart";
import { DailyTrendChart } from "./DailyTrendChart";
import { CustomerTypeChart } from "./CustomerTypeChart";
import { PeakHoursChart } from "./PeakHoursChart";
import { VehicleStats } from "./VehicleStats";
import { ServiceTypeStats } from "./ServiceTypeStats";
import { ServiceTimeChart } from "./ServiceTimeChart";
import { TopBrandsChart } from "./TopBrandsChart";
import { ClientList } from "./ClientList";
import { ClientDetailsSheet } from "./ClientDetailsSheet";
import { SellerClients } from "./seller/SellerClients";
import { SellerRoute } from "./seller/SellerRoute";
import { SellerRanking } from "./seller/SellerRanking";
import logo from "figma:asset/9b6752e4935d81eb0c34c840e006a7ba641d4c8e.png";

type Tab = SellerTab;

const tabs: { id: Tab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "seguimiento", label: "Seguimiento" },
  { id: "recorrido", label: "Recorrido" },
  { id: "ranking", label: "Ranking" },
];

export function SellerAccountDashboard() {
  const navigate = useNavigate();
  const { vendedorId } = useParams();
  const { perfil, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const esPropio = !!perfil && perfil.rol === "vendedor" && perfil.id === vendedorId;
  const esAdmin = perfil?.rol === "admin";
  // El admin puede abrir el panel de cualquier vendedor en modo de consulta.
  const [vendedores, setVendedores] = useState<{ id: string; nombre: string }[]>([]);
  const [cargandoVendedores, setCargandoVendedores] = useState(esAdmin);

  useEffect(() => {
    if (!esAdmin) return;
    let activo = true;
    (async () => {
      const { data, error: listaError } = await supabase
        .from("usuarios")
        .select("id, nombre")
        .eq("rol", "vendedor")
        .order("nombre");
      if (!activo) return;
      if (listaError) {
        console.error("No se pudo cargar la lista de vendedores:", listaError);
        toast.error("No se pudo cargar la lista de vendedores.");
      }
      setVendedores(data ?? []);
      setCargandoVendedores(false);
    })();
    return () => {
      activo = false;
    };
  }, [esAdmin]);

  const vendedorVisto = esPropio ? perfil : vendedores.find((v) => v.id === vendedorId);
  const puedeVer = esPropio || (esAdmin && !!vendedorVisto);
  const { atenciones, metas, loading, error, recargar } = useSellerData(puedeVer ? vendedorId : undefined);
  // Se carga también el año anterior solo para comparar; el resto del panel muestra el año en curso.
  const anioActual = String(new Date().getFullYear());
  const todosLosClientes = useMemo(() => atencionesAClientes(atenciones), [atenciones]);
  const clientes = useMemo(() => todosLosClientes.filter((c) => c.fecha.startsWith(anioActual)), [todosLosClientes, anioActual]);
  const atencionesAnio = useMemo(() => atenciones.filter((a) => a.fecha.startsWith(anioActual)), [atenciones, anioActual]);
  const [sheet, setSheet] = useState<{ titulo: string; clientes: Client[] } | null>(null);
  const [registrando, setRegistrando] = useState(false);

  // Historial de los últimos 12 meses (sin valores en pesos).
  const historial = useMemo<MonthlySnapshot[]>(
    () =>
      periodosAlrededor(11, 0)
        .map((p) => {
          const delMes = atenciones.filter((a) => a.fecha.startsWith(p) && a.tipo_revision !== "Reinspección");
          const pagadas = delMes.filter((a) => a.pagado).length;
          const meta = metas.porMes[p] ?? 0;
          const rtm = delMes.filter((a) => a.tipo_revision === "RTM");
          return {
            mes: nombreDeMes(p),
            fileName: p,
            timestamp: `${p}-01T12:00:00`,
            achieved: pagadas,
            meta,
            progress: meta ? Math.round(percentageOf(pagadas, meta)) : 0,
            rtms: { total: rtm.length, motos: rtm.filter((a) => a.tipo_vehiculo === "moto").length },
            preventivas: { total: delMes.filter((a) => a.tipo_revision === "Preventiva").length },
          };
        })
        .filter((s) => s.achieved > 0 || s.meta > 0 || s.rtms.total > 0),
    [atenciones, metas.porMes],
  );

  const abrirVehiculos = (tipo: "carro" | "moto" | "pesado") => {
    const titulos = { carro: "Carros", moto: "Motos", pesado: "Vehículos pesados" };
    setSheet({ titulo: titulos[tipo], clientes: clientes.filter((c) => c.tipoVehiculo === tipo) });
  };
  const abrirServicio = (tipo: "publico" | "particular") => {
    setSheet({
      titulo: tipo === "publico" ? "Servicio público" : "Servicio particular",
      clientes: clientes.filter((c) => c.tipoServicio === tipo),
    });
  };

  const handleLogout = async () => {
    try {
      await signOut();
      navigate("/", { replace: true });
    } catch (error) {
      console.error("No se pudo cerrar la sesión:", error);
      toast.error("No se pudo cerrar la sesión.");
    }
  };

  if (esAdmin && cargandoVendedores) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
        <p className="text-gray-600">Cargando…</p>
      </main>
    );
  }

  if (!perfil || !puedeVer || !vendedorVisto || !vendedorId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
        <p className="text-gray-600">No se encontró el panel de este vendedor.</p>
      </main>
    );
  }

  const hoy = toDateKey(new Date());
  const mes = periodoMensual(new Date());
  const iniciales = vendedorVisto.nombre.split(" ").filter(Boolean).map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-gray-100 pb-20 md:pb-0">
      <header className="sticky top-0 z-50 bg-white shadow-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-6 lg:px-8">
          {esAdmin ? (
            <button
              type="button"
              onClick={() => navigate("/admin")}
              className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
            >
              <ArrowLeft className="h-4 w-4" /> Panel admin
            </button>
          ) : (
            <img src={logo} alt="Grupo Cardisel" className="h-10 w-auto" />
          )}
          {esAdmin && (
            <select
              value={vendedorId}
              onChange={(e) => {
                setActiveTab("dashboard");
                navigate(`/vendedor/${e.target.value}`);
              }}
              aria-label="Cambiar de vendedor"
              className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 sm:max-w-xs"
            >
              {vendedores.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nombre}
                </option>
              ))}
            </select>
          )}
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
      </header>

      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg">
        <div className="mx-auto max-w-7xl px-4 py-4 md:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-lg font-bold">
              {iniciales}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold md:text-2xl">{vendedorVisto.nombre}</h1>
              <p className="truncate text-sm text-blue-100">Vendedor · CDA La 37</p>
            </div>
          </div>
          <nav className="mt-4 hidden gap-2 md:flex">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-lg px-4 py-2 font-medium transition-all ${
                  activeTab === tab.id ? "bg-white text-blue-600" : "bg-blue-700/50 text-blue-100 hover:bg-blue-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {esAdmin && (
        <div className="border-b border-amber-200 bg-amber-50">
          <p className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2 text-sm text-amber-900 md:px-6 lg:px-8">
            <Eye className="h-4 w-4 shrink-0" />
            Estás viendo el panel de {vendedorVisto.nombre} como administrador (solo consulta).
          </p>
        </div>
      )}

      {activeTab === "dashboard" ? (
        <main className="mx-auto max-w-7xl space-y-4 p-4 md:space-y-6 md:p-6 lg:p-8">
          {loading ? (
            <p className="py-12 text-center text-gray-500">Cargando tus datos...</p>
          ) : error ? (
            <div className="rounded-xl bg-white p-6 text-center">
              <p className="text-sm text-red-600">{error}</p>
              <button
                type="button"
                onClick={() => void recargar()}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <RefreshCw className="h-4 w-4" /> Reintentar
              </button>
            </div>
          ) : (
            <>
              {atencionesAnio.length === 0 && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                  Aún no tienes atenciones registradas este año. Tus números aparecerán aquí a medida que se carguen tus ventas.
                </div>
              )}
              {!esAdmin && (
                <button
                  type="button"
                  onClick={() => setRegistrando(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white shadow-md hover:bg-blue-700 sm:w-auto"
                >
                  <Plus className="h-5 w-5" /> Registrar atención
                </button>
              )}
              <SellerSummary atenciones={atencionesAnio} metas={metas} hoy={hoy} mes={mes} />
              {/* Gráficos originales del diseño de Figma, ahora con los datos de Supabase. */}
              <PerformanceChart clients={todosLosClientes} compararAnios={false} />
              <DailyTrendChart clients={clientes} />
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <CustomerTypeChart clients={clientes} />
                <PeakHoursChart clients={clientes} />
              </div>
              <VehicleStats clients={clientes} onCategoryClick={abrirVehiculos} />
              <ServiceTypeStats clients={clientes} onCategoryClick={abrirServicio} />
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <ServiceTimeChart clients={clientes} />
                <TopBrandsChart clients={clientes} />
              </div>
              <ClientList clients={clientes} />
              <SellerClients key={vendedorId} atenciones={atencionesAnio} puedeBorrar={!esAdmin} onCambio={() => void recargar()} />
              <div className="-mx-4 md:-mx-6 lg:-mx-8">
                <MonthlyHistory snapshots={historial} />
              </div>
            </>
          )}
        </main>
      ) : activeTab === "seguimiento" ? (
        <SellerFollowUp key={vendedorId} vendedorId={vendedorId} />
      ) : activeTab === "recorrido" ? (
        <SellerRoute key={vendedorId} vendedorId={vendedorId} soloLectura={esAdmin} />
      ) : (
        <SellerRanking key={vendedorId} vendedorId={vendedorId} />
      )}

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      {!esAdmin && (
        <RegisterAttentionDialog
          vendedorId={vendedorId}
          open={registrando}
          onOpenChange={setRegistrando}
          onSaved={() => void recargar()}
        />
      )}

      <ClientDetailsSheet
        open={!!sheet}
        onOpenChange={(open) => !open && setSheet(null)}
        title={sheet?.titulo ?? ""}
        clients={sheet?.clientes ?? []}
      />
    </div>
  );
}
