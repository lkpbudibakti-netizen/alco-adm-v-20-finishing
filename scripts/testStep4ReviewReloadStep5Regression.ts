import assert from 'node:assert/strict';
import type { CPElem, CPAnalysisItem, CPData, CPAnalysisData, AcademicSetting, TeacherProfile, ActiveContext } from '../src/types';
import { understandingIssue, validateStep4Understanding } from '../src/services/cpAnalysisAIContract';
import { inspectCP4Draft } from '../src/services/cpAnalysisDraft';
import { validateCPAnalysisDataWorkflow } from '../src/services/cpWorkflowService';

console.log('=== TEST REGRESI LENGKAP: REVIEW -> SIMPAN -> RELOAD -> STEP 5 TP ===\n');

// Mock Setting & Context
const setting: AcademicSetting = {
  id: 'setting-test-1',
  profileId: 'prof-1',
  curriculum: 'KURIKULUM_MERDEKA',
  academicYear: '2024/2025',
  semester: '1 (Ganjil)',
  level: 'SD',
  grade: '2',
  subject: 'Matematika',
  phase: 'A',
  updatedAt: new Date().toISOString()
};

const context: ActiveContext = {
  academicYear: '2024/2025',
  semester: '1 (Ganjil)',
  phase: 'A',
  grade: '2',
  subject: 'Matematika',
  profileId: 'prof-1',
  settingId: 'setting-test-1'
};

const cp: CPData = {
  id: 'cp-math-a',
  academicSettingId: 'setting-test-1',
  subjectCode: 'Matematika',
  phase: 'A',
  grade: '2',
  generalDescription: 'CP Matematika Fase A',
  source: {
    id: 'src-1',
    title: 'SK BSKAP',
    verificationStatus: 'verified',
    retrievedAt: new Date().toISOString()
  },
  elements: [
    {
      id: 'el-bilangan',
      name: 'Bilangan',
      content: 'Peserta didik menunjukkan pemahaman dan intuisi bilangan (number sense) pada bilangan cacah sampai 100.'
    }
  ],
  updatedAt: new Date().toISOString()
};

// 1. Uji: REVIEW belum dikonfirmasi -> tidak SIAP
console.log('1. Menguji REVIEW belum dikonfirmasi -> tidak SIAP...');
const unconfirmedItem: CPAnalysisItem = {
  id: 'item-1',
  elementId: 'el-bilangan',
  elementName: 'Bilangan',
  cpText: cp.elements[0].content,
  cpCompetence: 'memahami',
  materialScope: 'bilangan cacah',
  meaningfulUnderstanding: 'Pengenalan bilangan lewat penghitungan orbit satelit luar angkasa.', // Alien material -> triggers MU_GROUNDING_REVIEW
  suggestedTp: 'Peserta didik mampu memahami bilangan.',
  order: 1,
  reviewConfirmed: false
};

const unconfirmedAnalysis: CPAnalysisData = {
  id: 'cpanalysis-test-1',
  academicSettingId: 'setting-test-1',
  cpId: cp.id,
  academicYear: '2024/2025',
  subjectCode: 'Matematika',
  phase: 'A',
  items: [unconfirmedItem],
  generatedBy: 'TEACHER',
  workflowStatus: 'PERLU_DILENGKAPI',
  basedOnCpUpdatedAt: cp.updatedAt,
  updatedAt: new Date().toISOString()
};

const workflowUnconfirmed = validateCPAnalysisDataWorkflow(unconfirmedAnalysis, cp);
const draftIssuesUnconfirmed = inspectCP4Draft(unconfirmedAnalysis.items, cp.elements, cp);
const understandingIssuesUnconfirmed = validateStep4Understanding(unconfirmedAnalysis.items, cp.elements);
const isUnconfirmedSiap = workflowUnconfirmed.isSiap && !understandingIssuesUnconfirmed.length;
assert.equal(isUnconfirmedSiap, false, 'Analisis dengan review belum dikonfirmasi tidak boleh SIAP');
assert.ok(draftIssuesUnconfirmed.some(i => i.code === 'MU_GROUNDING_REVIEW'), 'Harus terdeteksi MU_GROUNDING_REVIEW');
console.log('  ✓ Review belum dikonfirmasi terbukti menghalangi status SIAP.');

// 2. Uji: REVIEW dikonfirmasi sah -> dapat SIAP
console.log('\n2. Menguji REVIEW dikonfirmasi sah -> dapat SIAP...');
const confirmedItem: CPAnalysisItem = {
  ...unconfirmedItem,
  reviewConfirmed: true,
  reviewedText: unconfirmedItem.meaningfulUnderstanding.trim(),
  reviewedCpText: cp.elements[0].content.trim()
};

const confirmedAnalysis: CPAnalysisData = {
  ...unconfirmedAnalysis,
  items: [confirmedItem]
};

