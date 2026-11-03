import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Card } from "./ui/card";
import { ArrowLeft, Mail, Lock, Eye, EyeOff, LogIn, Send } from "lucide-react";
import logo from "figma:asset/9b6752e4935d81eb0c34c840e006a7ba641d4c8e.png";
import { toast } from "sonner";
import { useAuth, mensajeDeError } from "../../lib/auth";
import { supabase } from "../../lib/supabase";

export function Login() {
  const navigate = useNavigate();
  const { signIn, perfil, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [recuperando, setRecuperando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    if (authLoading || !perfil) return;
    navigate(
      perfil.debe_cambiar_password
        ? "/cambiar-password"
        : perfil.rol === "admin"
          ? "/admin"
          : `/vendedor/${perfil.id}`,
      { replace: true },
    );
  }, [authLoading, navigate, perfil]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Supabase valida correo y contraseña, y auth.tsx carga el perfil
      // (nombre y rol) desde la tabla "usuarios".
      const perfil = await signIn(email.trim().toLowerCase(), password);

      navigate(
        perfil.debe_cambiar_password
          ? "/cambiar-password"
          : perfil.rol === "admin"
            ? "/admin"
            : `/vendedor/${perfil.id}`,
        { replace: true },
      );
    } catch (loginError) {
      console.error("No se pudo iniciar sesión:", loginError);
      const mensaje = mensajeDeError(loginError);
      setError(mensaje);
      toast.error(mensaje);
    } finally {
      setLoading(false);
    }
  };

  const handleRecuperar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: fnError } = await supabase.functions.invoke("recuperar-password", {
        body: { email: email.trim().toLowerCase() },
      });
      if (fnError) throw fnError;
      setEnviado(true);
    } catch (recuperarError) {
      console.error("No se pudo solicitar la contraseña nueva:", recuperarError);
      setError("No se pudo enviar la solicitud. Revisa el correo e inténtalo de nuevo.");
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
          {recuperando ? (
            <form onSubmit={handleRecuperar} className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Recuperar contraseña</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Escribe el correo de tu cuenta. Te enviaremos una contraseña temporal para entrar y crear una nueva.
                </p>
              </div>
              {enviado ? (
                <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                  Si el correo tiene una cuenta activa, te enviamos una contraseña temporal. Revisa tu bandeja de entrada y la
                  carpeta de spam. Si no llega en unos minutos, pídele ayuda al administrador.
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 py-3 pl-10 pr-4 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-blue-500"
                      placeholder="correo@ejemplo.com"
                      aria-label="Correo de tu cuenta"
                      required
                    />
                  </div>
                  {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 font-semibold text-white shadow-lg transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Send className="h-5 w-5" />
                    {loading ? "Enviando..." : "Enviarme una contraseña temporal"}
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  setRecuperando(false);
                  setEnviado(false);
                  setError("");
                }}
                className="flex w-full items-center justify-center gap-2 text-sm font-medium text-blue-700 hover:underline"
              >
                <ArrowLeft className="h-4 w-4" /> Volver a iniciar sesión
              </button>
            </form>
          ) : (
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
            <button
              type="button"
              onClick={() => {
                setRecuperando(true);
                setError("");
              }}
              className="w-full text-center text-sm font-medium text-blue-700 hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </form>
          )}
        </Card>

        {/* Footer */}
        <p className="text-center text-blue-100 text-sm mt-6">
          © 2026 CDA Tecnomecánica. Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
}
