import * as XLSX from "xlsx";

// Fila lista para insertar en la tabla `atenciones` (sin vendedor_id ni carga_id).
export type AtencionImportada = {
  vendedor: string;
  fecha: string;
  hora: string | null;
  cliente_nombre: string | null;
  placa: string;
  marca: string | null;
  vehiculo: string | null;
  tipo_vehiculo: "carro" | "moto" | "pesado";
  electrico: boolean;
  tipo_revision: "RTM" | "Preventiva" | "Reinspección";
  tipo_servicio: "particular" | "publico" | null;
  tiempo_atencion_min: number | null;
  resultado: "Aprobada" | "Rechazada" | null;
  fecha_limite_reinspeccion: string | null;
  estado_reinspeccion: "Realizada" | "En plazo" | "Vencida" | null;
  ingreso: number | null;
  pagado: boolean;
};

export type ErrorFila = { fila: number; motivo: string };

export type ResultadoLectura = {
  hoja: string;
  filas: AtencionImportada[];
  errores: ErrorFila[];
  totalFilas: number;
};

export const COLUMNAS_REQUERIDAS = ["fecha", "vendedor", "placa", "tipo_vehiculo", "tipo_revision"];

export function normalizar(valor: unknown) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

function texto(valor: unknown) {
  const limpio = String(valor ?? "").trim();
  return limpio ? limpio : null;
}

function dos(n: number) {
  return String(n).padStart(2, "0");
}

