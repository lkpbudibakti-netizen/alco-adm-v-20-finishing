import {
  checkATPSemanticFidelity,
  validateATPGeneratedItemsSemanticFidelity,
} from '../src/services/atpSemanticFidelity';
import { prepareATPFinalization } from '../src/services/atpFinalizationService';
import { validateATPDataWorkflow } from '../src/services/cpWorkflowService';
import type { AcademicSetting, ATPData, ATPItem, CPAnalysisData, CPData, TPData, TPItem } from '../src/types';

let failed = 0;

function assertCase(condition: boolean, label: string, details?: unknown) {
  if (condition) {
    console.log(`PASS ${label}`);
    return;
  }
  failed += 1;
  console.error(`FAIL ${label}`);
  if (details !== undefined) console.error(details);
}

const academicSetting: AcademicSetting = {
  id: 'acad-p0c',
  profileId: 'profile-p0c',
  curriculum: 'Kurikulum Merdeka',
  academicYear: '2026/2027',
  semester: '1',
  subject: 'Matematika',
  grade: 'Kelas 4',
  phase: 'Fase B',
  level: 'SD',
  totalHoursPerWeek: 4,
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const cp: CPData = {
  id: 'cp-p0c',
  academicSettingId: academicSetting.id,
  generalDescription: 'Peserta didik memahami bilangan pecahan dan pengukuran dalam pemecahan masalah sehari-hari.',
  elements: [
    { id: 'elem-1', code: 'E1', name: 'Bilangan', content: 'Pecahan dan operasi pecahan.' },
    { id: 'elem-2', code: 'E2', name: 'Pengukuran', content: 'Keliling dan luas bangun datar.' },
  ],
  source: { verificationStatus: 'VERIFIED' } as any,
  workflowStatus: 'SIAP',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const cpAnalysis: CPAnalysisData = {
  id: 'analysis-p0c',
  academicSettingId: academicSetting.id,
  cpId: cp.id,
  generalSummary: 'Analisis CP Matematika fase B.',
  workflowStatus: 'SIAP',
  needsReview: false,
  items: [
    {
      id: 'ana-pecahan',
      elementId: 'elem-1',
      elementName: 'Bilangan',
      scopeCode: 'PEC',
      cpCompetence: 'Memahami dan menerapkan',
      materialScope: 'Pecahan senilai dan penjumlahan pecahan',
      order: 1,
    },
    {
      id: 'ana-ukur',
      elementId: 'elem-2',
      elementName: 'Pengukuran',
      scopeCode: 'UKR',
      cpCompetence: 'Menganalisis',
      materialScope: 'Keliling dan luas persegi panjang',
      order: 2,
    },
  ],
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const tpItems: TPItem[] = [
  {
    id: 'tp-pecahan',
    code: 'E1-PEC-01',
    cpAnalysisId: 'ana-pecahan',
    cpAnalysisItemIds: ['ana-pecahan'],
    elementName: 'Bilangan',
    statement: 'Peserta didik menjelaskan pecahan senilai dan menerapkan penjumlahan pecahan berpenyebut sama.',
    competence: 'Menjelaskan dan menerapkan',
    contentScope: 'Pecahan senilai dan penjumlahan pecahan',
    order: 1,
  },
  {
    id: 'tp-ukur',
    code: 'E2-UKR-01',
    cpAnalysisId: 'ana-ukur',
    cpAnalysisItemIds: ['ana-ukur'],
    elementName: 'Pengukuran',
    statement: 'Peserta didik menganalisis keliling dan luas persegi panjang dalam konteks sehari-hari.',
    competence: 'Menganalisis',
    contentScope: 'Keliling dan luas persegi panjang',
    order: 2,
  },
];

const tpData: TPData = {
  id: 'tpdata-p0c',
  academicSettingId: academicSetting.id,
  cpId: cp.id,
  cpAnalysisId: cpAnalysis.id,
  academicYear: academicSetting.academicYear,
  subjectCode: academicSetting.subject,
  phase: academicSetting.phase,
  items: tpItems,
  basedOnCpUpdatedAt: cp.updatedAt,
  basedOnAnalysisUpdatedAt: cpAnalysis.updatedAt,
  workflowStatus: 'SIAP',
  needsReview: false,
  updatedAt: '2026-01-02T00:00:00.000Z',
};

function atp(items: ATPItem[], overrides: Partial<ATPData> = {}): ATPData {
  return {
    id: 'atp-p0c',
    academicSettingId: academicSetting.id,
    tpId: tpData.id,
    tpDataId: tpData.id,
    items,
    workflowStatus: 'SIAP',
    needsReview: false,
    basedOnTpUpdatedAt: tpData.updatedAt,
    updatedAt: '2026-01-03T00:00:00.000Z',
    ...overrides,
  };
}

const validSingle = checkATPSemanticFidelity('Memahami pecahan senilai dan menerapkan penjumlahan pecahan', [tpItems[0]]);
assertCase(validSingle.isValid, 'Focus sesuai TP canonical');

const competencyAligned = checkATPSemanticFidelity('Menerapkan penjumlahan pecahan senilai', [tpItems[0]]);
assertCase(competencyAligned.isValid, 'Materi sama + kompetensi sesuai PASS', competencyAligned);

const practiceTp: TPItem = {
  ...tpItems[0],
  id: 'tp-praktik-pecahan',
  code: 'E1-PEC-02',
  statement: 'Peserta didik mempraktikkan penggunaan pecahan senilai dengan alat peraga.',
  competence: 'Mempraktikkan',
  contentScope: 'Pecahan senilai',
};
const conflictingCompetence = checkATPSemanticFidelity('Menganalisis pecahan senilai', [practiceTp]);
assertCase(!conflictingCompetence.isValid, 'Materi sama + kompetensi bertentangan FAIL', conflictingCompetence);

const unclearCompetence = checkATPSemanticFidelity('Pembelajaran pecahan senilai dan penjumlahan pecahan', [tpItems[0]]);
assertCase(!unclearCompetence.isValid, 'Materi sama + kompetensi tidak jelas AMBIGU/FAIL', unclearCompetence);

const equivalentCompetence = checkATPSemanticFidelity('Menggunakan penjumlahan pecahan senilai untuk menyelesaikan soal', [tpItems[0]]);
assertCase(equivalentCompetence.isValid, 'Kompetensi setara, redaksi berbeda PASS jika dapat dibuktikan', equivalentCompetence);

const paraphrasedMaterial = checkATPSemanticFidelity('Menerapkan kegiatan menjumlahkan pecahan ekuivalen', [tpItems[0]]);
assertCase(paraphrasedMaterial.isValid, 'Parafrasa materi dengan makna setara PASS jika dapat dibuktikan', paraphrasedMaterial);

const wrongDomain = checkATPSemanticFidelity('Membaca puisi rakyat dan menulis pantun', [tpItems[0]]);
assertCase(!wrongDomain.isValid, 'Exact TP ID benar, focus beda domain FAIL', wrongDomain);

const validMulti = checkATPSemanticFidelity(
  'Menerapkan pecahan serta menganalisis pengukuran keliling dan luas persegi panjang',
  tpItems
);
assertCase(validMulti.isValid, 'Multi-TP ringkasan gabungan koheren PASS', validMulti);

const missingOneDomain = checkATPSemanticFidelity('Menerapkan penjumlahan pecahan senilai', tpItems);
assertCase(!missingOneDomain.isValid, 'Multi-TP dengan salah satu domain hilang FAIL', missingOneDomain);

const genericOnly = checkATPSemanticFidelity('Mengembangkan kompetensi melalui kegiatan pembelajaran yang baik', [tpItems[0]]);
assertCase(!genericOnly.isValid, 'Fokus menggunakan kata-kata umum saja FAIL', genericOnly);

const invalidMulti = checkATPSemanticFidelity('Menelaah struktur teks laporan hasil observasi', tpItems);
assertCase(!invalidMulti.isValid, 'Multi-TP focus menyesatkan FAIL', invalidMulti);

const changedTpData: TPData = {
  ...tpData,
  items: [
    {
      ...tpItems[0],
      statement: 'Peserta didik menganalisis daur hidup tumbuhan berbunga.',
      competence: 'Menganalisis',
      contentScope: 'Daur hidup tumbuhan berbunga',
    },
    tpItems[1],
  ],
  updatedAt: '2026-01-05T00:00:00.000Z',
};

const staleOldAtp = atp([
  { id: 'atp-1', stepNumber: 1, linkedTpIds: ['tp-pecahan'], focus: 'Memahami pecahan senilai dan penjumlahan pecahan' },
  { id: 'atp-2', stepNumber: 2, linkedTpIds: ['tp-ukur'], focus: 'Menganalisis keliling dan luas persegi panjang' },
]);
const staleResult = validateATPDataWorkflow(staleOldAtp, changedTpData, academicSetting, cp, cpAnalysis);
assertCase(!staleResult.isSiap && staleResult.issues.some((issue) => issue.includes('ATP_SEMANTIC_FIDELITY')), 'TP berubah substantif, ATP lama tidak sesuai FAIL', staleResult.issues);

const reconfirmedStillAligned = atp(
  [
    { id: 'atp-1', stepNumber: 1, linkedTpIds: ['tp-pecahan'], focus: 'Menganalisis daur hidup tumbuhan berbunga' },
    { id: 'atp-2', stepNumber: 2, linkedTpIds: ['tp-ukur'], focus: 'Menganalisis keliling dan luas persegi panjang' },
  ],
  { basedOnTpUpdatedAt: changedTpData.updatedAt }
);
const reconfirmedResult = validateATPDataWorkflow(reconfirmedStillAligned, changedTpData, academicSetting, cp, cpAnalysis);
assertCase(reconfirmedResult.isSiap, 'TP berubah tetapi ATP masih sesuai dan dikonfirmasi ulang PASS', reconfirmedResult.issues);

const persisted = atp([
  { id: 'atp-1', stepNumber: 1, linkedTpIds: ['tp-pecahan'], focus: 'Memahami pecahan senilai dan penjumlahan pecahan' },
  { id: 'atp-2', stepNumber: 2, linkedTpIds: ['tp-ukur'], focus: 'Menganalisis keliling dan luas persegi panjang' },
], {
  needsReview: true,
  reviewReason: 'TP acuan berubah.',
  updatedAt: '2026-01-03T00:00:00.000Z',
});
let saved: ATPData = persisted;
const failingCandidate = atp([
  { id: 'atp-1', stepNumber: 1, linkedTpIds: ['tp-pecahan'], focus: 'Membaca puisi rakyat' },
  { id: 'atp-2', stepNumber: 2, linkedTpIds: ['tp-ukur'], focus: 'Menganalisis keliling dan luas persegi panjang' },
], { needsReview: false, reviewReason: undefined });
const finalizationResult = prepareATPFinalization({
  atp: failingCandidate,
  tp: tpData,
  academicSetting,
  cp,
  cpAnalysis,
  rationale: 'Draf finalisasi gagal',
  subject: academicSetting.subject,
  phase: academicSetting.phase,
  academicYear: academicSetting.academicYear,
});
if (finalizationResult.canFinalize && finalizationResult.candidate) {
  saved = finalizationResult.candidate;
}
assertCase(saved === persisted && saved.needsReview === true, 'Finalisasi gagal tidak mengubah persisted ATP');

const aiSemanticReject = validateATPGeneratedItemsSemanticFidelity(
  [
    { stepNumber: 1, linkedTpIds: ['tp-pecahan'], focus: 'Membaca puisi rakyat dan menulis pantun' },
    { stepNumber: 2, linkedTpIds: ['tp-ukur'], focus: 'Menganalisis keliling dan luas persegi panjang' },
  ],
  tpItems
);
assertCase(!aiSemanticReject.isValid, 'Output Gemini salah secara semantik REJECT', aiSemanticReject);

if (failed > 0) {
  console.error(`P0-C ATP semantic fidelity regression failed: ${failed} scenario(s).`);
  process.exit(1);
}

console.log('P0-C ATP semantic fidelity regression scenarios passed.');
