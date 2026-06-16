import { useState, useCallback } from "react";
import { parseExcelCDAs, type ParseResult } from "../utils/parseExcelCDAs";
import { mockCDAs, type CDA } from "../app/data/mockCDAs";

const STORAGE_KEY = "cardisel_cda_data";
const BACKUP_KEY = "cardisel_cda_backup";
const MAX_BACKUPS = 5;

export interface StoredSnapshot {
  cdas: CDA[];
  timestamp: string;
  mes: string;
  fileName: string;
}

export interface UseCDADataReturn {
  cdas: CDA[];                          // datos activos (mock o del Excel)
  lastUpdate: StoredSnapshot | null;    // info de la última carga
  backups: StoredSnapshot[];            // historial de cargas anteriores
  isLoading: boolean;
  error: string | null;
  warnings: string[];
  loadExcel: (file: File, sheet?: string) => Promise<void>;
  updateCdaMeta: (cdaId: number, metaMensual: number) => void;
  restoreBackup: (index: number) => void;
  resetToMock: () => void;
}

function loadFromStorage(): { current: StoredSnapshot | null; backups: StoredSnapshot[] } {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    const backups = localStorage.getItem(BACKUP_KEY);
    return {
      current: current ? JSON.parse(current) : null,
      backups: backups ? JSON.parse(backups) : [],
    };
  } catch {
    return { current: null, backups: [] };
  }
}

function mergeWithMock(parsed: ParseResult): CDA[] {
  return mockCDAs.map((cda) => {
    const found = parsed.data.find((d) => d.id === cda.id);
    if (!found) return cda;

    const clientesMes = found.servicios?.total ?? found.clientesMes ?? cda.clientesMes;
    return {
      ...cda,
      clientesMes,
      servicios: found.servicios,
      preventivas: found.preventivas,
      rtms: found.rtms,
      facturacion: found.facturacion,
    };
  });
}

function getDuplicateVendorWarnings(cdas: CDA[]) {
  const counts = new Map<string, { count: number; display: string }>();

  cdas.forEach((cda) => {
    cda.vendedores.forEach((vendedor) => {
      const normalized = vendedor.nombre.trim().toLowerCase();
      if (!normalized) return;

      const existing = counts.get(normalized);
      counts.set(normalized, {
        count: existing ? existing.count + 1 : 1,
        display: existing ? existing.display : vendedor.nombre.trim(),
      });
    });
  });

  const duplicates = Array.from(counts.values()).filter((item) => item.count > 1);
  if (duplicates.length === 0) return [];

  return [
    `Nombres de vendedores duplicados detectados: ${duplicates
      .map((item) => `${item.display} (${item.count})`)
      .join(", ")}`,
  ];
}

export function useCDAData(): UseCDADataReturn {
  const stored = loadFromStorage();

  const [cdas, setCdas] = useState<CDA[]>(
    stored.current ? stored.current.cdas : mockCDAs
  );
  const [lastUpdate, setLastUpdate] = useState<StoredSnapshot | null>(
    stored.current
  );
  const [backups, setBackups] = useState<StoredSnapshot[]>(stored.backups);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const saveSnapshot = useCallback(
    (snapshot: StoredSnapshot, prevSnapshot: StoredSnapshot | null) => {
      // Guarda la actual como corriente
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));

      // Mueve la anterior a backups
      const newBackups = prevSnapshot
        ? [prevSnapshot, ...backups].slice(0, MAX_BACKUPS)
        : backups;

      localStorage.setItem(BACKUP_KEY, JSON.stringify(newBackups));
      setBackups(newBackups);
    },
    [backups]
  );

  const loadExcel = useCallback(
    async (file: File, sheet = "Global") => {
      setIsLoading(true);
      setError(null);
      setWarnings([]);

      try {
        const parsed = await parseExcelCDAs(file, sheet);
        const merged = mergeWithMock(parsed);
        const duplicateWarnings = getDuplicateVendorWarnings(merged);

        const snapshot: StoredSnapshot = {
          cdas: merged,
          timestamp: parsed.timestamp,
          mes: parsed.mes,
          fileName: file.name,
        };

        saveSnapshot(snapshot, lastUpdate);
        setCdas(merged);
        setLastUpdate(snapshot);

        setWarnings([...parsed.warnings, ...duplicateWarnings]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        setIsLoading(false);
      }
    },
    [lastUpdate, saveSnapshot]
  );

  const restoreBackup = useCallback(
    (index: number) => {
      const backup = backups[index];
      if (!backup) return;

      // La actual va a backups, el backup seleccionado pasa a ser la actual
      const newBackups = backups.filter((_, i) => i !== index);
      if (lastUpdate) newBackups.unshift(lastUpdate);

      localStorage.setItem(STORAGE_KEY, JSON.stringify(backup));
      localStorage.setItem(BACKUP_KEY, JSON.stringify(newBackups.slice(0, MAX_BACKUPS)));

      setCdas(backup.cdas);
      setLastUpdate(backup);
      setBackups(newBackups.slice(0, MAX_BACKUPS));
      setError(null);
      setWarnings([]);
    },
    [backups, lastUpdate]
  );

  const updateCdaMeta = useCallback(
    (cdaId: number, metaMensual: number) => {
      const updatedCdas = cdas.map((cda) =>
        cda.id === cdaId ? { ...cda, metaMensual } : cda
      );

      const snapshot: StoredSnapshot = {
        cdas: updatedCdas,
        timestamp: new Date().toISOString(),
        mes: lastUpdate?.mes ?? "Administrativo",
        fileName: lastUpdate?.fileName ?? "Administrativo",
      };

      saveSnapshot(snapshot, lastUpdate);
      setCdas(updatedCdas);
      setLastUpdate(snapshot);
      setError(null);
      setWarnings([]);
    },
    [cdas, lastUpdate, saveSnapshot]
  );

  const resetToMock = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(BACKUP_KEY);
    setCdas(mockCDAs);
    setLastUpdate(null);
    setBackups([]);
    setError(null);
    setWarnings([]);
  }, []);

  return {
    cdas,
    lastUpdate,
    backups,
    isLoading,
    error,
    warnings,
    loadExcel,
    updateCdaMeta,
    restoreBackup,
    resetToMock,
  };
}