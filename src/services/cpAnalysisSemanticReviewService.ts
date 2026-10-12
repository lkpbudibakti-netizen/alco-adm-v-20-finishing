import type { CPData, CPAnalysisItem } from '../types';

export type CPAnalysisSemanticFindingType =
  | 'COMPETENCE_MISMATCH'
  | 'MATERIAL_MISSING'
  | 'UNSUPPORTED_ADDITION'
  | 'SUGGESTED_TP_INCONSISTENT';

export type CPAnalysisFindingSeverity = 'WARNING' | 'INFO';

export interface CPAnalysisSuggestedChange {
  field: 'cpCompetence' | 'materialScope' | 'suggestedTp';
  fieldLabel: string;
  currentValue: string;
  suggestedValue: string;
}

export interface CPAnalysisSemanticFinding {
  id: string;
  itemId: string;
  itemOrder?: number;
  elementId?: string;
  elementName?: string;
  type: CPAnalysisSemanticFindingType;
  severity: CPAnalysisFindingSeverity;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  reason: string;
  evidence: {
    cpText?: string;
    analysisCompetence?: string;
    analysisMaterial?: string;
    suggestedTp?: string;
  };
  suggestion: string;
  canAutoApply: boolean;
  suggestedChange?: CPAnalysisSuggestedChange;
}

export interface AppliedFindingRecord {
  findingId: string;
  itemId: string;
  field: keyof CPAnalysisItem;
  previousValue: any;
  appliedValue: any;
  appliedAt: string;
}

export interface CPAnalysisSemanticReviewResult {
  isValid: boolean;
  totalFindings: number;
  warningCount: number;
  infoCount: number;
  findings: CPAnalysisSemanticFinding[];
  summaryMessage: string;
  reviewedAt: string;
}

const STOPWORDS = new Set([
  'agar', 'akan', 'atau', 'bagi', 'baik', 'cara', 'dalam', 'dan', 'dapat', 'dengan',
  'di', 'diri', 'hal', 'ini', 'itu', 'ke', 'kegiatan', 'konsep', 'langkah', 'materi',
  'melalui', 'pada', 'pembelajaran', 'peserta', 'siswa', 'didik', 'secara', 'sebagai',
  'serta', 'tentang', 'terhadap', 'untuk', 'yang', 'mampu', 'fase', 'elemen', 'akhir',
  'kehidupan', 'sehari-hari', 'konteks', 'lingkungan', 'berbagai', 'macam', 'jenis',
]);

const COMPETENCE_GROUPS: Record<string, string[]> = {
  understand: [
    'memahami', 'pemahaman', 'paham', 'menjelaskan', 'jelas', 'menguraikan', 'uraikan',
    'mengenal', 'mengenali', 'identifikasi', 'mengidentifikasi', 'menunjukkan', 'ketahui', 'mengetahui'
  ],
  apply: [
    'menerapkan', 'penerapan', 'terap', 'menggunakan', 'gunakan', 'menentukan', 'tentukan',
    'menghitung', 'hitung'
  ],
  analyze: [
    'menganalisis', 'analisis', 'menelaah', 'telaah', 'membandingkan', 'banding',
    'mengaitkan', 'kait', 'menghubungkan', 'hubung', 'menyelidiki', 'selidik', 'membedakan'
  ],
  practice: [
    'mempraktikkan', 'praktik', 'mendemonstrasikan', 'demonstrasi', 'melakukan', 'lakukan',
    'jaga', 'menjaga', 'peragakan', 'memperagakan', 'mainkan', 'memainkan', 'tunjukkan',
    'mempertunjukkan'
  ],
  create: [
    'membuat', 'buat', 'menyusun', 'susun', 'merancang', 'rancang', 'menghasilkan', 'hasil', 'menciptakan'
  ],
  evaluate: [
    'mengevaluasi', 'evaluasi', 'menilai', 'nilai', 'merefleksi', 'refleksi', 'menyimpulkan', 'simpul'
  ],
  explore: [
    'mengeksplorasi', 'eksplorasi', 'menjelajahi', 'jelajah'
  ],
  participate: [
    'berpartisipasi', 'partisipasi', 'ikut', 'mengikuti', 'terlibat', 'keterlibatan', 'turut'
  ],
  observe: [
    'mengamati', 'amati', 'pengamatan', 'observasi'
  ],
};

