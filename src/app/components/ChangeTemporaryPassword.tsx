import { useState } from "react";
import { useNavigate } from "react-router";
import { KeyRound, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../lib/auth";
import { Card } from "./ui/card";

export function ChangeTemporaryPassword() {
  const navigate = useNavigate();
  const { perfil, changeTemporaryPassword, signOut } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirmation) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }

    setSaving(true);
    try {
      await changeTemporaryPassword(password);
      toast.success("Contraseña actualizada.");
      navigate(perfil?.rol === "admin" ? "/admin" : `/vendedor/${perfil?.id}`, { replace: true });
    } catch (error) {
      console.error("No se pudo actualizar la contraseña temporal:", error);
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar la contraseña.");
    } finally {
      setSaving(false);
    }
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

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-700 to-blue-950 p-4">
      <Card className="w-full max-w-md space-y-5 p-6">
        <div>
          <div className="mb-3 inline-flex rounded-xl bg-blue-100 p-3 text-blue-700">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Crea tu contraseña</h1>
          <p className="mt-2 text-sm text-gray-600">
            Hola{perfil?.nombre ? `, ${perfil.nombre}` : ""}. Por seguridad, cambia la contraseña temporal para continuar.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="new-password" className="mb-1 block text-sm font-medium text-gray-700">
              Nueva contraseña
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
            <p className="mt-1 text-xs text-gray-500">Usa al menos 8 caracteres.</p>
          </div>
          <div>
            <label htmlFor="confirm-password" className="mb-1 block text-sm font-medium text-gray-700">
              Confirma tu nueva contraseña
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Guardando..." : "Guardar contraseña y continuar"}
          </button>
        </form>

        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </Card>
    </main>
  );
}
