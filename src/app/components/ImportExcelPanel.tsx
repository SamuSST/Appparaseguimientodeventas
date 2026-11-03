import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Copy, FileSpreadsheet, History, RotateCcw, Upload, UserPlus, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { crearCuenta, generarPasswordTemporal } from "../../lib/cuentas";
import { correoAlias, leerExcel, normalizar, type ResultadoLectura } from "../../lib/importarAtenciones";
import { Card } from "./ui/card";

const LOTE = 500;
const CORREO_BASE = "cda37.notificaciones@gmail.com";

type Vendedor = { id: string; nombre: string };
type CuentaNueva = { nombre: string; email: string; password: string; emailEnviado: boolean };
type Carga = {
  id: number;
  nombre_archivo: string;
  fecha_carga: string;
  filas_leidas: number | null;
  filas_con_error: number | null;
  estado: "procesando" | "completada" | "con_errores" | "revertida";
  atenciones: number;
};

const etiquetaEstado: Record<Carga["estado"], { texto: string; clase: string }> = {
  procesando: { texto: "Procesando", clase: "bg-blue-100 text-blue-800" },
  completada: { texto: "Completada", clase: "bg-green-100 text-green-800" },
  con_errores: { texto: "Con filas omitidas", clase: "bg-amber-100 text-amber-800" },
  revertida: { texto: "Deshecha", clase: "bg-gray-200 text-gray-700" },
};

