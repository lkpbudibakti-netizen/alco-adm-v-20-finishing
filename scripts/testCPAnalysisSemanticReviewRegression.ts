import assert from 'node:assert';
import {
  reviewCPAnalysisSemantic,
  detectCompetenceGroups,
} from '../src/services/cpAnalysisSemanticReviewService';
import type { CPData, CPAnalysisItem } from '../src/types';

console.log('=== RUNNING REGRESSION: CP ANALYSIS SEMANTIC REVIEW SERVICE ===\n');

let totalTests = 0;
let passedTests = 0;

function runTest(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] ${totalTests}. ${name}`);
    passedTests++;
  } catch (err: any) {
    console.error(`[FAIL] ${totalTests}. ${name}:`, err.message);
    throw err;
  }
}

const sampleCanonicalCP: CPData = {
  id: 'cp-pjok-fase-b',
  academicSettingId: 'acad-pjok-b',
  generalDescription: 'Peserta didik mempraktikkan keterampilan gerak fundamental dan menerapkan pola hidup sehat.',
  elements: [
    {
      id: 'elem-1',
      code: 'E1',
      name: 'Terampil Bergerak',
      content: 'Peserta didik mempraktikkan keterampilan gerak fundamental lokomotor, non-lokomotor, dan manipulatif dalam berbagai permainan.',
    },
    {
      id: 'elem-2',
      code: 'E2',
      name: 'Belajar Melalui Gerak',
      content: 'Peserta didik menerapkan perilaku fair play dan menunjukkan kerjasama dalam aktivitas jasmani kelompok.',
    },
    {
      id: 'elem-3',
      code: 'E3',
      name: 'Memilih Hidup Sehat',
      content: 'Peserta didik mengeksplorasi pola makan sehat bergizi seimbang dan mempraktikkan penanganan cedera ringan.',
    },
  ],
  workflowStatus: 'SIAP',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

// 1. Competence detection
runTest('1. detectCompetenceGroups correctly identifies single and compound verbs', () => {
  const comp1 = detectCompetenceGroups('Mempraktikkan gerak dasar');
  assert.ok(comp1.includes('practice'), 'Should detect practice');

  const comp2 = detectCompetenceGroups('Memahami dan menjelaskan konsep');
  assert.ok(comp2.includes('understand'), 'Should detect understand');

  const comp3 = detectCompetenceGroups('Menganalisis dan menyusun strategi');
  assert.ok(comp3.includes('analyze'), 'Should detect analyze');
  assert.ok(comp3.includes('create'), 'Should detect create');

  const comp4 = detectCompetenceGroups('Mengeksplorasi pola makan sehat');
  assert.ok(comp4.includes('explore'), 'Should detect explore');
});

// 2. Competence mismatch detection: practice -> understand dilution
runTest('2. COMPETENCE_MISMATCH: flags downward dilution from practical skill to theoretical understanding', () => {
  const items: CPAnalysisItem[] = [
    {
      id: 'item-diluted',
      elementId: 'elem-1',
      elementName: 'Terampil Bergerak',
      cpText: sampleCanonicalCP.elements[0].content,
      cpCompetence: 'Memahami', // CP requires 'mempraktikkan'
      materialScope: 'keterampilan gerak fundamental lokomotor, non-lokomotor, manipulatif',
      order: 1,
    },
    {
      id: 'item-2',
      elementId: 'elem-2',
      elementName: 'Belajar Melalui Gerak',
      cpText: sampleCanonicalCP.elements[1].content,
      cpCompetence: 'Menerapkan',
      materialScope: 'perilaku fair play dan kerjasama',
      order: 2,
    },
    {
      id: 'item-3',
      elementId: 'elem-3',
      elementName: 'Memilih Hidup Sehat',
      cpText: sampleCanonicalCP.elements[2].content,
      cpCompetence: 'Mengeksplorasi dan mempraktikkan',
      materialScope: 'pola makan sehat bergizi seimbang dan penanganan cedera ringan',
      order: 3,
    },
  ];

  const result = reviewCPAnalysisSemantic(items, sampleCanonicalCP);
  assert.ok(result.totalFindings > 0, 'Should flag findings');
  const mismatchFinding = result.findings.find((f) => f.type === 'COMPETENCE_MISMATCH');
  assert.ok(mismatchFinding, 'Must identify COMPETENCE_MISMATCH');
  assert.strictEqual(mismatchFinding?.itemId, 'item-diluted');
  assert.strictEqual(mismatchFinding?.severity, 'WARNING');
  assert.strictEqual(mismatchFinding?.confidence, 'HIGH');
  assert.ok(mismatchFinding?.reason.includes('praktik'), 'Reason must mention practical skill dilution');
});

// 3. Unsupported material addition detection
runTest('3. UNSUPPORTED_ADDITION: flags completely ungrounded alien topics', () => {
  const items: CPAnalysisItem[] = [
    {
      id: 'item-alien',
      elementId: 'elem-1',
      elementName: 'Terampil Bergerak',
      cpText: sampleCanonicalCP.elements[0].content,
      cpCompetence: 'Mempraktikkan',
      materialScope: 'pemrograman python dan algoritma kecerdasan buatan', // Alien topic
      order: 1,
    },
    {
      id: 'item-2',
      elementId: 'elem-2',
      elementName: 'Belajar Melalui Gerak',
      cpText: sampleCanonicalCP.elements[1].content,
      cpCompetence: 'Menerapkan',
      materialScope: 'perilaku fair play dan kerjasama',
      order: 2,
    },
    {
      id: 'item-3',
      elementId: 'elem-3',
      elementName: 'Memilih Hidup Sehat',
      cpText: sampleCanonicalCP.elements[2].content,
      cpCompetence: 'Mengeksplorasi dan mempraktikkan',
      materialScope: 'pola makan sehat bergizi seimbang dan penanganan cedera ringan',
      order: 3,
    },
  ];

  const result = reviewCPAnalysisSemantic(items, sampleCanonicalCP);
  const unsupportedFinding = result.findings.find((f) => f.type === 'UNSUPPORTED_ADDITION');
  assert.ok(unsupportedFinding, 'Must identify UNSUPPORTED_ADDITION');
  assert.strictEqual(unsupportedFinding?.itemId, 'item-alien');
  assert.strictEqual(unsupportedFinding?.severity, 'WARNING');
});

// 4. Missing element detection
runTest('4. MATERIAL_MISSING: flags unanalyzed canonical element', () => {
  const items: CPAnalysisItem[] = [
    {
      id: 'item-1',
      elementId: 'elem-1',
      elementName: 'Terampil Bergerak',
      cpText: sampleCanonicalCP.elements[0].content,
      cpCompetence: 'Mempraktikkan',
      materialScope: 'keterampilan gerak fundamental lokomotor, non-lokomotor, manipulatif',
      order: 1,
    },
    // elem-2 and elem-3 omitted
  ];

  const result = reviewCPAnalysisSemantic(items, sampleCanonicalCP);
  const missingElemFindings = result.findings.filter((f) => f.type === 'MATERIAL_MISSING');
  assert.ok(missingElemFindings.length >= 2, 'Must flag missing elements 2 and 3');
  assert.ok(missingElemFindings.some((f) => f.elementId === 'elem-2'));
  assert.ok(missingElemFindings.some((f) => f.elementId === 'elem-3'));
});

// 5. Inconsistent suggested TP detection
runTest('5. SUGGESTED_TP_INCONSISTENT: flags draft TP that contradicts analysis row', () => {
  const items: CPAnalysisItem[] = [
    {
      id: 'item-inconsistent-tp',
      elementId: 'elem-1',
      elementName: 'Terampil Bergerak',
      cpText: sampleCanonicalCP.elements[0].content,
      cpCompetence: 'Mempraktikkan',
      materialScope: 'keterampilan gerak fundamental lokomotor dan non-lokomotor',
      suggestedTp: 'Peserta didik menghafal teori sejarah senam lantai kuno.', // Contradicts competence and material
      order: 1,
    },
    {
      id: 'item-2',
      elementId: 'elem-2',
      elementName: 'Belajar Melalui Gerak',
      cpText: sampleCanonicalCP.elements[1].content,
      cpCompetence: 'Menerapkan',
      materialScope: 'perilaku fair play dan kerjasama kelompok',
      order: 2,
    },
    {
      id: 'item-3',
      elementId: 'elem-3',
      elementName: 'Memilih Hidup Sehat',
      cpText: sampleCanonicalCP.elements[2].content,
      cpCompetence: 'Mengeksplorasi dan mempraktikkan',
      materialScope: 'pola makan sehat bergizi seimbang dan penanganan cedera ringan',
      order: 3,
    },
  ];

  const result = reviewCPAnalysisSemantic(items, sampleCanonicalCP);
  const tpFinding = result.findings.find((f) => f.type === 'SUGGESTED_TP_INCONSISTENT');
  assert.ok(tpFinding, 'Must identify SUGGESTED_TP_INCONSISTENT');
  assert.strictEqual(tpFinding?.itemId, 'item-inconsistent-tp');
});

// 6. Complete and well-aligned CP analysis passes with 0 warnings
runTest('6. PERFECT_ALIGNMENT: completely aligned CP analysis produces zero warnings', () => {
  const items: CPAnalysisItem[] = [
    {
      id: 'item-1',
      elementId: 'elem-1',
      elementName: 'Terampil Bergerak',
      cpText: sampleCanonicalCP.elements[0].content,
      cpCompetence: 'Mempraktikkan',
      materialScope: 'keterampilan gerak fundamental lokomotor non-lokomotor manipulatif berbagai permainan',
      suggestedTp: 'Peserta didik mempraktikkan keterampilan gerak fundamental lokomotor non-lokomotor manipulatif.',
      order: 1,
    },
    {
      id: 'item-2',
      elementId: 'elem-2',
      elementName: 'Belajar Melalui Gerak',
      cpText: sampleCanonicalCP.elements[1].content,
      cpCompetence: 'Menerapkan',
      materialScope: 'perilaku fair play dan kerjasama kelompok aktivitas jasmani',
      suggestedTp: 'Peserta didik menerapkan perilaku fair play dan kerjasama kelompok dalam aktivitas jasmani.',
      order: 2,
    },
    {
      id: 'item-3',
      elementId: 'elem-3',
      elementName: 'Memilih Hidup Sehat',
      cpText: sampleCanonicalCP.elements[2].content,
      cpCompetence: 'Mengeksplorasi dan mempraktikkan',
      materialScope: 'pola makan sehat bergizi seimbang dan penanganan cedera ringan',
      suggestedTp: 'Peserta didik mengeksplorasi pola makan sehat bergizi seimbang dan mempraktikkan penanganan cedera ringan.',
      order: 3,
    },
  ];

  const result = reviewCPAnalysisSemantic(items, sampleCanonicalCP);
  assert.strictEqual(result.warningCount, 0, 'Warning count must be 0 for perfectly aligned analysis');
  assert.strictEqual(result.isValid, true, 'Review result must be valid');
  assert.ok(result.summaryMessage.includes('selaras secara semantik'), 'Summary message must confirm alignment');
});

console.log(`\n========================================`);
console.log(`CP ANALYSIS SEMANTIC REVIEW: ALL ${passedTests}/${totalTests} TESTS PASSED`);
console.log(`========================================\n`);
