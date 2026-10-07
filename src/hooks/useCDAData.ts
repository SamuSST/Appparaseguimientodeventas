import { useCallback, useState } from "react";
import { mockCDAs, type CDA } from "../app/data/mockCDAs";

const STORAGE_KEY = "cda_monthly_goals";

function loadCdas(): CDA[] {
  let savedGoals: Record<string, unknown> = {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        savedGoals = parsed as Record<string, unknown>;
      } else {
        throw new Error("El formato de las metas guardadas no es válido.");
      }
    }
  } catch (error) {
    console.error("No se pudieron cargar las metas guardadas:", error);
  }

  return mockCDAs.map((cda) => {
    const savedGoal = savedGoals[String(cda.id)];
    return typeof savedGoal === "number" && Number.isFinite(savedGoal) && savedGoal > 0
      ? { ...cda, metaMensual: savedGoal }
      : cda;
  });
}

export interface UseCDADataReturn {
  cdas: CDA[];
  updateCdaMeta: (cdaId: number, metaMensual: number) => void;
}

export function useCDAData(): UseCDADataReturn {
  const [cdas, setCdas] = useState<CDA[]>(loadCdas);

  const updateCdaMeta = useCallback((cdaId: number, metaMensual: number) => {
    if (!Number.isFinite(metaMensual) || metaMensual <= 0) {
      throw new Error("La meta mensual debe ser un número mayor a cero.");
    }

    const currentCda = mockCDAs.find((cda) => cda.id === cdaId);
    if (!currentCda) {
      throw new Error(`No se encontró el CDA con identificador ${cdaId}.`);
    }

    const savedGoalsJSON = localStorage.getItem(STORAGE_KEY);
    const savedGoals: Record<string, number> = savedGoalsJSON ? JSON.parse(savedGoalsJSON) : {};
    const updatedGoals = { ...savedGoals, [String(cdaId)]: metaMensual };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedGoals));
    setCdas((current) =>
      current.map((cda) => cda.id === cdaId ? { ...cda, metaMensual } : cda),
    );
  }, []);

  return { cdas, updateCdaMeta };
}
