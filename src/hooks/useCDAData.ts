import { useState, useCallback } from "react";
import { mockCDAs, type CDA } from "../app/data/mockCDAs";

export interface UseCDADataReturn {
  cdas: CDA[];
  updateCdaMeta: (cdaId: number, metaMensual: number) => void;
}



export function useCDAData(): UseCDADataReturn {
  const [cdas, setCdas] = useState<CDA[]>(mockCDAs);

  const updateCdaMeta = useCallback(
    (cdaId: number, metaMensual: number) => {
      setCdas((prev) =>
        prev.map((cda) =>
          cda.id === cdaId ? { ...cda, metaMensual } : cda
        )
      );
    },
    []
  );

  return {
    cdas,
    updateCdaMeta,
  };
}