import type { DocumentGenerationContext } from './types';

export const ATP_DOCUMENT_COLUMNS = [
  'CP / Elemen Rujukan', 'Tujuan Pembelajaran', 'Alur Tujuan Pembelajaran',
] as const;
export interface ATPDocumentRow {
  id: string;
  stepNumber: number | null;
  focus: string;
  resolvedTPs: Array<{ id: string; code: string; statement: string }>;
  cpLines: string[];
  tpLines: string[];
  flowLines: string[];
}
export interface ATPDocumentProjection {
  isReady: boolean;
  error?: string;
  rationale: string;
  cpReferenceLines: string[];
  rows: ATPDocumentRow[];
}

export function buildATPDocumentProjection(context: DocumentGenerationContext): ATPDocumentProjection {
  const invalid = (error: string): ATPDocumentProjection => ({ isReady: false, error, rationale: '', cpReferenceLines: [], rows: [] });
  if (context.documentMode === 'blank') return {
    isReady: true, rationale: '', cpReferenceLines: [],
    rows: Array.from({ length: 15 }, (_, index) => ({
      id: 'blank-' + index, stepNumber: null, focus: '', resolvedTPs: [],
      cpLines: ['................................................'], tpLines: ['................................................'],
      flowLines: ['Tahap ....: ................................................', 'TP terkait: ................................................'],
    })),
  };
  const { cp, tp, atp } = context;
  if (!cp || !tp?.items?.length || !atp?.items?.length) return invalid('CP, TP canonical, dan ATP harus tersedia untuk ekspor ATP.');
  const cpReferenceLines = [
    ...(cp.generalDescription?.trim() ? [cp.generalDescription.trim()] : []),
    ...(cp.elements || []).map(element => [element.name?.trim(), element.content?.trim()].filter(Boolean).join(': ')).filter(Boolean),
  ];
  if (!cpReferenceLines.length) return invalid('CP / Elemen Rujukan canonical belum tersedia.');
  // CP elements are references for the document, not guessed joins through TP text or legacy ATP caches.
  const tpById = new Map<string, typeof tp.items>();
  for (const item of tp.items) tpById.set(item.id, [...(tpById.get(item.id) || []), item]);
  const seenItems = new Set<string>();
  const seenSteps = new Set<number>();
  const rows: ATPDocumentRow[] = [];
  for (const item of atp.items) {
    if (typeof item.id !== 'string' || !item.id.trim() || seenItems.has(item.id)) return invalid('ID langkah ATP kosong atau duplikat.');
    seenItems.add(item.id);
    if (!Number.isInteger(item.stepNumber) || item.stepNumber < 1 || seenSteps.has(item.stepNumber)) return invalid('stepNumber ATP tidak valid atau ambigu.');
    seenSteps.add(item.stepNumber);
    if (typeof item.focus !== 'string' || !item.focus.trim()) return invalid('Fokus canonical tahap ATP ' + item.stepNumber + ' belum tersedia.');
    if (!Array.isArray(item.linkedTpIds) || !item.linkedTpIds.length ||
        item.linkedTpIds.some(id => typeof id !== 'string' || !id.trim()) || new Set(item.linkedTpIds).size !== item.linkedTpIds.length) {
      return invalid('linkedTpIds tahap ATP ' + item.stepNumber + ' kosong atau duplikat; ekspor memerlukan ID TP canonical exact.');
    }
    const resolvedTPs: ATPDocumentRow['resolvedTPs'] = [];
    for (const id of item.linkedTpIds) {
      const matches = tpById.get(id) || [];
      if (matches.length !== 1) return invalid('TP canonical "' + id + '" pada tahap ' + item.stepNumber + ' tidak ditemukan atau ambigu.');
      const objective = matches[0];
      if (!objective.code?.trim() || !objective.statement?.trim()) return invalid('Kode/pernyataan TP canonical "' + id + '" belum lengkap.');
      resolvedTPs.push({ id: objective.id, code: objective.code.trim(), statement: objective.statement.trim() });
    }
    rows.push({
      id: item.id, stepNumber: item.stepNumber, focus: item.focus.trim(), resolvedTPs,
      cpLines: [...cpReferenceLines],
      tpLines: resolvedTPs.map(objective => '[' + objective.code + '] ' + objective.statement),
      flowLines: ['Tahap ' + item.stepNumber + '. ' + item.focus.trim(),
        'TP terkait:', ...resolvedTPs.map(objective => '• [' + objective.code + '] ' + objective.statement)],
    });
  }
  rows.sort((a,b) => a.stepNumber! - b.stepNumber!);
  return { isReady: true, rationale: atp.rationale?.trim() || '', cpReferenceLines, rows };
}
