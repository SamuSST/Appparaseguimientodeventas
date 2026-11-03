import { useState } from "react";
import { KeyRound, MailCheck, MailWarning, RefreshCw, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { crearCuenta, generarPasswordTemporal, type CuentaCreada, type Rol as Role } from "../../lib/cuentas";
import { Card } from "./ui/card";

type CreatedAccount = CuentaCreada & {
  passwordTemporal: string;
};

export function CreateAccountPanel() {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<Role>("vendedor");
  const [password, setPassword] = useState(generarPasswordTemporal);
  const [createdAccount, setCreatedAccount] = useState<CreatedAccount | null>(null);
  const [saving, setSaving] = useState(false);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setCreatedAccount(null);

    try {
      const data = await crearCuenta({ nombre, email, rol, password });

      setCreatedAccount({ ...data, passwordTemporal: password });
      setNombre("");
      setEmail("");
      setPassword(generarPasswordTemporal());
      if (data.emailEnviado) {
        toast.success(`La cuenta se creó y se enviaron los datos de acceso a ${data.email}.`);
      } else {
        toast.warning("La cuenta se creó, pero no se pudo enviar el correo. Entrega la contraseña manualmente.");
      }
    } catch (error) {
      console.error("No se pudo crear la cuenta:", error);
      toast.error(error instanceof Error ? error.message : "No se pudo crear la cuenta.");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyPassword = async () => {
    try {
      await navigator.clipboard.writeText(createdAccount?.passwordTemporal ?? "");
      toast.success("Contraseña copiada.");
    } catch (error) {
      console.error("No se pudo copiar la contraseña temporal:", error);
      toast.error("No se pudo copiar la contraseña.");
    }
  };

  return (
    <Card className="space-y-5 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-blue-100 p-3 text-blue-700">
          <UserPlus className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">Crear una cuenta</h2>
          <p className="mt-1 text-sm text-gray-500">
            Crea acceso de vendedor o administrador. La persona recibirá un correo con su cuenta y una contraseña
            temporal, que deberá cambiar al ingresar.
          </p>
        </div>
      </div>

      <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="account-name" className="mb-1 block text-sm font-medium text-gray-700">
            Nombre completo
          </label>
          <input
            id="account-name"
            autoComplete="name"
            required
            maxLength={120}
            value={nombre}
            onChange={(event) => setNombre(event.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </div>
        <div>
          <label htmlFor="account-email" className="mb-1 block text-sm font-medium text-gray-700">
            Correo electrónico
          </label>
          <input
            id="account-email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </div>
        <div>
          <label htmlFor="account-role" className="mb-1 block text-sm font-medium text-gray-700">
            Tipo de cuenta
          </label>
          <select
            id="account-role"
            value={rol}
            onChange={(event) => setRol(event.target.value as Role)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          >
            <option value="vendedor">Vendedor</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
        <div>
          <label htmlFor="temporary-password" className="mb-1 block text-sm font-medium text-gray-700">
            Contraseña temporal
          </label>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                id="temporary-password"
                type="text"
                autoComplete="off"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 font-mono text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <button
              type="button"
              onClick={() => setPassword(generarPasswordTemporal())}
              className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-50"
              title="Generar otra contraseña"
              aria-label="Generar otra contraseña temporal"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2"
        >
          {saving ? "Creando cuenta y enviando correo..." : "Crear cuenta y enviar correo"}
        </button>
      </form>

      {createdAccount && (
        <div className="space-y-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm">
          <p className="font-semibold text-green-900">
            Cuenta creada: {createdAccount.nombre} ({createdAccount.rol === "admin" ? "Administrador" : "Vendedor"})
          </p>
          <p className="text-green-800">Correo: {createdAccount.email}</p>
          {createdAccount.emailEnviado ? (
            <p className="flex items-center gap-2 text-green-800">
              <MailCheck className="h-4 w-4" />
              Se enviaron los datos de acceso a {createdAccount.email}.
            </p>
          ) : (
            <p className="flex items-center gap-2 rounded-lg bg-amber-100 px-3 py-2 text-amber-900">
              <MailWarning className="h-4 w-4 shrink-0" />
              No se pudo enviar el correo. Entrega la contraseña temporal de forma segura.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-green-900">Contraseña temporal:</span>
            <code className="rounded bg-white px-2 py-1 font-mono text-green-950">{createdAccount.passwordTemporal}</code>
            <button
              type="button"
              onClick={handleCopyPassword}
              className="rounded-lg border border-green-300 px-3 py-1 font-medium text-green-900 hover:bg-green-100"
            >
              Copiar
            </button>
          </div>
          <p className="text-xs text-green-800">
            Entrégala de forma segura. Solo se muestra en esta pantalla; la persona deberá crear una nueva al ingresar.
          </p>
        </div>
      )}
    </Card>
  );
}
