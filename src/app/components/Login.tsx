import { useState } from "react";
import { useNavigate } from "react-router";
import { Card } from "./ui/card";
import { Mail, Lock, Eye, EyeOff, LogIn } from "lucide-react";
import logo from "figma:asset/9b6752e4935d81eb0c34c840e006a7ba641d4c8e.png";
import { mockCDAs } from "../data/mockCDAs";
import { toast } from "sonner";

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const normalizedEmail = email.trim().toLowerCase();
    try {
      if (normalizedEmail === "admin@cda.com" && password === "admin123") {
        localStorage.setItem("userRole", "admin");
        localStorage.setItem("userName", "Administrador");
        localStorage.removeItem("userId");
        localStorage.removeItem("userCdaId");
        navigate("/admin", { replace: true });
        return;
      }

      if (password.length >= 6) {
        const cda = mockCDAs.find((item) =>
          item.vendedores.some((vendor) => vendor.email.toLowerCase() === normalizedEmail),
        ) ?? mockCDAs[0];
        const vendor = cda?.vendedores.find((item) => item.email.toLowerCase() === normalizedEmail)
          ?? cda?.vendedores[0];

        if (!cda || !vendor) {
          throw new Error("No hay vendedores disponibles para iniciar sesión.");
        }

        localStorage.setItem("userRole", "vendedor");
        localStorage.setItem("userName", vendor.nombre);
        localStorage.setItem("userId", String(vendor.id));
        localStorage.setItem("userCdaId", String(cda.id));
        navigate(`/cda/${cda.id}/vendedor/${vendor.id}`, { replace: true });
        return;
      }

      setError("Contraseña inválida. Usa al menos 6 caracteres.");
    } catch (loginError) {
      console.error("No se pudo iniciar sesión:", loginError);
      setError("No se pudo iniciar sesión en este navegador. Revisa el almacenamiento e inténtalo de nuevo.");
      toast.error("No se pudo iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo y Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center bg-white rounded-2xl shadow-lg mb-4 p-4">
            <img src={logo} alt="Grupo Cardisel" className="h-16 w-auto" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Sistema de Gestión</h1>
          <p className="text-blue-100">CDA Revisión Técnico Mecánica</p>
        </div>

        {/* Formulario de Login */}
        <Card className="p-6 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  placeholder="correo@ejemplo.com"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Ingresando...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  <span>Iniciar Sesión</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-center text-sm text-gray-600 mb-3">Credenciales de prueba:</p>
            <div className="space-y-2 text-xs bg-gray-50 p-3 rounded-lg">
              <div>
                <p className="font-semibold text-gray-700">Administrador:</p>
                <p className="text-gray-600">admin@cda.com / admin123</p>
              </div>
              <div>
                <p className="font-semibold text-gray-700">Vendedor:</p>
                <p className="text-gray-600">correo de prueba recomendado / mínimo 6 caracteres</p>
                <p className="text-gray-500">Otros correos válidos entran como el primer vendedor de prueba.</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Footer */}
        <p className="text-center text-blue-100 text-sm mt-6">
          © 2026 CDA Tecnomecánica. Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
}