// Excel guarda fechas como número de serie; también se aceptan AAAA-MM-DD y DD/MM/AAAA.
function leerFecha(valor: unknown): string | null {
  if (valor === null || valor === undefined || valor === "") return null;
  if (typeof valor === "number") {
    const f = XLSX.SSF.parse_date_code(valor);
    return f ? `${f.y}-${dos(f.m)}-${dos(f.d)}` : null;
  }
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return `${valor.getFullYear()}-${dos(valor.getMonth() + 1)}-${dos(valor.getDate())}`;
  }
  const s = String(valor).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${dos(Number(m[2]))}-${dos(Number(m[3]))}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${dos(Number(m[2]))}-${dos(Number(m[1]))}`;
  return null;
}

function leerHora(valor: unknown): string | null {
  if (valor === null || valor === undefined || valor === "") return null;
  if (typeof valor === "number") {
    const f = XLSX.SSF.parse_date_code(valor);
    return f ? `${dos(f.H)}:${dos(f.M)}` : null;
  }
  const m = String(valor).trim().match(/^(\d{1,2}):(\d{2})/);
  return m && Number(m[1]) < 24 ? `${dos(Number(m[1]))}:${m[2]}` : null;
}

function leerNumero(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = typeof valor === "number" ? valor : Number(String(valor).replace(/[$\s.]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

function convertirFila(raw: Record<string, unknown>): { fila?: AtencionImportada; motivo?: string } {
  const fecha = leerFecha(raw.fecha);
  if (!fecha) return { motivo: "Fecha vacía o con formato inválido" };
  const vendedor = texto(raw.vendedor);
  if (!vendedor) return { motivo: "Falta el vendedor" };
  const placa = texto(raw.placa)?.toUpperCase().replace(/\s+/g, "");
  if (!placa) return { motivo: "Falta la placa" };

  const vehiculo = normalizar(raw.tipo_vehiculo);
  const tipo_vehiculo = vehiculo.startsWith("moto")
    ? "moto"
    : vehiculo.startsWith("pesado")
      ? "pesado"
      : vehiculo.startsWith("liviano") || vehiculo.startsWith("carro")
        ? "carro"
        : null;
  if (!tipo_vehiculo) return { motivo: `Tipo de vehículo no reconocido: "${raw.tipo_vehiculo ?? ""}"` };

  const revision = normalizar(raw.tipo_revision);
  const tipo_revision = revision === "rtm" ? "RTM" : revision === "preventiva" ? "Preventiva" : revision === "reinspeccion" ? "Reinspección" : null;
  if (!tipo_revision) return { motivo: `Tipo de revisión no reconocido: "${raw.tipo_revision ?? ""}"` };

  const servicio = normalizar(raw.tipo_servicio);
  const tipo_servicio = servicio === "particular" ? "particular" : servicio === "publico" ? "publico" : null;
  if (servicio && !tipo_servicio) return { motivo: `Tipo de servicio no reconocido: "${raw.tipo_servicio}"` };

  const res = normalizar(raw.resultado);
  const resultado = res === "aprobada" ? "Aprobada" : res === "rechazada" ? "Rechazada" : null;

  const est = normalizar(raw.estado_reinspeccion);
  const estado_reinspeccion = est === "realizada" ? "Realizada" : est === "en plazo" ? "En plazo" : est === "vencida" ? "Vencida" : null;

  const ingreso = leerNumero(raw.ingreso);
  if (Number.isNaN(ingreso) || (ingreso !== null && ingreso < 0)) return { motivo: "El ingreso debe ser un número mayor o igual a cero" };
  const tiempo = leerNumero(raw.tiempo_atencion_min);
  if (Number.isNaN(tiempo) || (tiempo !== null && tiempo < 0)) return { motivo: "El tiempo de atención debe ser un número de minutos" };

  // Las reinspecciones son gratis: "No aplica" cuenta como pagado.
  const pag = normalizar(raw.pagado);
  const pagado = !(pag === "no" || pag === "false" || pag === "0");

  return {
    fila: {
      vendedor,
      fecha,
      hora: leerHora(raw.hora),
      cliente_nombre: texto(raw.cliente_nombre),
      placa,
      marca: texto(raw.marca),
      vehiculo: texto(raw.vehiculo),
      tipo_vehiculo,
      electrico: vehiculo.includes("electrico"),
      tipo_revision,
      tipo_servicio,
      tiempo_atencion_min: tiempo === null ? null : Math.round(tiempo),
      resultado,
      fecha_limite_reinspeccion: leerFecha(raw.fecha_limite_reinspeccion),
      estado_reinspeccion,
      ingreso,
      pagado,
    },
  };
}

export async function leerExcel(archivo: File): Promise<ResultadoLectura> {
  const libro = XLSX.read(await archivo.arrayBuffer(), { type: "array" });
  const hoja = libro.SheetNames.includes("Atenciones") ? "Atenciones" : libro.SheetNames[0];
  if (!hoja) throw new Error("El archivo no tiene hojas.");

  const crudas = XLSX.utils.sheet_to_json<Record<string, unknown>>(libro.Sheets[hoja], { raw: true, defval: null });
  if (crudas.length === 0) throw new Error(`La hoja "${hoja}" no tiene filas.`);

  // Encabezados sin importar mayúsculas, tildes ni espacios.
  const filasNormalizadas = crudas.map((fila) =>
    Object.fromEntries(Object.entries(fila).map(([k, v]) => [normalizar(k).replace(/\s+/g, "_"), v])),
  );
  const faltantes = COLUMNAS_REQUERIDAS.filter((c) => !(c in filasNormalizadas[0]));
  if (faltantes.length) throw new Error(`Faltan estas columnas en la hoja "${hoja}": ${faltantes.join(", ")}`);

  const filas: AtencionImportada[] = [];
  const errores: ErrorFila[] = [];
  const vistas = new Set<string>();
  filasNormalizadas.forEach((raw, i) => {
    const numero = i + 2; // fila 1 = encabezados
    const { fila, motivo } = convertirFila(raw);
    if (!fila) {
      errores.push({ fila: numero, motivo: motivo ?? "Fila inválida" });
      return;
    }
    const clave = `${fila.fecha}|${fila.placa}|${fila.tipo_revision}`;
    if (vistas.has(clave)) {
      errores.push({ fila: numero, motivo: `Repetida: la placa ${fila.placa} ya tiene ${fila.tipo_revision} el ${fila.fecha}` });
      return;
    }
    vistas.add(clave);
    filas.push(fila);
  });

  return { hoja, filas, errores, totalFilas: crudas.length };
}

// Correo con alias de Gmail: base+nombre.apellido@dominio (todos llegan a la misma bandeja).
export function correoAlias(base: string, nombre: string) {
  const [usuario, dominio] = base.trim().toLowerCase().split("@");
  const alias = normalizar(nombre).replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");
  return `${usuario}+${alias}@${dominio}`;
}
