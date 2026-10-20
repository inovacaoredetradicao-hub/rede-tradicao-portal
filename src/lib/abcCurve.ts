// Curva ABC da filial pela acuracidade media das auditorias:
// A = acima de 90% | B = de 80% a 90% | C = abaixo de 80%.
// Filial sem auditoria no periodo nao entra em nenhuma curva (null).
export type AbcCurve = 'A' | 'B' | 'C';

export function getAbcCurve(avgAccuracy: number, totalAudits: number): AbcCurve | null {
  if (!totalAudits) return null;
  if (avgAccuracy > 90) return 'A';
  if (avgAccuracy >= 80) return 'B';
  return 'C';
}

export const ABC_TONES: Record<AbcCurve, string> = {
  A: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  B: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  C: 'bg-rose-500/15 text-rose-600 border-rose-500/30',
};

export const ABC_RANGES: Record<AbcCurve, string> = {
  A: 'acima de 90%',
  B: 'de 80% a 90%',
  C: 'abaixo de 80%',
};