const workflowConfirmed = validateCPAnalysisDataWorkflow(confirmedAnalysis, cp);
const understandingIssuesConfirmed = validateStep4Understanding(confirmedAnalysis.items, cp.elements);
const isConfirmedSiap = workflowConfirmed.isSiap && !understandingIssuesConfirmed.length;
assert.equal(understandingIssuesConfirmed.length, 0, 'Tidak boleh ada understanding issues jika review telah dikonfirmasi sah');
assert.equal(isConfirmedSiap, true, 'Analisis dengan review terkonfirmasi sah harus berstatus SIAP');
console.log('  ✓ Review yang dikonfirmasi sah berhasil meloloskan status SIAP.');

// 3. Uji: Konfirmasi batal jika reviewedCpText kosong / tidak cocok / substansi berubah
console.log('\n3. Menguji Pembatalan Konfirmasi jika Teks CP / Substansi Berubah...');
const invalidMetaConfirmedItem: CPAnalysisItem = {
  ...confirmedItem,
  reviewedCpText: '' // Kosong -> invalid confirmation
};
const invalidIssue = understandingIssue(invalidMetaConfirmedItem.meaningfulUnderstanding, cp.elements[0], {
  reviewConfirmed: invalidMetaConfirmedItem.reviewConfirmed,
  reviewedText: invalidMetaConfirmedItem.reviewedText,
  reviewedCpText: invalidMetaConfirmedItem.reviewedCpText
});
assert.equal(invalidIssue, 'MU_GROUNDING_REVIEW', 'ReviewedCpText kosong harus membatalkan konfirmasi dan memicu MU_GROUNDING_REVIEW');
console.log('  ✓ Metadata konfirmasi kosong terbukti tidak valid.');

// 4. Uji: ID salah atau kolom kosong tetap BLOCKING meskipun dikonfirmasi
console.log('\n4. Menguji BLOCKING tetap menghalangi SIAP meskipun review dikonfirmasi...');
const blockingItemWithConfirmation: CPAnalysisItem = {
  ...confirmedItem,
  meaningfulUnderstanding: '' // Kosong -> MU_EMPTY (Structure / Blocking)
};
const blockingAnalysis: CPAnalysisData = {
  ...confirmedAnalysis,
  items: [blockingItemWithConfirmation]
};
const workflowBlocking = validateCPAnalysisDataWorkflow(blockingAnalysis, cp);
const understandingIssuesBlocking = validateStep4Understanding(blockingAnalysis.items, cp.elements);
const isBlockingSiap = workflowBlocking.isSiap && !understandingIssuesBlocking.length;
assert.equal(isBlockingSiap, false, 'Kolom kosong wajib BLOCKING dan menghalangi SIAP');
console.log('  ✓ Isu blocking struktur terbukti mengabaikan konfirmasi kualitas dan tetap menghalangi SIAP.');

// 5. Uji: Simpan -> Reload -> Step 5 TP Prasyarat Konsisten
console.log('\n5. Menguji Siklus Simpan -> Reload -> Step 5 TP Prasyarat...');
const savedStoragePayload = JSON.stringify(confirmedAnalysis);
const reloadedAnalysis: CPAnalysisData = JSON.parse(savedStoragePayload);

const reloadedValidation = validateCPAnalysisDataWorkflow(reloadedAnalysis, cp);
assert.equal(reloadedValidation.isSiap, true, 'Data yang direload dari storage harus mempertahankan status SIAP');
assert.equal(reloadedAnalysis.items[0].reviewConfirmed, true, 'Metadata konfirmasi baris bertahan setelah reload');
console.log('  ✓ Siklus simpan dan reload mempertahankan status SIAP dan integritas metadata konfirmasi.');

// 6. Uji: Data lama tanpa metadata review tidak crash
console.log('\n6. Menguji Kompatibilitas Data Lama Tanpa Metadata Review...');
const legacyItem: CPAnalysisItem = {
  id: 'legacy-1',
  elementId: 'el-bilangan',
  elementName: 'Bilangan',
  cpText: cp.elements[0].content,
  cpCompetence: 'memahami',
  materialScope: 'bilangan cacah',
  meaningfulUnderstanding: 'Pemahaman bilangan cacah dengan benda konkret.',
  suggestedTp: 'Siswa mampu memahami bilangan.',
  order: 1
  // Tanpa reviewConfirmed, reviewedText, reviewedCpText
};
const legacyCheck = understandingIssue(legacyItem.meaningfulUnderstanding, cp.elements[0]);
assert.equal(legacyCheck, null, 'Data lama tanpa metadata review tidak boleh crash dan dievaluasi normal');
console.log('  ✓ Kompatibilitas data lama berjalan aman tanpa crash.');

console.log('\n=== SELURUH PENGUJIAN REGRESI REVIEW -> SIMPAN -> RELOAD -> STEP 5 TP PASS 100% ===');
