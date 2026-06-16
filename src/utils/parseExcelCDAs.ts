import * as XLSX from "xlsx";

// Mapea el nombre exacto del Excel → id del CDA en tu app
const CDA_NAME_MAP: Record<string, number> = {
  Inteco: 1,
  Unimilenio: 2,
  "La 37": 3,
  Tecnosabana: 4,
  "Itac Norte": 5,
  "Itac Sur": 6,
  Turim: 7,
  "La Rosa": 8,
  Romélia: 9,
};

const normalizeText = (value: unknown) =>
  String(value ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();

const findCdaId = (name: string) => {
  const normalized = normalizeText(name);
  for (const [excelName, id] of Object.entries(CDA_NAME_MAP)) {
    const normalizedMap = normalizeText(excelName);
    if (normalized === normalizedMap || normalized.includes(normalizedMap) || normalizedMap.includes(normalized)) {
      return id;
    }
  }
  return undefined;
};

interface ExcelMetrics {
  motos: number;
  livianos: number;
  pesados: number;
  total: number;
}

export interface CDAExcelData {
  id: number;
  nombre: string;
  servicios: ExcelMetrics;
  preventivas: ExcelMetrics;
  rtms: ExcelMetrics;
  facturacion: ExcelMetrics;
  clientesMes: number;
}

export interface ParseResult {
  data: CDAExcelData[];
  timestamp: string;           // cuándo se subió
  mes: string;                 // hoja leída, ej: "Global" o "Março"
  warnings: string[];
}

const defaultMetrics = (): ExcelMetrics => ({ motos: 0, livianos: 0, pesados: 0, total: 0 });

const getMetricType = (text: string) => {
  if (/moto/.test(text)) return "motos" as const;
  if (/livian/.test(text)) return "livianos" as const;
  if (/pesad/.test(text)) return "pesados" as const;
  if (/total/.test(text)) return "total" as const;
  return undefined;
};

const getMetricCategory = (text: string) => {
  if (/servic|servi[cç]os|servicios/.test(text)) return "servicios" as const;
  if (/prevent|preventiva/.test(text)) return "preventivas" as const;
  if (/rtm/.test(text)) return "rtms" as const;
  if (/fatur|factur|factura|recaud/.test(text)) return "facturacion" as const;
  return undefined;
};

const parseNumber = (input: unknown): number => {
  if (typeof input === "number") return Number.isFinite(input) ? input : NaN;
  if (typeof input !== "string") return NaN;

  const raw = input.trim();
  if (!raw) return NaN;

  let normalized = raw.replace(/\u00A0/g, "").replace(/\s+/g, "");

  // Keep only digits, minus, dot and comma.
  normalized = normalized.replace(/[^0-9.,-]/g, "");
  if (!normalized) return NaN;

  const hasDot = normalized.includes(".");
  const hasComma = normalized.includes(",");

  if (hasDot && hasComma) {
    // Assume thousands dot and decimal comma: 1.234,56
    normalized = normalized.replace(/\./g, "").replace(/,/g, ".");
  } else if (hasComma && !hasDot) {
    normalized = normalized.replace(/,/g, ".");
  } else {
    normalized = normalized.replace(/,/g, "");
  }

  const parsed = parseFloat(normalized);
  return Number.isNaN(parsed) ? NaN : parsed;
};

const extractNumericValues = (row: unknown[]) => {
  const values: number[] = [];
  for (const value of row) {
    const parsed = parseNumber(value);
    if (!Number.isNaN(parsed)) {
      values.push(parsed);
    }
  }
  return values;
};

const describeColumns = (rows: unknown[][]) => {
  const headerRows = rows.slice(0, 5);
  const descriptors: Array<{ category?: keyof ExcelMetrics; type?: keyof ExcelMetrics }> = [];

  const maxCols = Math.max(...headerRows.map((row) => row.length));

  for (let col = 0; col < maxCols; col++) {
    const labels = headerRows
      .map((row) => normalizeText(row[col]))
      .filter(Boolean)
      .join(" ");

    let category = getMetricCategory(labels);
    let type = getMetricType(labels);

    if (!category && /factur|fatur|recaud/.test(labels)) {
      category = "facturacion";
    }
    if (!category && /servic|servi[cç]os/.test(labels)) {
      category = "servicios";
    }
    if (!category && /prevent|preventiva/.test(labels)) {
      category = "preventivas";
    }
    if (!category && /rtm/.test(labels)) {
      category = "rtms";
    }

    if (!type && /total|acumulad|acumulado/.test(labels)) {
      type = "total";
    }

    descriptors[col] = { category, type };
  }

  return descriptors;
};

const applyMetricValues = (
  metrics: ExcelMetrics,
  values: number[],
  typeHint?: keyof ExcelMetrics
) => {
  if (typeHint) {
    metrics[typeHint] = values[0] ?? metrics[typeHint];
    return;
  }

  if (values.length >= 4) {
    metrics.motos = values[0];
    metrics.livianos = values[1];
    metrics.pesados = values[2];
    metrics.total = values[3];
  } else if (values.length === 3) {
    metrics.motos = values[0];
    metrics.livianos = values[1];
    metrics.pesados = values[2];
    metrics.total = values[0] + values[1] + values[2];
  } else if (values.length === 2) {
    metrics.motos = values[0];
    metrics.livianos = values[1];
    metrics.total = values[0] + values[1];
  } else if (values.length > 0) {
    metrics.total = values[0];
  }
};

const normalizeCdaName = (name: string) => String(name ?? "").trim();

export async function parseExcelCDAs(
  file: File,
  sheet = "Global"
): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target!.result as ArrayBuffer), {
          type: "array",
          cellDates: true,
        });

        const sheetName = wb.SheetNames.includes(sheet)
          ? sheet
          : wb.SheetNames[0];

        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<any[]>(ws, {
          header: 1,
          defval: "",
        });

        const warnings: string[] = [];
        const dataMap = new Map<number, CDAExcelData>();
        let activeCdaId: number | undefined;

        console.log("Total rows:", rows.length);
        console.log("First 10 rows:", rows.slice(0, 10).map((r, i) => `Row ${i}: ${r.join(" | ")}`));

        for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
          const row = rows[rowIndex];
          if (!row || row.length === 0) continue;

          let rowCdaId: number | undefined;
          let rowCdaName = "";

          for (let colIndex = 0; colIndex < Math.min(5, row.length); colIndex++) {
            const cellValue = String(row[colIndex] || "").trim();
            if (!cellValue) continue;

            const id = findCdaId(cellValue);
            if (id) {
              rowCdaId = id;
              rowCdaName = cellValue;
              break;
            }
          }

          if (rowCdaId) {
            activeCdaId = rowCdaId;
            if (!dataMap.has(activeCdaId)) {
              dataMap.set(activeCdaId, {
                id: activeCdaId,
                nombre: normalizeCdaName(rowCdaName),
                servicios: defaultMetrics(),
                preventivas: defaultMetrics(),
                rtms: defaultMetrics(),
                facturacion: defaultMetrics(),
                clientesMes: 0,
              });
            }
          }

          if (!activeCdaId) continue;
          const current = dataMap.get(activeCdaId)!;
          const rowText = normalizeText(row.slice(0, 6).join(" "));
          const numericValues = extractNumericValues(row);
          if (numericValues.length === 0) continue;

          const descriptors = describeColumns(rows.slice(0, Math.min(rows.length, 8)));
          let assigned = false;

          for (let colIndex = 0; colIndex < row.length; colIndex++) {
            const descriptor = descriptors[colIndex];
            const value = parseNumber(row[colIndex]);
            if (Number.isNaN(value)) continue;

            if (descriptor?.category) {
              if (descriptor.type) {
                current[descriptor.category][descriptor.type] = value;
              } else {
                current[descriptor.category].total = value;
              }
              assigned = true;
            }
          }

          if (!assigned) {
            if (/factur|fatur|factura|recaud/.test(rowText)) {
              applyMetricValues(current.facturacion, numericValues);
              assigned = true;
            } else if (/prevent|preventiva/.test(rowText)) {
              applyMetricValues(current.preventivas, numericValues);
              assigned = true;
            } else if (/rtm/.test(rowText)) {
              applyMetricValues(current.rtms, numericValues);
              assigned = true;
            } else {
              applyMetricValues(current.servicios, numericValues);
              assigned = true;
            }
          }

          if (current.servicios.total === 0) {
            current.servicios.total = current.servicios.motos + current.servicios.livianos + current.servicios.pesados;
          }

          if (current.facturacion.total === 0 && numericValues.length === 2 && /factur|fatur|factura|recaud/.test(rowText)) {
            current.facturacion.total = numericValues[1];
          }
        }

        for (const cdaData of dataMap.values()) {
          cdaData.servicios.total =
            cdaData.servicios.total > 0
              ? cdaData.servicios.total
              : cdaData.servicios.motos + cdaData.servicios.livianos + cdaData.servicios.pesados;
          cdaData.clientesMes = cdaData.servicios.total;
          data.push(cdaData);
        }

        if (data.length === 0) {
          warnings.push("No se encontraron CDAs en el Excel. Verifica que el archivo sea correcto.");
        }

        resolve({
          data,
          timestamp: new Date().toISOString(),
          mes: sheetName,
          warnings,
        });
      } catch (err) {
        reject(new Error("No se pudo leer el Excel. Verifica que sea el archivo correcto."));
      }
    };

    reader.onerror = () => reject(new Error("Error al leer el archivo."));
    reader.readAsArrayBuffer(file);
  });
}