const COMPETENCE_EQUIVALENCE: Record<string, string[]> = {
  understand: ['understand'],
  apply: ['apply', 'practice'],
  analyze: ['analyze'],
  practice: ['practice', 'apply'],
  create: ['create'],
  evaluate: ['evaluate'],
  explore: ['explore'],
  participate: ['participate'],
  observe: ['observe'],
};

function normalizeText(value?: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractSubstantiveTokens(text?: string): string[] {
  if (!text) return [];
  const normalized = normalizeText(text);
  return normalized
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !STOPWORDS.has(word));
}

export function detectCompetenceGroups(text?: string): string[] {
  if (!text) return [];
  const tokens = new Set(extractSubstantiveTokens(text));
  const detected = new Set<string>();

  for (const [group, words] of Object.entries(COMPETENCE_GROUPS)) {
    if (words.some((w) => tokens.has(w) || normalizeText(text).includes(w))) {
      detected.add(group);
    }
  }

  return Array.from(detected);
}

function areCompetenceGroupsCompatible(groupsA: string[], groupsB: string[]): boolean {
  if (groupsA.length === 0 || groupsB.length === 0) return true;
  return groupsA.some((gA) => {
    const equiv = COMPETENCE_EQUIVALENCE[gA] || [gA];
    return groupsB.some((gB) => equiv.includes(gB));
  });
}

/**
 * Extracts action verbs directly from the CP text to formulate accurate, authentic recommendations.
 */
export function extractTargetCompetenceFromCP(cpText?: string): string {
  if (!cpText) return '';
  const verbsFound: string[] = [];
  const priorityGroups = ['practice', 'apply', 'analyze', 'create', 'evaluate', 'explore', 'participate', 'observe'];

  for (const group of priorityGroups) {
    const groupVerbs = COMPETENCE_GROUPS[group] || [];
    for (const v of groupVerbs) {
      if (v.length < 4) continue;
      const regex = new RegExp(`\\b${v}\\b`, 'i');
      if (regex.test(cpText) && !verbsFound.some((vf) => vf.toLowerCase() === v.toLowerCase())) {
        verbsFound.push(v.charAt(0).toUpperCase() + v.slice(1));
      }
    }
  }

  if (verbsFound.length === 0) {
    for (const v of COMPETENCE_GROUPS.understand) {
      if (v.length < 4) continue;
      const regex = new RegExp(`\\b${v}\\b`, 'i');
      if (regex.test(cpText) && !verbsFound.some((vf) => vf.toLowerCase() === v.toLowerCase())) {
        verbsFound.push(v.charAt(0).toUpperCase() + v.slice(1));
      }
    }
  }

  if (verbsFound.length === 0) return '';
  if (verbsFound.length === 1) return verbsFound[0];
  return verbsFound.slice(0, 2).join(' dan ');
}

/**
 * Applies a finding's suggested change to a list of CPAnalysisItem, with optional user customization.
 * Guarantees that ONLY the target field of the specific row is updated.
 */
export function applyFindingToItems(
  items: CPAnalysisItem[],
  finding: CPAnalysisSemanticFinding,
  customValue?: string
): { updatedItems: CPAnalysisItem[]; record?: AppliedFindingRecord } {
  if (!finding.suggestedChange || !finding.itemId) {
    return { updatedItems: items };
  }

  const { field, currentValue, suggestedValue } = finding.suggestedChange;
  const valueToApply = customValue !== undefined ? customValue : suggestedValue;

  const targetItem = items.find((it) => it.id === finding.itemId);
  if (!targetItem) {
    return { updatedItems: items };
  }

  const previousValue = targetItem[field] ?? currentValue;
  const updatedItems = items.map((it) => {
    if (it.id !== finding.itemId) return it;
    return {
      ...it,
      [field]: valueToApply,
    };
  });

  const record: AppliedFindingRecord = {
    findingId: finding.id,
    itemId: finding.itemId,
    field,
    previousValue,
    appliedValue: valueToApply,
    appliedAt: new Date().toISOString(),
  };

  return { updatedItems, record };
}

/**
 * Undoes an applied suggestion, returning the item field to its previous state.
 */
export function undoAppliedFinding(
  items: CPAnalysisItem[],
  record: AppliedFindingRecord
): CPAnalysisItem[] {
  return items.map((it) => {
    if (it.id !== record.itemId) return it;
    return {
      ...it,
      [record.field]: record.previousValue,
    };
  });
}

/**
 * Splits CP text into atomic substantive clauses/segments for coverage checking.
 */
