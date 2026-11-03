
import { useState } from "react";
import * as XLSX from "xlsx";

type FilaExcel = Record<string, unknown>;

const COLUMNAS_REQUERIDAS = [
  "fecha",
  "cliente_nombre",
  "placa",
  "vendedor",
];

export default function ImportarExcel() {
  const [filas, setFilas] = useState<FilaExcel[]>([]);
  const [errores, setErrores] = useState<string[]>([]);
  const [mensaje, setMensaje] = useState("");

  async function validarArchivo(archivo?: File) {
    setFilas([]);
    setErrores([]);
    setMensaje("");

    if (!archivo) return;

    const extensionValida = /\.(xlsx|xls)$/i.test(archivo.name);

    if (!extensionValida) {
      setErrores(["Selecciona un archivo Excel .xlsx o .xls"]);
      return;
    }

    try {
      const contenido = await archivo.arrayBuffer();

      const libro = XLSX.read(contenido, {
        type: "array",
        cellDates: true,
      });

      const nombreHoja = libro.SheetNames[0];

      if (!nombreHoja) {
        setErrores(["El archivo no contiene hojas de cálculo"]);
        return;
      }

      const hoja = libro.Sheets[nombreHoja];

      const datos = XLSX.utils.sheet_to_json<FilaExcel>(hoja, {
        defval: "",
        raw: false,
      });

      if (datos.length === 0) {
        setErrores(["El archivo no contiene registros"]);
        return;
      }

      const columnas = Object.keys(datos[0]).map(
        (columna) => columna.trim().toLowerCase()
      );

      const faltantes = COLUMNAS_REQUERIDAS.filter(
        (columna) => !columnas.includes(columna)
      );

      if (faltantes.length > 0) {
        setErrores([
          "Faltan estas columnas: " + faltantes.join(", "),
        ]);
        return;
      }

      const erroresEncontrados: string[] = [];

      datos.forEach((fila, indice) => {
        const numeroFila = indice + 2;

        if (!String(fila.fecha ?? "").trim()) {
          erroresEncontrados.push(
            `Fila ${numeroFila}: falta la fecha`
          );
        }

        if (!String(fila.cliente_nombre ?? "").trim()) {
          erroresEncontrados.push(
            `Fila ${numeroFila}: falta el cliente`
          );
        }

        if (!String(fila.placa ?? "").trim()) {
          erroresEncontrados.push(
            `Fila ${numeroFila}: falta la placa`
          );
        }

        if (!String(fila.vendedor ?? "").trim()) {
          erroresEncontrados.push(
            `Fila ${numeroFila}: falta el vendedor`
          );
        }
      });

      setFilas(datos);
      setErrores(erroresEncontrados);

      if (erroresEncontrados.length === 0) {
        setMensaje(
          `Validación inicial correcta: ${datos.length} filas.`
        );
      } else {
        setMensaje(
          `Se encontraron ${erroresEncontrados.length} errores.`
        );
      }
    } catch {
      setErrores([
        "No se pudo leer el archivo. Comprueba que sea un Excel válido.",
      ]);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-2xl font-bold">
        Importar ventas desde Excel
      </h2>

      <p>
        Selecciona el archivo de ventas para revisar sus datos
        antes de importarlos.
      </p>

      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={(e) =>
          validarArchivo(e.target.files?.[0])
        }
      />

      {mensaje && (
        <p role="status">{mensaje}</p>
      )}

      {errores.length > 0 && (
        <div className="rounded border p-4">
          <h3 className="font-bold">
            Errores encontrados
          </h3>

          <ul className="list-disc pl-6">
            {errores.slice(0, 30).map((error, indice) => (
              <li key={indice}>{error}</li>
            ))}
          </ul>

          {errores.length > 30 && (
            <p>
              Se muestran los primeros 30 errores.
            </p>
          )}
        </div>
      )}

      {filas.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-bold">
            Vista previa: {filas.length} registros
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  {Object.keys(filas[0]).map((columna) => (
                    <th
                      key={columna}
                      className="border p-2 text-left"
                    >
                      {columna}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filas.slice(0, 10).map((fila, indice) => (
                  <tr key={indice}>
                    {Object.keys(filas[0]).map((columna) => (
                      <td
                        key={columna}
                        className="border p-2"
                      >
                        {String(fila[columna] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
