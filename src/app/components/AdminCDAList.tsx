import { useState } from "react";
import { Card } from "./ui/card";
import {
  Building2, Users, TrendingUp, ChevronRight,
  MapPin, Phone, LogOut, Trophy, Medal, Award, FileSpreadsheet,
} from "lucide-react";
import { useNavigate } from "react-router";
import logo from "../../../assets/9b6752e4935d81eb0c34c840e006a7ba641d4c8e.png";
import { useCDAData } from "../../hooks/useCDAData";
import { ExcelUploader } from "./ExcelUploader";

export function AdminCDAList() {
  const navigate = useNavigate();
  const [view, setView] = useState<"list" | "ranking">("list");
  const [showUploader, setShowUploader] = useState(false);

  // ← único cambio de datos: todo viene del hook
  const cdaHook = useCDAData();
  const { cdas } = cdaHook;
  const [selectedCdaId, setSelectedCdaId] = useState<number>(cdas[0]?.id ?? 1);
  const [newMeta, setNewMeta] = useState<string>(cdas[0]?.metaMensual.toString() ?? "0");

  const selectedCda = cdas.find((cda) => cda.id === selectedCdaId);
  const [showMetaPanel, setShowMetaPanel] = useState(false);

  const handleMetaChange = (value: string) => {
    setNewMeta(value.replace(/[^0-9]/g, ""));
  };

  const handleUpdateMeta = () => {
    if (!selectedCda) return;
    const parsedMeta = Number(newMeta);
    if (Number.isNaN(parsedMeta) || parsedMeta <= 0) {
      alert("Ingrese una meta mensual válida mayor a cero.");
      return;
    }
    cdaHook.updateCdaMeta(selectedCda.id, parsedMeta);
    alert(`Meta actualizada para ${selectedCda.nombre}: ${parsedMeta}`);
  };

  const handleLogout = () => {
    localStorage.removeItem("userRole");
    localStorage.removeItem("userName");
    navigate("/");
  };

  const getStatusColor = (p: number) =>
    p >= 75 ? "bg-green-500" : p >= 50 ? "bg-orange-500" : "bg-red-500";

  const getStatusText = (p: number) =>
    p >= 75 ? "Excelente" : p >= 50 ? "Aceptable" : "Bajo";

  const getStatusTextColor = (p: number) =>
    p >= 75 ? "text-green-600" : p >= 50 ? "text-orange-600" : "text-red-600";

  const getRankingIcon = (pos: number) => {
    if (pos === 1) return <Trophy className="w-6 h-6 text-yellow-500" />;
    if (pos === 2) return <Medal className="w-6 h-6 text-gray-500" />;
    if (pos === 3) return <Award className="w-6 h-6 text-amber-600" />;
    return <span className="text-xl font-bold text-gray-500">#{pos}</span>;
  };

  const sortedCDAs = [...cdas].sort((a, b) => {
    const pA = (a.clientesMes / a.metaMensual) * 100;
    const pB = (b.clientesMes / b.metaMensual) * 100;
    return pB - pA;
  });

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto p-3 px-4 md:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <img src={logo} alt="Grupo Cardisel" className="h-10 w-auto" />
            <div className="flex items-center gap-2">
              {/* Botón de carga de Excel */}
              <button
                onClick={() => setShowUploader(!showUploader)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  cdaHook.lastUpdate
                    ? "bg-green-100 text-green-700 hover:bg-green-200"
                    : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                }`}
                title="Mostrar u ocultar el panel de Excel"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {cdaHook.lastUpdate ? "Excel activo" : "Excel"}
                </span>
              </button>
              <button
                onClick={() => setShowMetaPanel((prev) => !prev)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                title="Mostrar u ocultar metas CDA"
              >
                <Trophy className="w-4 h-4" />
                <span className="hidden sm:inline">Metas CDA</span>
              </button>
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Cerrar sesión"
              >
                <LogOut className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Panel de carga (se despliega debajo del header) */}
      {showUploader && (
        <div className="max-w-lg mx-auto mt-3 px-4">
          <ExcelUploader hook={cdaHook} onClose={() => setShowUploader(false)} />
        </div>
      )}

      {showMetaPanel && (
        <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 px-4 md:px-6 lg:px-8">
          <Card className="p-4 mb-6 border border-blue-200 bg-blue-50">
            <h3 className="text-sm font-semibold text-blue-900 mb-3">Administrar metas de CDA</h3>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold text-blue-700 mb-1">Selecciona CDA</label>
                <select
                  value={selectedCdaId}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setSelectedCdaId(value);
                    const cda = cdas.find((item) => item.id === value);
                    setNewMeta(cda ? cda.metaMensual.toString() : "0");
                  }}
                  className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm"
                >
                  {cdas.map((cda) => (
                    <option key={cda.id} value={cda.id}>
                      {cda.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-blue-700 mb-1">Nueva meta mensual</label>
                <input
                  type="text"
                  value={newMeta}
                  onChange={(e) => handleMetaChange(e.target.value)}
                  className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm"
                />
              </div>

              <div className="flex flex-col justify-end gap-2">
                <button
                  onClick={handleUpdateMeta}
                  className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                >
                  Actualizar meta
                </button>
                {selectedCda && (
                  <p className="text-xs text-blue-700">
                    Meta actual: <span className="font-semibold">{selectedCda.metaMensual}</span>
                  </p>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Título */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="w-8 h-8" />
            <h1 className="text-2xl md:text-3xl font-bold">Panel Administrativo</h1>
          </div>
          <p className="text-blue-100 text-sm md:text-base">
            Gestión de Centros de Diagnóstico
            {cdaHook.lastUpdate && (
              <span className="ml-2 text-blue-200 text-xs">
                · Datos: {cdaHook.lastUpdate.mes} ({new Date(cdaHook.lastUpdate.timestamp).toLocaleDateString("es-CO")})
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 px-4 md:px-6 lg:px-8">
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Card className="p-3 text-center">
            <Building2 className="w-5 h-5 text-blue-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-gray-900">{cdas.length}</p>
            <p className="text-xs text-gray-500">CDAs</p>
          </Card>
          <Card className="p-3 text-center">
            <Users className="w-5 h-5 text-green-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-gray-900">
              {cdas.reduce((s, c) => s + c.totalVendedores, 0)}
            </p>
            <p className="text-xs text-gray-500">Vendedores</p>
          </Card>
          <Card className="p-3 text-center">
            <TrendingUp className="w-5 h-5 text-purple-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-gray-900">
              {cdas.reduce((s, c) => s + c.clientesMes, 0).toLocaleString("es-CO")}
            </p>
            <p className="text-xs text-gray-500">Clientes/mes</p>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {(["list", "ranking"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setView(t)}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                view === t
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {t === "list" ? "Lista de CDAs" : "Ranking"}
            </button>
          ))}
        </div>

        {/* Lista */}
        {view === "list" && (
          <div>
            <h2 className="font-semibold text-gray-900 text-lg mb-4">
              Centros de Diagnóstico
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cdas.map((cda) => {
                const p = Math.round((cda.clientesMes / cda.metaMensual) * 100);
                return (
                  <Card
                    key={cda.id}
                    className="p-4 cursor-pointer hover:shadow-lg transition-all active:scale-98"
                    onClick={() => navigate(`/cda/${cda.id}`)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 mb-1">{cda.nombre}</h3>
                        <div className="flex items-center gap-1 text-xs text-gray-600 mb-1">
                          <MapPin className="w-3 h-3" />{cda.ciudad}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-600">
                          <Phone className="w-3 h-3" />{cda.telefono}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-xs text-gray-500">Vendedores</p>
                        <p className="text-lg font-bold text-gray-900">{cda.totalVendedores}</p>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-2">
                        <p className="text-xs text-gray-500">Meta</p>
                        <p className="text-lg font-bold text-blue-900">{cda.metaMensual}</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-2">
                        <p className="text-xs text-gray-500">Alcanzado</p>
                        <p className="text-lg font-bold text-green-900">{cda.clientesMes}</p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">Cumplimiento de Meta</span>
                        <span className="font-semibold text-gray-900">{p}%</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${getStatusColor(p)} transition-all`}
                          style={{ width: `${Math.min(p, 100)}%` }}
                        />
                      </div>
                      <p className={`text-xs font-medium ${getStatusTextColor(p)}`}>
                        {getStatusText(p)}
                      </p>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Ranking */}
        {view === "ranking" && (
          <div>
            <h2 className="font-semibold text-gray-900 text-lg flex items-center gap-2 mb-1">
              <Trophy className="w-6 h-6 text-yellow-500" />
              Ranking de CDAs
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Ordenado por cumplimiento de meta mensual
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedCDAs.map((cda, index) => {
                const p = Math.round((cda.clientesMes / cda.metaMensual) * 100);
                const pos = index + 1;
                return (
                  <Card
                    key={cda.id}
                    className={`p-4 cursor-pointer hover:shadow-lg transition-all ${
                      pos === 1 ? "bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-300" :
                      pos === 2 ? "bg-gradient-to-r from-gray-50 to-slate-50 border-2 border-gray-300" :
                      pos === 3 ? "bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-300" : ""
                    }`}
                    onClick={() => navigate(`/cda/${cda.id}`)}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className="flex items-center justify-center w-12 h-12 shrink-0">
                        {getRankingIcon(pos)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-900 mb-1">{cda.nombre}</h3>
                        <p className="text-xs text-gray-600">{cda.ciudad}</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Meta</p>
                        <p className="text-sm font-bold text-gray-900">{cda.metaMensual}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Alcanzado</p>
                        <p className="text-sm font-bold text-blue-900">{cda.clientesMes}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Cumplimiento</p>
                        <p className={`text-sm font-bold ${getStatusTextColor(p)}`}>{p}%</p>
                      </div>
                    </div>

                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getStatusColor(p)} transition-all`}
                        style={{ width: `${Math.min(p, 100)}%` }}
                      />
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}