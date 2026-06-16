import { type DragEvent, useRef, useState } from "react";
import {
  Upload,
  CheckCircle,
  AlertCircle,
  Clock,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Trash2,
} from "lucide-react";
import { type UseCDADataReturn, type StoredSnapshot } from "../../hooks/useCDAData";

interface Props {
  hook: UseCDADataReturn;
  onClose?: () => void;
}

const SHEETS = ["Global", "Janeiro", "Fevereiro", "Março", "Abril"];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ExcelUploader({ hook, onClose }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [sheet, setSheet] = useState("Global");
  const [showBackups, setShowBackups] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      alert("Solo se aceptan archivos .xlsx, .xls o .csv");
      return;
    }
    hook.loadExcel(file, sheet);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5" />
          <span className="font-semibold text-sm">Cargar Excel de CDAs</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-blue-200 hover:text-white text-lg leading-none">
            ×
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Selector de hoja */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Hoja del Excel</label>
          <select
            value={sheet}
            onChange={(e) => setSheet(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white"
          >
            {SHEETS.map((s) => (
              <option key={s} value={s}>
                {s === "Global" ? "Global (acumulado)" : s}
              </option>
            ))}
          </select>
        </div>

        {/* Drop zone */}
        <div
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
            dragOver
              ? "border-blue-400 bg-blue-50"
              : "border-gray-300 hover:border-blue-300 hover:bg-gray-50"
          }`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          {hook.isLoading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500">Procesando Excel...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-8 h-8 text-gray-400" />
              <p className="text-sm font-medium text-gray-700">
                Arrastra tu Excel o haz clic
              </p>
              <p className="text-xs text-gray-400">.xlsx · .xls · .csv</p>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>

        {/* Error */}
        {hook.error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">{hook.error}</p>
          </div>
        )}

        {/* Warnings */}
        {hook.warnings.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
            <p className="text-xs font-medium text-amber-700">Advertencias:</p>
            {hook.warnings.map((w: string, i: number) => (
              <p key={i} className="text-xs text-amber-600">• {w}</p>
            ))}
          </div>
        )}

        {/* Última carga exitosa */}
        {hook.lastUpdate && !hook.error && (
          <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg p-3">
            <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-green-700">
                Datos activos: {hook.lastUpdate.fileName}
              </p>
              <p className="text-xs text-green-600">
                Hoja: {hook.lastUpdate.mes} · {fmtDate(hook.lastUpdate.timestamp)}
              </p>
            </div>
          </div>
        )}

        {/* Historial de respaldos */}
        {hook.backups.length > 0 && (
          <div>
            <button
              onClick={() => setShowBackups(!showBackups)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
            >
              <Clock className="w-3 h-3" />
              {hook.backups.length} respaldo{hook.backups.length > 1 ? "s" : ""} disponible{hook.backups.length > 1 ? "s" : ""}
              {showBackups ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {showBackups && (
              <div className="mt-2 space-y-2">
                {hook.backups.map((b: StoredSnapshot, i: number) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg p-2.5"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-gray-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-700 truncate">
                        {b.fileName}
                      </p>
                      <p className="text-xs text-gray-400">
                        {b.mes} · {fmtDate(b.timestamp)}
                      </p>
                    </div>
                    <button
                      onClick={() => hook.restoreBackup(i)}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 shrink-0"
                      title="Restaurar este respaldo"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Restaurar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Reset a mock */}
        {hook.lastUpdate && (
          <button
            onClick={() => {
              if (confirm("¿Volver a los datos de ejemplo? Se borrarán los datos del Excel.")) {
                hook.resetToMock();
              }
            }}
            className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700"
          >
            <Trash2 className="w-3 h-3" />
            Volver a datos de ejemplo
          </button>
        )}
      </div>
    </div>
  );
}