function splitCPSubstantiveClauses(text?: string): string[] {
  if (!text || !text.trim()) return [];
  return text
    .split(/;\s*|\.\s+(?=[A-Z0-9])|\b(?:serta|dan)\s+(?=(?:mampu|dapat|peserta|memahami|menerapkan|mempraktikkan|mengenali|menjelaskan|menganalisis)\b)/i)
    .map((clause) => clause.trim())
    .filter((clause) => clause.length >= 10);
}

/**
 * Evaluates semantic quality and curriculum fidelity of CP Analysis items against canonical CP data.
 * Pure function: does not mutate inputs, does not perform network calls.
 */
export function reviewCPAnalysisSemantic(
  items: CPAnalysisItem[],
  cp: CPData
): CPAnalysisSemanticReviewResult {
  const findings: CPAnalysisSemanticFinding[] = [];
  const canonicalElements = cp.elements || [];
  const canonicalElemMap = new Map<string, (typeof canonicalElements)[0]>();
  canonicalElements.forEach((el) => {
    if (el.id) canonicalElemMap.set(el.id.trim(), el);
  });

  // Track elements that have been analyzed
  const analyzedElemIds = new Set<string>();

  // Map items per element for multi-item element coverage check
  const itemsByElemId = new Map<string, CPAnalysisItem[]>();
  items.forEach((item) => {
    if (item.elementId) {
      const eid = item.elementId.trim();
      analyzedElemIds.add(eid);
      const list = itemsByElemId.get(eid) || [];
      list.push(item);
      itemsByElemId.set(eid, list);
    }
  });

  // 1. Evaluate per-item semantic quality
  for (const item of items) {
    const canonicalElem = item.elementId ? canonicalElemMap.get(item.elementId.trim()) : undefined;
    const cpText = canonicalElem?.content || item.cpText || cp.generalDescription || '';

    // A. Check Competence Mismatch
    if (item.cpCompetence && item.cpCompetence.trim().length > 0 && cpText.trim().length > 0) {
      const cpCompGroups = detectCompetenceGroups(cpText);
      const analysisCompGroups = detectCompetenceGroups(item.cpCompetence);

      if (cpCompGroups.length > 0 && analysisCompGroups.length > 0) {
        const isCompatible = areCompetenceGroupsCompatible(cpCompGroups, analysisCompGroups);

        if (!isCompatible) {
          // Identify specific shift: e.g. practice -> understand
          const isPracticeToUnderstand =
            cpCompGroups.includes('practice') && !analysisCompGroups.includes('practice') && analysisCompGroups.includes('understand');
          const isHigherOrderReduced =
            (cpCompGroups.includes('analyze') || cpCompGroups.includes('create') || cpCompGroups.includes('evaluate')) &&
            !analysisCompGroups.some((g) => ['analyze', 'create', 'evaluate'].includes(g)) &&
            analysisCompGroups.includes('understand');

          const shiftDescription = isPracticeToUnderstand
            ? 'Teks CP menuntut keterampilan praktik atau tindakan konkret, sedangkan analisis menurunkan tuntutan menjadi sekadar pemahaman/teori.'
            : isHigherOrderReduced
            ? 'Teks CP menuntut penalaran tingkat tinggi (analisis/kreasi/evaluasi), sedangkan analisis menurunkan tuntutan menjadi pemahaman dasar.'
            : `Tuntutan kompetensi pada analisis ("${item.cpCompetence}") berbeda tingkat atau jenis keterampilannya dengan teks CP.`;

          const targetCompetence = extractTargetCompetenceFromCP(cpText);
          const canAutoApply = Boolean(targetCompetence && targetCompetence.trim().length > 0);
          const suggestedChange: CPAnalysisSuggestedChange | undefined = canAutoApply
            ? {
                field: 'cpCompetence',
                fieldLabel: 'Kata Kerja Operasional (Kompetensi)',
                currentValue: item.cpCompetence || '',
                suggestedValue: targetCompetence,
              }
            : undefined;

          findings.push({
            id: `finding-${item.id}-COMPETENCE_MISMATCH-${findings.length + 1}`,
            itemId: item.id,
            itemOrder: item.order,
            elementId: item.elementId,
            elementName: item.elementName || canonicalElem?.name,
            type: 'COMPETENCE_MISMATCH',
            severity: 'WARNING',
            confidence: isPracticeToUnderstand || isHigherOrderReduced ? 'HIGH' : 'MEDIUM',
            title: 'Tingkat Kompetensi Berbeda dengan Teks CP',
            reason: shiftDescription,
            evidence: {
              cpText,
              analysisCompetence: item.cpCompetence,
              analysisMaterial: item.materialScope,
            },
            suggestion: canAutoApply
              ? `Sesuaikan kompetensi menjadi "${targetCompetence}" agar selaras dengan tuntutan tindakan pada teks CP rujukan.`
              : `Sesuaikan Kata Kerja Operasional (KKO) agar mencerminkan tindakan pembelajaran yang ditargetkan pada teks CP (misal: memuat kata kerja tindakan yang selaras).`,
            canAutoApply,
            suggestedChange,
          });
        }
      }
    }

    // B. Check Unsupported Material Addition
    if (item.materialScope && item.materialScope.trim().length > 0 && cpText.trim().length > 0) {
      const materialTokens = extractSubstantiveTokens(item.materialScope);
      const cpTokens = new Set(extractSubstantiveTokens(cpText));

      // Also check against full CP general description if available
      const fullCPTokens = new Set(extractSubstantiveTokens(`${cp.generalDescription || ''} ${cpText}`));

      if (materialTokens.length >= 2) {
        const matchingTokens = materialTokens.filter((token) => fullCPTokens.has(token));
        // If ZERO substantive tokens match anywhere in the CP element or general description
        if (matchingTokens.length === 0) {
          findings.push({
            id: `finding-${item.id}-UNSUPPORTED_ADDITION-${findings.length + 1}`,
            itemId: item.id,
            itemOrder: item.order,
            elementId: item.elementId,
            elementName: item.elementName || canonicalElem?.name,
            type: 'UNSUPPORTED_ADDITION',
            severity: 'WARNING',
            confidence: 'MEDIUM',
            title: 'Lingkup Materi Tidak Ditemukan Dukungannya pada CP',
            reason: `Lingkup materi "${item.materialScope}" tidak memuat kata kunci atau konsep yang didukung oleh rumusan CP elemen ini.`,
            evidence: {
              cpText,
              analysisMaterial: item.materialScope,
            },
            suggestion: `Pastikan materi yang dianalisis bersumber langsung dari pokok bahasan CP elemen ini atau sesuaikan rumusan materi inti.`,
            canAutoApply: false,
          });
        }
      }
    }

    // C. Check Suggested TP Consistency (if provided)
    if (item.suggestedTp && item.suggestedTp.trim().length >= 15) {
      const suggestedTp = item.suggestedTp.trim();
      const tpCompGroups = detectCompetenceGroups(suggestedTp);
      const itemCompGroups = detectCompetenceGroups(item.cpCompetence);

      const hasCompConflict =
        itemCompGroups.length > 0 &&
        tpCompGroups.length > 0 &&
        !areCompetenceGroupsCompatible(itemCompGroups, tpCompGroups);

      const tpTokens = new Set(extractSubstantiveTokens(suggestedTp));
      const materialTokens = extractSubstantiveTokens(item.materialScope);
      const hasMaterialOverlap =
        materialTokens.length === 0 || materialTokens.some((t) => tpTokens.has(t));

      if (hasCompConflict || !hasMaterialOverlap) {
        const comp = (item.cpCompetence || '').trim();
        const mat = (item.materialScope || '').trim();
        const canFormulateTp = Boolean(comp.length > 0 && mat.length > 0);
        const cleanComp = comp ? comp.charAt(0).toLowerCase() + comp.slice(1) : '';
        const cleanMat = mat ? mat.charAt(0).toLowerCase() + mat.slice(1) : '';
        const recommendedTp = canFormulateTp
          ? `Peserta didik mampu ${cleanComp} ${cleanMat}.`
          : '';

        const suggestedChange: CPAnalysisSuggestedChange | undefined = canFormulateTp
          ? {
              field: 'suggestedTp',
              fieldLabel: 'Usulan Rumusan TP',
              currentValue: item.suggestedTp || '',
              suggestedValue: recommendedTp,
            }
          : undefined;

        findings.push({
          id: `finding-${item.id}-SUGGESTED_TP_INCONSISTENT-${findings.length + 1}`,
          itemId: item.id,
          itemOrder: item.order,
          elementId: item.elementId,
          elementName: item.elementName || canonicalElem?.name,
          type: 'SUGGESTED_TP_INCONSISTENT',
          severity: 'WARNING',
          confidence: 'MEDIUM',
          title: 'Usulan TP Belum Selaras dengan Baris Analisis',
          reason: hasCompConflict
            ? `Rumusan draf TP memuat kata kerja tindakan yang tidak selaras dengan kompetensi analisis ("${item.cpCompetence}").`
            : `Rumusan draf TP belum memuat konsep lingkup materi inti ("${item.materialScope}").`,
          evidence: {
            analysisCompetence: item.cpCompetence,
            analysisMaterial: item.materialScope,
            suggestedTp: item.suggestedTp,
          },
          suggestion: canFormulateTp
            ? `Perbarui usulan TP menjadi: "${recommendedTp}" agar mencerminkan kompetensi dan materi baris ini.`
            : `Rumuskan usulan TP dengan memadukan kompetensi "${item.cpCompetence || 'KKO'}" dan lingkup materi "${item.materialScope || 'Materi'}".`,
          canAutoApply: canFormulateTp,
          suggestedChange,
        });
      }
    }
  }

  // 2. Evaluate Element-Level Material Coverage (MATERIAL_MISSING)
  for (const el of canonicalElements) {
    if (!el.id) continue;
    const eid = el.id.trim();
    const elemItems = itemsByElemId.get(eid) || [];

    if (elemItems.length === 0) {
      // Element has no analysis items at all
      findings.push({
        id: `finding-${eid}-MISSING_ELEM-${findings.length + 1}`,
        itemId: `missing-elem-${eid}`,
        elementId: eid,
        elementName: el.name,
        type: 'MATERIAL_MISSING',
        severity: 'WARNING',
        confidence: 'HIGH',
        title: `Elemen CP "${el.name}" Belum Dianalisis`,
        reason: `Elemen CP "${el.name}" belum memiliki baris bedah kompetensi dan materi sama sekali.`,
        evidence: {
          cpText: el.content,
        },
        suggestion: `Tambahkan baris analisis baru dan pilih elemen "${el.name}" untuk membedah kompetensi serta materinya.`,
        canAutoApply: false,
      });
      continue;
    }

    // Check if major substantive clauses of this element are represented across its items
    const combinedElemMaterial = elemItems.map((it) => `${it.cpCompetence} ${it.materialScope}`).join(' ');
    const combinedTokens = new Set(extractSubstantiveTokens(combinedElemMaterial));

    const clauses = splitCPSubstantiveClauses(el.content);
    for (const clause of clauses) {
      const clauseTokens = extractSubstantiveTokens(clause);
      if (clauseTokens.length >= 3) {
        const matched = clauseTokens.filter((t) => combinedTokens.has(t));
        // If less than 20% of the substantive tokens of this major clause are represented
        if (matched.length === 0 || (clauseTokens.length >= 4 && matched.length < 2)) {
          findings.push({
            id: `finding-${eid}-CLAUSE_MISSING-${findings.length + 1}`,
            itemId: elemItems[0].id,
            itemOrder: elemItems[0].order,
            elementId: eid,
            elementName: el.name,
            type: 'MATERIAL_MISSING',
            severity: 'WARNING',
            confidence: 'MEDIUM',
            title: `Bagian Lingkup Materi CP Belum Terwakili`,
            reason: `Klausa pokok CP: "${clause.length > 90 ? clause.slice(0, 87) + '...' : clause}" belum terlihat dicakup oleh butir-butir analisis pada elemen "${el.name}".`,
            evidence: {
              cpText: el.content,
              analysisMaterial: combinedElemMaterial,
            },
            suggestion: `Tinjau kembali apakah materi terkait "${clauseTokens.slice(0, 3).join(', ')}" perlu ditambahkan pada lingkup materi atau dibuatkan baris analisis terpisah.`,
            canAutoApply: false,
          });
        }
      }
    }
  }

  const warningCount = findings.filter((f) => f.severity === 'WARNING').length;
  const infoCount = findings.filter((f) => f.severity === 'INFO').length;

  let summaryMessage = 'Tidak ditemukan indikasi ketidakselarasan. Butir Analisis CP selaras secara semantik pada pemeriksaan otomatis (guru tetap disarankan memverifikasi konteks pembelajaran).';
  if (warningCount > 0) {
    summaryMessage = `Ditemukan ${warningCount} catatan keselarasan semantik yang disarankan untuk ditinjau oleh guru.`;
  }

  return {
    isValid: true, // Non-fatal advisory quality review
    totalFindings: findings.length,
    warningCount,
    infoCount,
    findings,
    summaryMessage,
    reviewedAt: new Date().toISOString(),
  };
}
