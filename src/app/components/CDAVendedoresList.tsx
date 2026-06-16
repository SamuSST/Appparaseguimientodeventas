import { useMemo } from "react";
import { ArrowLeft, LogOut } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { useCDAData } from "../../hooks/useCDAData";
import { VendorListPanel } from "./VendorListPanel";
import logo from "figma:asset/9b6752e4935d81eb0c34c840e006a7ba641d4c8e.png";

export function CDAVendedoresList() {
  const navigate = useNavigate();
  const { cdas } = useCDAData();
  const { cdaId } = useParams();
  const cda = cdas.find((item) => item.id === Number(cdaId));

  const handleLogout = () => {
    localStorage.removeItem("userRole");
    localStorage.removeItem("userName");
    navigate("/");
  };

  if (!cda) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-600">CDA no encontrado</p>
      </div>
    );
  }

  const duplicateVendorNames = useMemo(() => {
    const counts = new Map<string, number>();
    cda.vendedores.forEach((vendedor) => {
      const normalized = vendedor.nombre.trim().toLowerCase();
      if (!normalized) return;
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .filter(([, count]) => count > 1)
      .map(([name, count]) => ({ name, count }));
  }, [cda.vendedores]);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto p-3 px-4 md:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <img src={logo} alt="Grupo Cardisel" className="h-10 w-auto" />
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

      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto p-4 px-4 md:px-6 lg:px-8">
          <button
            onClick={() => navigate("/admin")}
            className="flex items-center gap-2 mb-3 text-blue-100 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">Volver a CDAs</span>
          </button>

          <h1 className="text-xl font-bold mb-1">{cda.nombre}</h1>
          <p className="text-blue-100 text-sm mb-3">{cda.direccion}</p>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-blue-700/50 rounded-lg p-2 text-center">
              <p className="text-2xl font-bold">{cda.totalVendedores}</p>
              <p className="text-xs text-blue-100">Vendedores</p>
            </div>
            <div className="bg-blue-700/50 rounded-lg p-2 text-center">
              <p className="text-2xl font-bold">{cda.clientesMes}</p>
              <p className="text-xs text-blue-100">Clientes/mes</p>
            </div>
            <div className="bg-blue-700/50 rounded-lg p-2 text-center">
              <p className="text-2xl font-bold">{cda.desempeñoPromedio}%</p>
              <p className="text-xs text-blue-100">Desempeño</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 px-4 md:px-6 lg:px-8">
        <VendorListPanel cda={cda} duplicateVendorNames={duplicateVendorNames} />
      </div>
    </div>
  );
}
