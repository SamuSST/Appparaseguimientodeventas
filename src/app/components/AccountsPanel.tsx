import { useCallback, useEffect, useState } from "react";
import { Copy, KeyRound, Pencil, Power, RefreshCw, UserCog, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { gestionarCuenta } from "../../lib/cuentas";
import { formatearTelefono, limpiarTelefono } from "../../lib/telefono";
import { Card } from "./ui/card";

type Cuenta = {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  rol: "admin" | "vendedor";
  activo: boolean;
  debe_cambiar_password: boolean;
};

export function AccountsPanel({ onChange }: { onChange: () => void }) {
  const { perfil } = useAuth();
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [loading, setLoading] = useState(true);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [editando, setEditando] = useState<{ id: string; nombre: string; email: string; emailOriginal: string; nombreOriginal: string; telefono: string } | null>(null);
  const [nuevaPassword, setNuevaPassword] = useState<{ nombre: string; email: string; password: string; emailEnviado: boolean } | null>(null);
  const [verInactivas, setVerInactivas] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("usuarios")
      .select("id, nombre, email, telefono, rol, activo, debe_cambiar_password")
      .order("rol")
      .order("nombre");
    if (error) {
      console.error("No se pudieron cargar las cuentas:", error);
      toast.error("No se pudieron cargar las cuentas.");
    }
    setCuentas((data ?? []) as Cuenta[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const ejecutar = async (cuenta: Cuenta, accion: "desactivar" | "activar" | "reiniciar_password") => {
    const preguntas = {
      desactivar: `¿Desactivar la cuenta de ${cuenta.nombre}? No podrá entrar a la app; sus datos se conservan.`,
      activar: `¿Reactivar la cuenta de ${cuenta.nombre}?`,
      reiniciar_password: `¿Generar una contraseña temporal nueva para ${cuenta.nombre}? La actual dejará de funcionar y se le enviará la nueva por correo.`,
    };
    if (!window.confirm(preguntas[accion])) return;
    setOcupado(cuenta.id);
    try {
      const r = await gestionarCuenta(accion, cuenta.id);
      if (accion === "reiniciar_password" && r.password) {
        setNuevaPassword({ nombre: cuenta.nombre, email: cuenta.email, password: r.password, emailEnviado: !!r.emailEnviado });
        toast.success(r.emailEnviado ? "Contraseña nueva enviada por correo." : "Contraseña nueva generada; no se pudo enviar el correo.");
      } else {
        toast.success(accion === "desactivar" ? "Cuenta desactivada." : "Cuenta reactivada.");
      }
      await cargar();
      onChange();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo completar la acción.");
    } finally {
      setOcupado(null);
    }
  };

  const guardarEdicion = async () => {
    if (!editando) return;
    const telefono = editando.telefono.trim() ? limpiarTelefono(editando.telefono) : null;
    if (editando.telefono.trim() && !telefono) {
      toast.error("Revisa el teléfono (7 a 10 dígitos).");
      return;
    }
    setOcupado(editando.id);
    try {
      // Nombre y correo cambian también en la autenticación (función); el teléfono solo vive en la tabla usuarios.
      if (editando.nombre.trim() !== editando.nombreOriginal || editando.email.trim().toLowerCase() !== editando.emailOriginal) {
        await gestionarCuenta("editar", editando.id, { nombre: editando.nombre, email: editando.email });
      }
      const { error } = await supabase.from("usuarios").update({ telefono }).eq("id", editando.id);
      if (error) throw new Error("No se pudo guardar el teléfono.");
      toast.success("Cuenta actualizada.");
      setEditando(null);
      await cargar();
      onChange();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar la cuenta.");
    } finally {
      setOcupado(null);
    }
  };

  const visibles = verInactivas ? cuentas : cuentas.filter((c) => c.activo);
  const inputClass =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200";

  return (
    <Card className="space-y-5 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-slate-100 p-3 text-slate-700">
            <UserCog className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Cuentas</h2>
            <p className="mt-1 text-sm text-gray-500">Corrige datos, genera una contraseña nueva o desactiva el acceso.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void cargar()}
          className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-50"
          title="Actualizar"
          aria-label="Actualizar cuentas"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-600">
        <input type="checkbox" checked={verInactivas} onChange={(e) => setVerInactivas(e.target.checked)} />
        Mostrar cuentas desactivadas
      </label>

      {nuevaPassword && (
        <div className="space-y-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-green-900">Contraseña nueva de {nuevaPassword.nombre}</p>
            <button type="button" onClick={() => setNuevaPassword(null)} aria-label="Cerrar" className="text-green-800">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded bg-white px-2 py-1 font-mono text-green-950">{nuevaPassword.password}</code>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(nuevaPassword.password).then(
                  () => toast.success("Contraseña copiada."),
                  () => toast.error("No se pudo copiar."),
                );
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-green-300 px-3 py-1 font-medium text-green-900 hover:bg-green-100"
            >
              <Copy className="h-4 w-4" /> Copiar
            </button>
          </div>
          <p className="text-xs text-green-800">
            {nuevaPassword.emailEnviado
              ? `También se envió a ${nuevaPassword.email}. Deberá cambiarla al ingresar.`
              : "No se pudo enviar el correo: entrégala de forma segura. Deberá cambiarla al ingresar."}
          </p>
        </div>
      )}

      {loading ? (
        <p className="py-4 text-center text-sm text-gray-500">Cargando cuentas...</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {visibles.map((c) => {
            const soyYo = c.id === perfil?.id;
            const enEdicion = editando?.id === c.id;
            return (
              <li key={c.id} className={`py-3 ${c.activo ? "" : "opacity-70"}`}>
                {enEdicion ? (
                  <div className="grid gap-2 sm:grid-cols-[1fr_1fr_10rem_auto_auto] sm:items-end">
                    <label className="text-xs text-gray-600">
                      Nombre
                      <input value={editando.nombre} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} className={`mt-1 ${inputClass}`} />
                    </label>
                    <label className="text-xs text-gray-600">
                      Correo
                      <input type="email" value={editando.email} onChange={(e) => setEditando({ ...editando, email: e.target.value })} className={`mt-1 ${inputClass}`} />
                    </label>
                    <label className="text-xs text-gray-600">
                      Celular
                      <input type="tel" inputMode="tel" value={editando.telefono} onChange={(e) => setEditando({ ...editando, telefono: e.target.value })} className={`mt-1 ${inputClass}`} placeholder="300 123 4567" />
                    </label>
                    <button
                      type="button"
                      onClick={() => void guardarEdicion()}
                      disabled={ocupado === c.id}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      Guardar
                    </button>
                    <button type="button" onClick={() => setEditando(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-900">
                        {c.nombre} {soyYo && <span className="text-xs text-gray-500">(tú)</span>}
                      </p>
                      <p className="truncate text-xs text-gray-500">
                        {c.email}
                        {c.telefono ? ` · ${formatearTelefono(c.telefono)}` : " · sin celular"}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{c.rol === "admin" ? "Administrador" : "Vendedor"}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${c.activo ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                          {c.activo ? "Activa" : "Desactivada"}
                        </span>
                        {c.debe_cambiar_password && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Con contraseña temporal</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setEditando({ id: c.id, nombre: c.nombre, email: c.email, nombreOriginal: c.nombre, emailOriginal: c.email, telefono: c.telefono ?? "" })
                        }
                        disabled={ocupado !== null}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => void ejecutar(c, "reiniciar_password")}
                        disabled={ocupado !== null || !c.activo}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                      >
                        <KeyRound className="h-3.5 w-3.5" /> Contraseña nueva
                      </button>
                      {!soyYo && (
                        <button
                          type="button"
                          onClick={() => void ejecutar(c, c.activo ? "desactivar" : "activar")}
                          disabled={ocupado !== null}
                          className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-60 ${
                            c.activo ? "border-red-200 text-red-700 hover:bg-red-50" : "border-green-200 text-green-700 hover:bg-green-50"
                          }`}
                        >
                          <Power className="h-3.5 w-3.5" /> {c.activo ? "Desactivar" : "Reactivar"}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
