import type { TPItem, ATPItem } from '../types';

export interface ATPSemanticFidelityResult {
  isValid: boolean;
  reason?: string;
  matchedSignals: string[];
  missingSignals: string[];
}

const STOPWORDS = new Set([
  'agar', 'akan', 'atau', 'bagi', 'baik', 'cara', 'dalam', 'dan', 'dapat', 'dengan',
  'di', 'diri', 'hal', 'ini', 'itu', 'ke', 'kegiatan', 'konsep', 'langkah', 'materi',
  'melalui', 'pada', 'pembelajaran', 'peserta', 'siswa', 'didik', 'secara', 'sebagai',
  'serta', 'tentang', 'terhadap', 'untuk', 'yang',
]);

const MATERIAL_ONLY_STOPWORDS = new Set([
  ...STOPWORDS,
  'analisis', 'menganalisis', 'memahami', 'menerapkan', 'menjelaskan', 'mengidentifikasi',
  'menyajikan', 'menyimpulkan', 'membandingkan', 'mengevaluasi', 'membuat', 'menentukan',
  'menguraikan', 'mempraktikkan', 'mendemonstrasikan', 'mengenal', 'mempelajari',
  'menggunakan', 'menunjukkan',
]);

const COMPETENCE_GROUPS: Record<string, string[]> = {
  understand: ['memahami', 'pemahaman', 'paham', 'menjelaskan', 'jelas', 'menguraikan', 'uraikan', 'mengenal', 'identifikasi', 'mengidentifikasi', 'menunjukkan'],
  apply: ['menerapkan', 'penerapan', 'terap', 'menggunakan', 'gunakan', 'menentukan', 'tentukan', 'menghitung', 'hitung'],
  analyze: ['menganalisis', 'analisis', 'menelaah', 'telaah', 'membandingkan', 'banding', 'mengaitkan', 'kait', 'menghubungkan', 'hubung'],
  practice: ['mempraktikkan', 'praktik', 'mendemonstrasikan', 'demonstrasi', 'melakukan', 'lakukan'],
  create: ['membuat', 'buat', 'menyusun', 'susun', 'merancang', 'rancang', 'menghasilkan', 'hasil'],
  evaluate: ['mengevaluasi', 'evaluasi', 'menilai', 'nilai', 'merefleksi', 'refleksi', 'menyimpulkan', 'simpul'],
};

const COMPETENCE_EQUIVALENCE: Record<string, string[]> = {
  understand: ['understand'],
  apply: ['apply', 'practice'],
  analyze: ['analyze'],
  practice: ['practice', 'apply'],
  create: ['create'],
  evaluate: ['evaluate'],
};

