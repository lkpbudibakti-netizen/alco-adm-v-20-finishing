export interface SemanticEvidence {
  supported: boolean;
  ambiguous: boolean;
  matchedSignals: string[];
  reason: string;
}

const STOPWORDS = new Set([
  'aktivitas', 'ajar', 'anak', 'atau', 'bab', 'baik', 'cara', 'dan', 'dalam',
  'dengan', 'di', 'fisik', 'guru', 'ini', 'kegiatan', 'kelas', 'ke', 'langkah',
  'materi', 'melalui', 'mampu', 'pada', 'pembelajaran', 'peserta', 'siswa',
  'didik', 'secara', 'serta', 'tentang', 'untuk', 'yang',
]);

const COMPETENCE_WORDS = new Set([
  'analisis', 'menganalisis', 'memahami', 'menerapkan', 'menjelaskan',
  'mengidentifikasi', 'mempraktikkan', 'menunjukkan', 'melakukan',
]);

const EQUIVALENTS: Record<string, string> = {
  bergerak: 'gerak',
  gerakan: 'gerak',
  perpindahan: 'lokomotor',
  berpindah: 'lokomotor',
  tempat: 'lokomotor',
  manipulasi: 'manipulatif',
  objek: 'manipulatif',
  bola: 'manipulatif',
  aman: 'keselamatan',
  selamat: 'keselamatan',
  cedera: 'keselamatan',
  kesehatan: 'keselamatan',
  lokomosi: 'lokomotor',
  nonlokomotor: 'non-lokomotor',
};

function normalizeText(text?: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/non\s+lokomotor/g, 'non-lokomotor')
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeToken(token: string): string {
  const cleaned = normalizeText(token);
  return EQUIVALENTS[cleaned] || cleaned;
}

function tokens(text?: string): string[] {
  return Array.from(new Set(
    normalizeText(text)
      .split(/\s+/u)
      .map(normalizeToken)
      .filter((token) => token.length > 2 && !STOPWORDS.has(token) && !COMPETENCE_WORDS.has(token))
  ));
}

function hasTwoTokenPhrase(left: Set<string>, right: string[]): boolean {
  for (let i = 0; i < right.length - 1; i++) {
    if (left.has(right[i]) && left.has(right[i + 1])) return true;
  }
  return false;
}

export function checkMappingSemanticEvidence(params: {
  label: string;
  atpItems?: Array<{ focus?: string; linkedTpIds?: string[]; tpId?: string }>;
  tpItems?: Array<{ statement?: string; competence?: string; contentScope?: string; id?: string }>;
}): SemanticEvidence {
  const labelTokens = tokens(params.label);
  const labelSet = new Set(labelTokens);
  if (labelTokens.length === 0) {
    return {
      supported: false,
      ambiguous: true,
      matchedSignals: [],
      reason: 'Judul tidak memuat sinyal substansi yang dapat dibandingkan.',
    };
  }

  const evidenceTexts = [
    ...(params.atpItems || []).map((item) => item.focus || ''),
    ...(params.tpItems || []).map((item) => `${item.statement || ''} ${item.contentScope || ''}`),
  ];

  const matchedSignals = new Set<string>();
  let phraseMatch = false;

  for (const text of evidenceTexts) {
    const candidateTokens = tokens(text);
    candidateTokens.forEach((token) => {
      if (labelSet.has(token)) matchedSignals.add(token);
    });
    if (hasTwoTokenPhrase(labelSet, candidateTokens)) {
      phraseMatch = true;
    }
  }

  const matches = Array.from(matchedSignals);
  if (phraseMatch || matches.length >= 2) {
    return {
      supported: true,
      ambiguous: false,
      matchedSignals: matches,
      reason: `Ditemukan bukti substansi: ${matches.join(', ') || 'frasa terkait'}.`,
    };
  }

  if (matches.length === 1) {
    return {
      supported: false,
      ambiguous: true,
      matchedSignals: matches,
      reason: `Hanya satu sinyal substansi terdeteksi (${matches[0]}), belum cukup untuk menyatakan selaras.`,
    };
  }

  return {
    supported: false,
    ambiguous: false,
    matchedSignals: [],
    reason: 'Tidak ditemukan bukti substansi antara judul dan TP/ATP tertaut.',
  };
}
