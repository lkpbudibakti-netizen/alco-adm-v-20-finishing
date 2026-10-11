import { sanitizeMappingAnalysisResult } from '../server/mappingAnalysis';
import { checkMappingSemanticEvidence } from '../server/mappingSemanticEvidence';
import type { ATPData, ATPUnitMappingData, TPData } from '../src/types';

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

const tpData: TPData = {
  id: 'tp-pjok',
  academicSettingId: 'acad-pjok',
  items: [
    {
      id: 'tp-loko',
      code: 'E1-GER-01',
      statement: 'Peserta didik mempraktikkan variasi gerak lokomotor seperti berjalan dan berlari.',
      competence: 'Mempraktikkan',
      contentScope: 'Gerak lokomotor',
      order: 1,
    },
    {
      id: 'tp-non',
      code: 'E1-GER-02',
      statement: 'Peserta didik mempraktikkan variasi gerak non-lokomotor seperti menekuk dan memutar.',
      competence: 'Mempraktikkan',
      contentScope: 'Gerak non-lokomotor',
      order: 2,
    },
    {
      id: 'tp-manip',
      code: 'E1-GER-03',
      statement: 'Peserta didik mempraktikkan variasi gerak manipulatif menggunakan bola.',
      competence: 'Mempraktikkan',
      contentScope: 'Variasi gerak manipulatif',
      order: 3,
    },
    {
      id: 'tp-safe',
      code: 'E2-KES-01',
      statement: 'Peserta didik menerapkan keselamatan aktivitas fisik agar terhindar dari cedera.',
      competence: 'Menerapkan',
      contentScope: 'Keselamatan aktivitas fisik',
      order: 4,
    },
  ],
  workflowStatus: 'SIAP',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const atpData: ATPData = {
  id: 'atp-pjok',
  academicSettingId: 'acad-pjok',
  tpDataId: tpData.id,
  items: [
    { id: 'atp-loko', stepNumber: 1, linkedTpIds: ['tp-loko'], focus: 'Variasi gerak lokomotor' },
    { id: 'atp-non', stepNumber: 2, linkedTpIds: ['tp-non'], focus: 'Variasi gerak non-lokomotor' },
    { id: 'atp-manip', stepNumber: 3, linkedTpIds: ['tp-manip'], focus: 'Variasi gerak manipulatif menggunakan bola' },
    { id: 'atp-safe', stepNumber: 4, linkedTpIds: ['tp-safe'], focus: 'Keselamatan aktivitas fisik' },
    { id: 'atp-combo', stepNumber: 5, linkedTpIds: ['tp-loko', 'tp-non'], focus: 'Kombinasi gerak lokomotor dan non-lokomotor' },
  ],
  workflowStatus: 'SIAP',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const mapping: ATPUnitMappingData = {
  id: 'mapping-pjok',
  academicSettingId: 'acad-pjok',
  atpId: atpData.id,
  tpDataId: tpData.id,
  units: [
    {
      id: 'unit-loko',
      title: 'Gerak Lokomotor',
      order: 1,
      linkedAtpItemIds: ['atp-loko', 'atp-combo'],
      linkedTpIds: ['tp-loko'],
      materials: [
        { id: 'mat-loko', title: 'Gerak Lokomotor', order: 1, linkedAtpItemIds: ['atp-loko'], linkedTpIds: ['tp-loko'] },
        { id: 'mat-wrong', title: 'Strategi permainan catur', order: 2, linkedAtpItemIds: ['atp-loko'], linkedTpIds: ['tp-loko'] },
        { id: 'mat-generic', title: 'Kegiatan gerak', order: 3, linkedAtpItemIds: ['atp-loko'], linkedTpIds: ['tp-loko'] },
      ],
    },
    {
      id: 'unit-non',
      title: 'Gerak Non-Lokomotor',
      order: 2,
      linkedAtpItemIds: ['atp-non', 'atp-combo'],
      linkedTpIds: ['tp-non'],
      materials: [
        { id: 'mat-non', title: 'Gerak Non-Lokomotor', order: 1, linkedAtpItemIds: ['atp-non'], linkedTpIds: ['tp-non'] },
      ],
    },
    {
      id: 'unit-manip',
      title: 'Variasi Gerak Manipulatif',
      order: 3,
      linkedAtpItemIds: ['atp-manip'],
      linkedTpIds: ['tp-manip'],
      materials: [
        { id: 'mat-manip', title: 'Manipulasi bola', order: 1, linkedAtpItemIds: ['atp-manip'], linkedTpIds: ['tp-manip'] },
      ],
    },
    {
      id: 'unit-safe',
      title: 'Keselamatan Aktivitas Fisik',
      order: 4,
      linkedAtpItemIds: ['atp-safe'],
      linkedTpIds: ['tp-safe'],
      materials: [
        { id: 'mat-safe', title: 'Mencegah cedera saat bergerak', order: 1, linkedAtpItemIds: ['atp-safe'], linkedTpIds: ['tp-safe'] },
      ],
    },
    {
      id: 'unit-wrong',
      title: 'Permainan Strategi Catur',
      order: 5,
      linkedAtpItemIds: ['atp-loko'],
      linkedTpIds: ['tp-loko'],
      materials: [],
    },
  ],
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function sanitize(rawResult: any) {
  return sanitizeMappingAnalysisResult(rawResult, { tpData, atpData, currentMapping: mapping });
}

const weakEvidence = checkMappingSemanticEvidence({
  label: 'Kegiatan gerak',
  atpItems: [atpData.items[0]],
  tpItems: [tpData.items[0]],
});
assertCase(!weakEvidence.supported, 'Satu kata umum cocok -> REVIEW', weakEvidence);

const paraphraseEvidence = checkMappingSemanticEvidence({
  label: 'Manipulasi bola',
  atpItems: [atpData.items[2]],
  tpItems: [tpData.items[2]],
});
assertCase(paraphraseEvidence.supported, 'Parafrasa substansi yang terbukti setara -> ALIGNED', paraphraseEvidence);

const raw = {
  summary: {},
  atpFindings: [
    { id: 'wrong-theme', atpItemId: 'atp-loko', status: 'ALIGNED', currentUnitId: 'unit-wrong', supportingTpIds: ['tp-loko'], reason: 'AI klaim selaras.' },
    { id: 'no-evidence', atpItemId: 'atp-safe', status: 'ALIGNED', currentUnitId: 'unit-loko', supportingTpIds: ['tp-safe'], reason: 'AI klaim selaras tanpa bukti.' },
    { id: 'strong', atpItemId: 'atp-manip', status: 'ALIGNED', currentUnitId: 'unit-manip', supportingTpIds: ['tp-manip'], reason: 'Selaras.' },
    { id: 'multi-ok', atpItemId: 'atp-combo', status: 'ALIGNED', supportingTpIds: ['tp-loko', 'tp-non'], reason: 'Lintas Bab lengkap.' },
  ],
  materialFindings: [
    { id: 'mat-wrong-supported', status: 'SUPPORTED', unitId: 'unit-loko', materialId: 'mat-wrong', supportingTpIds: ['tp-loko'], supportingAtpItemIds: ['atp-loko'], reason: 'AI klaim supported.' },
    { id: 'mat-supported', status: 'SUPPORTED', unitId: 'unit-loko', materialId: 'mat-loko', supportingTpIds: ['tp-loko'], supportingAtpItemIds: ['atp-loko'], reason: 'Didukung.' },
    { id: 'ambiguous-action', status: 'ALIGNABLE', unitId: 'unit-loko', materialId: 'mat-generic', supportingTpIds: ['tp-loko'], supportingAtpItemIds: ['atp-loko'], reason: 'Ambigu.', action: { type: 'ALIGN_EXISTING_MATERIAL', targetUnitId: 'unit-loko', targetMaterialId: 'mat-generic', linkedAtpItemIds: ['atp-loko'], linkedTpIds: ['tp-loko'] } },
  ],
};

const result = sanitize(raw);
const byId = new Map(result.atpFindings.map((f) => [f.id, f]));
const matById = new Map(result.materialFindings.map((f) => [f.id, f]));

assertCase(byId.get('wrong-theme')?.status === 'REVIEW', 'ID benar + tema Bab bertentangan -> REVIEW', byId.get('wrong-theme'));
assertCase(byId.get('no-evidence')?.status === 'REVIEW', 'AI mengklaim ALIGNED tanpa evidence -> REVIEW', byId.get('no-evidence'));
assertCase(byId.get('strong')?.status === 'ALIGNED', 'Bab/TP semantik kuat -> ALIGNED', byId.get('strong'));
assertCase(byId.get('multi-ok')?.status === 'ALIGNED', 'Multi-Bab: semua subset TP selaras -> ALIGNED', byId.get('multi-ok'));
assertCase(matById.get('mat-wrong-supported')?.status === 'MANUAL_REVIEW', 'Material ID benar tetapi judul tidak sesuai -> MANUAL_REVIEW', matById.get('mat-wrong-supported'));
assertCase(matById.get('mat-supported')?.status === 'SUPPORTED', 'Material valid dan substansi sesuai -> SUPPORTED', matById.get('mat-supported'));
assertCase(!matById.get('ambiguous-action')?.action, 'Kasus ambigu tidak menghasilkan action otomatis', matById.get('ambiguous-action'));
assertCase(result.summary.alignedAtp === result.atpFindings.filter((f) => f.status === 'ALIGNED').length, 'Summary alignedAtp konsisten dengan findings final', result.summary);

const wrongMultiMapping: ATPUnitMappingData = {
  ...mapping,
  units: mapping.units.map((u) => u.id === 'unit-non'
    ? { ...u, title: 'Permainan Strategi Catur', materials: [] }
    : u),
};
const wrongMulti = sanitizeMappingAnalysisResult({
  summary: {},
  atpFindings: [{ id: 'multi-wrong', atpItemId: 'atp-combo', status: 'ALIGNED', supportingTpIds: ['tp-loko', 'tp-non'], reason: 'Union lengkap.' }],
  materialFindings: [],
}, { tpData, atpData, currentMapping: wrongMultiMapping });
assertCase(wrongMulti.atpFindings[0]?.status === 'REVIEW', 'Multi-Bab: satu Bab tidak sesuai -> REVIEW', wrongMulti.atpFindings[0]);
assertCase(wrongMulti.atpFindings[0]?.status === 'REVIEW', 'Multi-Bab: union TP lengkap tetapi tema salah -> REVIEW', wrongMulti.atpFindings[0]);

if (failed > 0) {
  console.error(`P1-D3 mapping semantic evidence regression failed: ${failed} scenario(s).`);
  process.exit(1);
}

console.log('P1-D3 mapping semantic evidence regression scenarios passed.');
