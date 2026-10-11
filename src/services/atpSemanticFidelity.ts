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
  'melalui', 'memahami', 'mempelajari', 'mengenal', 'menggunakan', 'menjelaskan',
  'menunjukkan', 'pada', 'pembelajaran', 'peserta', 'siswa', 'didik', 'secara',
  'sebagai', 'serta', 'tentang', 'terhadap', 'untuk', 'yang',
]);

const COMPETENCE_STOPWORDS = new Set([
  'analisis', 'menganalisis', 'memahami', 'menerapkan', 'menjelaskan', 'mengidentifikasi',
  'menyajikan', 'menyimpulkan', 'membandingkan', 'mengevaluasi', 'membuat', 'menentukan',
  'menguraikan', 'mempraktikkan', 'mendemonstrasikan',
]);

function normalizeText(value?: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function singularizeToken(token: string): string {
  if (token.length <= 4) return token;
  return token
    .replace(/(kan|nya|lah|pun)$/u, '')
    .replace(/^(memper|meng|meny|men|mem|me|ber|ter|di|ke|se|pe|pem|peny|pen|peng)/u, '');
}

function tokenize(value?: string): string[] {
  return normalizeText(value)
    .split(/\s+/u)
    .map(singularizeToken)
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

function uniqueTokens(value?: string): string[] {
  return Array.from(new Set(tokenize(value)));
}

function hasPhraseMatch(focusNorm: string, value?: string): boolean {
  const tokens = uniqueTokens(value).filter((token) => !COMPETENCE_STOPWORDS.has(token));
  if (tokens.length < 2) return false;

  for (let i = 0; i < tokens.length - 1; i++) {
    if (focusNorm.includes(`${tokens[i]} ${tokens[i + 1]}`)) return true;
  }
  return false;
}

function intersect(left: string[], rightSet: Set<string>): string[] {
  return left.filter((token) => rightSet.has(token));
}

function buildTpSubstance(tp: TPItem) {
  return {
    label: tp.code || tp.id,
    materialTokens: uniqueTokens(`${tp.contentScope || ''} ${tp.statement || ''}`).filter((token) => !COMPETENCE_STOPWORDS.has(token)),
    competenceTokens: uniqueTokens(tp.competence || ''),
    statementTokens: uniqueTokens(tp.statement || ''),
  };
}

export function checkATPSemanticFidelity(
  focus: string | undefined,
  canonicalTPItems: TPItem[]
): ATPSemanticFidelityResult {
  const focusNorm = normalizeText(focus);
  if (!focusNorm) {
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
  const matchedSignals: string[] = [];
  const missingSignals: string[] = [];
  let coveredTpCount = 0;

  for (const tp of canonicalTPItems) {
    const substance = buildTpSubstance(tp);
    const materialMatches = intersect(substance.materialTokens, focusTokens);
    const competenceMatches = intersect(substance.competenceTokens, focusTokens);
    const statementMatches = intersect(substance.statementTokens, focusTokens);
    const phraseMatch = hasPhraseMatch(focusNorm, tp.contentScope) || hasPhraseMatch(focusNorm, tp.statement);

    const hasMaterialSignal = materialMatches.length > 0 || phraseMatch;
    const hasSupportSignal = competenceMatches.length > 0 || statementMatches.length >= 2 || phraseMatch;

    if (hasMaterialSignal) {
      coveredTpCount += 1;
      matchedSignals.push(
        `${substance.label}: ${Array.from(new Set([...materialMatches, ...competenceMatches, ...statementMatches])).slice(0, 5).join(', ') || 'frasa substansi'}`
      );
    } else {
      missingSignals.push(`${substance.label}: ${tp.contentScope || tp.statement || tp.id}`);
    }

    if (hasMaterialSignal && !hasSupportSignal) {
      missingSignals.push(`${substance.label}: fokus belum cukup menunjukkan kompetensi/konteks TP tertaut.`);
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
      reason: `Fokus ATP ambigu: ada kecocokan materi tetapi kompetensi/konteks TP belum cukup dapat ditinjau (${missingSignals.join('; ')}).`,
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