export function ImportExcelPanel({ onImported }: { onImported: () => void }) {
  const { perfil } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [lectura, setLectura] = useState<ResultadoLectura | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [correoBase, setCorreoBase] = useState(CORREO_BASE);
  const [creando, setCreando] = useState(false);
  const [cuentasNuevas, setCuentasNuevas] = useState<CuentaNueva[]>([]);
  const [progreso, setProgreso] = useState<{ hechas: number; total: number } | null>(null);
  const [cargas, setCargas] = useState<Carga[]>([]);
  const [deshaciendo, setDeshaciendo] = useState<number | null>(null);

  const cargarVendedores = useCallback(async () => {
    const { data, error } = await supabase.from("usuarios").select("id, nombre").eq("rol", "vendedor");
    if (error) {
      console.error("No se pudieron cargar los vendedores:", error);
      toast.error("No se pudieron cargar los vendedores.");
      return;
    }
    setVendedores(data ?? []);
  }, []);

  const cargarHistorial = useCallback(async () => {
    const { data, error } = await supabase
      .from("cargas_excel")
      .select("id, nombre_archivo, fecha_carga, filas_leidas, filas_con_error, estado")
      .order("fecha_carga", { ascending: false })
      .limit(10);
    if (error) {
      console.error("No se pudo cargar el historial de cargas:", error);
      return;
    }
    const conConteo = await Promise.all(
      (data ?? []).map(async (c) => {
        const { count } = await supabase.from("atenciones").select("id", { count: "exact", head: true }).eq("carga_id", c.id);
        return { ...c, atenciones: count ?? 0 } as Carga;
      }),
    );
    setCargas(conConteo);
  }, []);

  useEffect(() => {
    void cargarVendedores();
    void cargarHistorial();
  }, [cargarVendedores, cargarHistorial]);

  const idPorNombre = useMemo(() => new Map(vendedores.map((v) => [normalizar(v.nombre), v.id])), [vendedores]);

  const resumen = useMemo(() => {
    if (!lectura) return null;
    const porVendedor = new Map<string, number>();
    lectura.filas.forEach((f) => porVendedor.set(f.vendedor, (porVendedor.get(f.vendedor) ?? 0) + 1));
    const nombres = [...porVendedor.keys()].sort((a, b) => a.localeCompare(b, "es"));
    const fechas = lectura.filas.map((f) => f.fecha).sort();
    return {
      porVendedor,
      encontrados: nombres.filter((n) => idPorNombre.has(normalizar(n))),
      faltantes: nombres.filter((n) => !idPorNombre.has(normalizar(n))),
      desde: fechas[0],
      hasta: fechas[fechas.length - 1],
      reinspecciones: lectura.filas.filter((f) => f.tipo_revision === "Reinspección").length,
    };
  }, [lectura, idPorNombre]);

  const elegirArchivo = async (file?: File) => {
    if (!file) return;
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      toast.error("Selecciona un archivo Excel (.xlsx o .xls).");
      return;
    }
    setArchivo(file);
    setLectura(null);
    setCuentasNuevas([]);
    setLeyendo(true);
    try {
      setLectura(await leerExcel(file));
    } catch (error) {
      console.error("No se pudo leer el Excel:", error);
      toast.error(error instanceof Error ? error.message : "No se pudo leer el archivo.");
      setArchivo(null);
    } finally {
      setLeyendo(false);
    }
  };

  const crearFaltantes = async () => {
    if (!resumen?.faltantes.length) return;
    if (!/^[^\s@+]+@[^\s@]+\.[^\s@]+$/.test(correoBase.trim())) {
      toast.error("Escribe un correo base válido, sin '+'.");
      return;
    }
    setCreando(true);
    const creadas: CuentaNueva[] = [];
    try {
      for (const nombre of resumen.faltantes) {
        const email = correoAlias(correoBase, nombre);
        const password = generarPasswordTemporal();
        const cuenta = await crearCuenta({ nombre, email, rol: "vendedor", password });
        creadas.push({ nombre, email: cuenta.email, password, emailEnviado: cuenta.emailEnviado });
        setCuentasNuevas([...creadas]);
      }
      toast.success(`Se crearon ${creadas.length} cuentas de vendedor.`);
    } catch (error) {
      console.error("No se pudieron crear todas las cuentas:", error);
      toast.error(
        `Se crearon ${creadas.length} de ${resumen.faltantes.length} cuentas. ${error instanceof Error ? error.message : ""}`,
      );
    } finally {
      setCreando(false);
      await cargarVendedores();
    }
  };

  const copiarCuentas = async () => {
    const texto = cuentasNuevas.map((c) => `${c.nombre}\t${c.email}\t${c.password}`).join("\n");
    try {
      await navigator.clipboard.writeText(`Vendedor\tCorreo\tContraseña temporal\n${texto}`);
      toast.success("Cuentas copiadas. Puedes pegarlas en Excel.");
    } catch {
      toast.error("No se pudo copiar.");
    }
  };

  const guardar = async () => {
    if (!lectura || !archivo || !perfil || !resumen || resumen.faltantes.length) return;
    const filas = lectura.filas;
    setProgreso({ hechas: 0, total: filas.length });

    let cargaId: number | null = null;
    try {
      const { data: carga, error: cargaError } = await supabase
        .from("cargas_excel")
        .insert({
          nombre_archivo: archivo.name,
          cargado_por: perfil.id,
          filas_leidas: lectura.totalFilas,
          filas_con_error: lectura.errores.length,
          estado: "procesando",
        })
        .select("id")
        .single();
      if (cargaError) throw cargaError;
      cargaId = carga.id;

      if (lectura.errores.length) {
        const { error } = await supabase
          .from("errores_carga")
          .insert(lectura.errores.slice(0, 1000).map((e) => ({ carga_id: cargaId, numero_fila: e.fila, motivo: e.motivo })));
        if (error) console.error("No se pudieron guardar los errores de la carga:", error);
      }

      let insertadas = 0;
      for (let i = 0; i < filas.length; i += LOTE) {
        const lote = filas.slice(i, i + LOTE).map(({ vendedor, ...f }) => ({
          ...f,
          vendedor_id: idPorNombre.get(normalizar(vendedor)),
          carga_id: cargaId,
        }));
        // Si una atención ya existe (misma fecha, placa y revisión) se omite: subir dos veces el mismo Excel no duplica.
        const { data, error } = await supabase
          .from("atenciones")
          .upsert(lote, { onConflict: "fecha,placa,tipo_revision", ignoreDuplicates: true })
          .select("id");
        if (error) throw error;
        insertadas += data?.length ?? 0;
        setProgreso({ hechas: Math.min(i + LOTE, filas.length), total: filas.length });
      }

      const { error: finError } = await supabase
        .from("cargas_excel")
        .update({ estado: lectura.errores.length ? "con_errores" : "completada" })
        .eq("id", cargaId);
      if (finError) throw finError;

      const repetidas = filas.length - insertadas;
      toast.success(
        `Se guardaron ${insertadas.toLocaleString("es-CO")} atenciones${repetidas ? ` (${repetidas.toLocaleString("es-CO")} ya existían y se omitieron)` : ""}.`,
      );
      setArchivo(null);
      setLectura(null);
      onImported();
    } catch (error) {
      console.error("No se pudo completar la carga:", error);
      // Si falla a mitad de camino, se borra lo que alcanzó a entrar para no dejar datos a medias.
      if (cargaId !== null) {
        await supabase.from("atenciones").delete().eq("carga_id", cargaId);
        await supabase.from("cargas_excel").update({ estado: "revertida" }).eq("id", cargaId);
      }
      toast.error("La carga falló y se deshizo. No quedaron datos a medias. Inténtalo de nuevo.");
    } finally {
      setProgreso(null);
      await cargarHistorial();
    }
  };

  const deshacer = async (carga: Carga) => {
    const ok = window.confirm(
      `¿Deshacer la carga "${carga.nombre_archivo}"? Se borrarán ${carga.atenciones.toLocaleString("es-CO")} atenciones de Supabase.`,
    );
    if (!ok) return;
    setDeshaciendo(carga.id);
    try {
      const { error } = await supabase.from("atenciones").delete().eq("carga_id", carga.id);
      if (error) throw error;
      const { error: estadoError } = await supabase.from("cargas_excel").update({ estado: "revertida" }).eq("id", carga.id);
      if (estadoError) throw estadoError;
      toast.success("Carga deshecha. Las atenciones de ese archivo se borraron.");
      onImported();
    } catch (error) {
      console.error("No se pudo deshacer la carga:", error);
      toast.error("No se pudo deshacer la carga.");
    } finally {
      setDeshaciendo(null);
      await cargarHistorial();
    }
  };

  const subiendo = progreso !== null;

  return (
    <Card className="space-y-5 p-5 sm:p-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Importar ventas desde Excel</h2>
        <p className="mt-1 text-sm text-gray-500">
          Sube el archivo de atenciones (hoja "Atenciones"). Se revisa antes de guardar y cada carga se puede deshacer.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastrando(false);
          void elegirArchivo(e.dataTransfer.files[0]);
        }}
        className={`flex flex-col items-center rounded-xl border-2 border-dashed px-5 py-8 text-center transition-colors ${
          arrastrando ? "border-blue-500 bg-blue-50" : "border-blue-200 bg-blue-50/50"
        }`}
      >
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700">
          <FileSpreadsheet className="h-6 w-6" />
        </div>
        <p className="font-semibold text-gray-900">{archivo ? archivo.name : "Arrastra aquí tu archivo Excel"}</p>
        <p className="mt-1 text-sm text-gray-500">Formatos admitidos: .xlsx y .xls</p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            void elegirArchivo(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={leyendo || subiendo}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          <Upload className="h-4 w-4" />
          {leyendo ? "Leyendo archivo..." : archivo ? "Elegir otro archivo" : "Seleccionar archivo"}
        </button>
      </div>

      {lectura && resumen && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Atenciones válidas</p>
              <p className="text-xl font-bold text-gray-900">{lectura.filas.length.toLocaleString("es-CO")}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Reinspecciones</p>
              <p className="text-xl font-bold text-gray-900">{resumen.reinspecciones.toLocaleString("es-CO")}</p>
            </div>
            <div className={`rounded-lg p-3 ${lectura.errores.length ? "bg-amber-50" : "bg-gray-50"}`}>
              <p className="text-xs text-gray-500">Filas con error</p>
              <p className="text-xl font-bold text-gray-900">{lectura.errores.length}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Fechas</p>
              <p className="text-sm font-bold text-gray-900">
                {resumen.desde ?? "—"} a {resumen.hasta ?? "—"}
              </p>
            </div>
          </div>

          {lectura.errores.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-semibold">Estas filas no se van a guardar:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {lectura.errores.slice(0, 8).map((e) => (
                  <li key={e.fila}>
                    Fila {e.fila}: {e.motivo}
                  </li>
                ))}
              </ul>
              {lectura.errores.length > 8 && <p className="mt-1 text-xs">…y {lectura.errores.length - 8} más.</p>}
            </div>
          )}

          <div>
            <p className="mb-2 text-sm font-semibold text-gray-900">Vendedores en el archivo</p>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {[...resumen.encontrados, ...resumen.faltantes].map((nombre) => {
                const tiene = idPorNombre.has(normalizar(nombre));
                return (
                  <li key={nombre} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      {tiene ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 shrink-0 text-red-500" />
                      )}
                      <span className="truncate">{nombre}</span>
                    </span>
                    <span className="shrink-0 text-xs text-gray-500">{resumen.porVendedor.get(nombre)?.toLocaleString("es-CO")}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          {resumen.faltantes.length > 0 && (
            <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-900">
                <strong>{resumen.faltantes.length}</strong> vendedores no tienen cuenta. Créalas para poder guardar sus atenciones.
                Cada uno recibe un correo con alias del correo base, por ejemplo{" "}
                <span className="font-mono">{correoAlias(correoBase || CORREO_BASE, resumen.faltantes[0])}</span>.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <label className="flex-1 text-xs text-red-900">
                  Correo base
                  <input
                    type="email"
                    value={correoBase}
                    onChange={(e) => setCorreoBase(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void crearFaltantes()}
                  disabled={creando}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  <UserPlus className="h-4 w-4" />
                  {creando ? `Creando ${cuentasNuevas.length + 1} de ${resumen.faltantes.length}...` : `Crear ${resumen.faltantes.length} cuentas`}
                </button>
              </div>
            </div>
          )}

          {cuentasNuevas.length > 0 && (
            <div className="space-y-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-green-900">Cuentas creadas</p>
                <button
                  type="button"
                  onClick={() => void copiarCuentas()}
                  className="inline-flex items-center gap-1 rounded-lg border border-green-300 px-3 py-1 font-medium text-green-900 hover:bg-green-100"
                >
                  <Copy className="h-4 w-4" /> Copiar todas
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-left">
                  <tbody className="divide-y divide-green-100">
                    {cuentasNuevas.map((c) => (
                      <tr key={c.email}>
                        <td className="py-1.5 pr-3 font-medium text-green-950">{c.nombre}</td>
                        <td className="py-1.5 pr-3 text-green-900">{c.email}</td>
                        <td className="py-1.5 font-mono text-green-950">{c.password}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-green-800">
                Los datos de acceso también se enviaron por correo. Cada persona deberá cambiar su contraseña al ingresar.
              </p>
            </div>
          )}

          {progreso ? (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-700">
                <span>Guardando en Supabase...</span>
                <span>
                  {progreso.hechas.toLocaleString("es-CO")} / {progreso.total.toLocaleString("es-CO")}
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-gray-200">
                <div className="h-full bg-blue-600 transition-all" style={{ width: `${(progreso.hechas / progreso.total) * 100}%` }} />
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void guardar()}
              disabled={resumen.faltantes.length > 0 || lectura.filas.length === 0 || creando}
              className="w-full rounded-lg bg-green-600 px-4 py-3 font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {resumen.faltantes.length > 0
                ? "Crea las cuentas faltantes para continuar"
                : `Guardar ${lectura.filas.length.toLocaleString("es-CO")} atenciones en Supabase`}
            </button>
          )}
        </div>
      )}

      <div className="border-t pt-4">
        <div className="mb-3 flex items-center gap-2">
          <History className="h-4 w-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-900">Cargas anteriores</h3>
        </div>
        {cargas.length === 0 ? (
          <p className="text-sm text-gray-500">Todavía no se ha subido ningún archivo.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {cargas.map((c) => (
              <li key={c.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">{c.nombre_archivo}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(c.fecha_carga).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })} ·{" "}
                    {c.atenciones.toLocaleString("es-CO")} atenciones guardadas
                    {c.filas_con_error ? ` · ${c.filas_con_error} filas omitidas` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${etiquetaEstado[c.estado].clase}`}>
                    {etiquetaEstado[c.estado].texto}
                  </span>
                  {c.estado !== "revertida" && c.estado !== "procesando" && (
                    <button
                      type="button"
                      onClick={() => void deshacer(c)}
                      disabled={deshaciendo !== null || subiendo}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      {deshaciendo === c.id ? "Deshaciendo..." : "Deshacer"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