function normalizeText(value?: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeToken(token: string): string {
  const normalized = normalizeText(token);
  const explicit: Record<string, string> = {
    analisis: 'analisis',
    menganalisis: 'analisis',
    paham: 'paham',
    memahami: 'paham',
    pemahaman: 'paham',
    jelas: 'jelas',
    menjelaskan: 'jelas',
    penjelasan: 'jelas',
    terap: 'terap',
    menerapkan: 'terap',
    penerapan: 'terap',
    praktik: 'praktik',
    mempraktikkan: 'praktik',
    demonstrasi: 'demonstrasi',
    mendemonstrasikan: 'demonstrasi',
    hitung: 'hitung',
    menghitung: 'hitung',
    jumlah: 'jumlah',
    menjumlahkan: 'jumlah',
    penjumlahan: 'jumlah',
    hubung: 'hubung',
    menghubungkan: 'hubung',
    kait: 'kait',
    mengaitkan: 'kait',
    evaluasi: 'evaluasi',
    mengevaluasi: 'evaluasi',
    refleksi: 'refleksi',
    merefleksi: 'refleksi',
    simpul: 'simpul',
    menyimpulkan: 'simpul',
    senilai: 'ekuivalen',
    ekuivalen: 'ekuivalen',
  };
  if (explicit[normalized]) return explicit[normalized];
  if (normalized.endsWith('nya') && normalized.length > 6) return normalized.slice(0, -3);
  return normalized;
}

function tokenize(value?: string, stopwords: Set<string> = STOPWORDS): string[] {
  const normalizedStopwords = new Set(Array.from(stopwords).map(normalizeToken));
  return normalizeText(value)
    .split(/\s+/u)
    .map(normalizeToken)
    .filter((token) => token.length >= 3 && !normalizedStopwords.has(token));
}

function uniqueTokens(value?: string, stopwords: Set<string> = STOPWORDS): string[] {
  return Array.from(new Set(tokenize(value, stopwords)));
}

function hasPhraseMatch(focusTokens: Set<string>, value?: string): boolean {
  const tokens = uniqueTokens(value, MATERIAL_ONLY_STOPWORDS);
  if (tokens.length < 2) return false;

  for (let i = 0; i < tokens.length - 1; i++) {
    if (focusTokens.has(tokens[i]) && focusTokens.has(tokens[i + 1])) return true;
  }
  return false;
}

function intersect(left: string[], rightSet: Set<string>): string[] {
  return left.filter((token) => rightSet.has(token));
}

function buildTpSubstance(tp: TPItem) {
  return {
    label: tp.code || tp.id,
    materialTokens: uniqueTokens(`${tp.contentScope || ''} ${tp.statement || ''}`, MATERIAL_ONLY_STOPWORDS),
    competenceTokens: uniqueTokens(tp.competence || ''),
    statementTokens: uniqueTokens(tp.statement || ''),
  };
}

function detectCompetenceGroups(value?: string): string[] {
  const tokens = new Set(uniqueTokens(value));
  const groups: string[] = [];

  for (const [group, words] of Object.entries(COMPETENCE_GROUPS)) {
    if (words.map(normalizeToken).some((word) => tokens.has(word))) {
      groups.push(group);
    }
  }

  return groups;
}

function hasCompatibleCompetence(focusGroups: string[], tpGroups: string[]): boolean {
  const focusSet = new Set(focusGroups);
  return tpGroups.some((group) => (COMPETENCE_EQUIVALENCE[group] || [group]).some((candidate) => focusSet.has(candidate)));
}

export function checkATPSemanticFidelity(
  focus: string | undefined,
  canonicalTPItems: TPItem[]
): ATPSemanticFidelityResult {
  const normalizedFocus = normalizeText(focus);
  if (!normalizedFocus) {
    return {
      isValid: false,
      reason: 'Fokus ATP kosong sehingga tidak dapat dibandingkan dengan TP canonical.',
      matchedSignals: [],
      missingSignals: ['focus'],
    };
  }

  if (!Array.isArray(canonicalTPItems) || canonicalTPItems.length === 0) {
    return {
      isValid: false,
      reason: 'TP canonical tertaut tidak tersedia untuk pemeriksaan semantic fidelity ATP.',
      matchedSignals: [],
      missingSignals: ['canonical TP'],
    };
  }

  const focusTokens = new Set(tokenize(focus));
  const focusMaterialTokens = new Set(tokenize(focus, MATERIAL_ONLY_STOPWORDS));
  const focusCompetenceGroups = detectCompetenceGroups(focus);
  const matchedSignals: string[] = [];
  const missingSignals: string[] = [];
  let coveredTpCount = 0;

  for (const tp of canonicalTPItems) {
    const substance = buildTpSubstance(tp);
    const materialMatches = intersect(substance.materialTokens, focusTokens);
    const statementMatches = intersect(substance.statementTokens, focusTokens);
    const phraseMatch = hasPhraseMatch(focusMaterialTokens, tp.contentScope) || hasPhraseMatch(focusMaterialTokens, tp.statement);
    const tpCompetenceGroups = detectCompetenceGroups(`${tp.competence || ''} ${tp.statement || ''}`);
    const hasCompetenceSignal = tpCompetenceGroups.length > 0 && hasCompatibleCompetence(focusCompetenceGroups, tpCompetenceGroups);

    const hasMaterialSignal = materialMatches.length > 0 || phraseMatch;

    if (hasMaterialSignal) {
      coveredTpCount += 1;
      matchedSignals.push(
        `${substance.label}: ${Array.from(new Set([...materialMatches, ...statementMatches])).slice(0, 5).join(', ') || 'frasa substansi'}`
      );
    } else {
      missingSignals.push(`${substance.label}: ${tp.contentScope || tp.statement || tp.id}`);
    }

    if (hasMaterialSignal && !hasCompetenceSignal) {
      const tpCompetenceLabel = tp.competence || 'kompetensi TP';
      missingSignals.push(`${substance.label}: fokus belum cukup menunjukkan kompetensi "${tpCompetenceLabel}" secara dapat diverifikasi.`);
    }
  }

  const allTpCovered = coveredTpCount === canonicalTPItems.length;

  if (!allTpCovered) {
    return {
      isValid: false,
      reason: `Fokus ATP tidak cukup relevan dengan substansi TP canonical tertaut (${missingSignals.join('; ')}).`,
      matchedSignals,
      missingSignals,
    };
  }

  if (missingSignals.some((signal) => signal.includes('belum cukup menunjukkan'))) {
    return {
      isValid: false,
      reason: `Fokus ATP ambigu: ada kecocokan materi tetapi kompetensi TP belum cukup dapat ditinjau (${missingSignals.join('; ')}).`,
      matchedSignals,
      missingSignals,
    };
  }

  return {
    isValid: true,
    matchedSignals,
    missingSignals,
  };
}

export function validateATPGeneratedItemsSemanticFidelity(
  items: Pick<ATPItem, 'stepNumber' | 'linkedTpIds' | 'focus'>[],
  canonicalTPItems: TPItem[]
): ATPSemanticFidelityResult {
  const tpMap = new Map(canonicalTPItems.map((tp) => [tp.id, tp]));
  const matchedSignals: string[] = [];
  const missingSignals: string[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const stepNumber = item.stepNumber || i + 1;
    const linkedTpIds = Array.isArray(item.linkedTpIds) ? item.linkedTpIds : [];
    const linkedTps = linkedTpIds.map((id) => tpMap.get(id)).filter((tp): tp is TPItem => Boolean(tp));
    const result = checkATPSemanticFidelity(item.focus, linkedTps);

    matchedSignals.push(...result.matchedSignals.map((signal) => `Langkah ${stepNumber} ${signal}`));
    if (!result.isValid) {
      missingSignals.push(`Langkah ${stepNumber}: ${result.reason || 'semantic fidelity ATP gagal.'}`);
    }
  }

  return {
    isValid: missingSignals.length === 0,
    reason: missingSignals.length > 0 ? missingSignals.join(' ') : undefined,
    matchedSignals,
    missingSignals,
  };
}
