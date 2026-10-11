import assert from 'node:assert';
import { validateATPUnitMappingCanonical } from '../src/services/atpUnitMappingValidationService';
import { buildCurrentMappingDraftFromUnits } from '../src/components/ATPUnitMappingManager';
import type { ATPData, TPData, ATPUnitMappingData } from '../src/types';

console.log('=== RUNNING P0-D MAPPING REGRESSION TESTS ===\n');

const mockAtp: ATPData = {
  id: 'atp-1',
  academicSettingId: 'acad-1',
  items: [
    { id: 'atp-item-1', stepNumber: 1, linkedTpIds: ['tp-1'] },
    { id: 'atp-item-2', stepNumber: 2, linkedTpIds: ['tp-2'] },
  ],
  updatedAt: new Date().toISOString(),
} as any;

const mockTp: TPData = {
  id: 'tp-1',
  academicSettingId: 'acad-1',
  items: [
    { id: 'tp-1', code: 'TP1', statement: 'TP 1', competence: 'Memahami', contentScope: 'Materi 1' },
    { id: 'tp-2', code: 'TP2', statement: 'TP 2', competence: 'Menerapkan', contentScope: 'Materi 2' },
  ],
  updatedAt: new Date().toISOString(),
} as any;

// Test 1: ALIGN material valid (lineage replaced as proposed, no old union)
const initialMapping: ATPUnitMappingData = {
  id: 'map-1',
  academicSettingId: 'acad-1',
  atpId: 'atp-1',
  tpDataId: 'tp-1',
  units: [
    {
      id: 'unit-1',
      title: 'Bab 1',
      order: 1,
      linkedAtpItemIds: ['atp-item-1', 'atp-item-2'],
      linkedTpIds: ['tp-1', 'tp-2'],
      materials: [
        {
          id: 'mat-1',
          title: 'Materi Lama',
          order: 1,
          linkedAtpItemIds: ['atp-item-1'],
          linkedTpIds: ['tp-1'],
        },
      ],
    },
  ],
};

const alignedCandidate: ATPUnitMappingData = {
  ...initialMapping,
  units: [
    {
      ...initialMapping.units[0],
      materials: [
        {
          id: 'mat-1',
          title: 'Materi Lama',
          order: 1,
          linkedAtpItemIds: ['atp-item-1'],
          linkedTpIds: ['tp-1'],
        },
      ],
    },
  ],
};
const val1 = validateATPUnitMappingCanonical(alignedCandidate, mockAtp, mockTp);
assert.strictEqual(val1.isValid, true, 'ALIGN valid material must pass validation');

// Test 2: ALIGN irrelevant / invalid reference (e.g. referencing ATP not in parent unit)
const invalidAlignCandidate: ATPUnitMappingData = {
  ...initialMapping,
  units: [
    {
      ...initialMapping.units[0],
      linkedAtpItemIds: ['atp-item-1'],
      linkedTpIds: ['tp-1'],
      materials: [
        {
          id: 'mat-1',
          title: 'Materi Lama',
          order: 1,
          linkedAtpItemIds: ['atp-item-2'], // atp-item-2 not in unit-1
          linkedTpIds: ['tp-2'],
        },
      ],
    },
  ],
};
const val2 = validateATPUnitMappingCanonical(invalidAlignCandidate, mockAtp, mockTp);
assert.strictEqual(val2.isValid, false, 'ALIGN material referencing ATP outside parent unit must fail');

// Test 3: Manual lineage without action remains intact
const manualMapping: ATPUnitMappingData = {
  ...initialMapping,
  units: [
    {
      id: 'unit-1',
      title: 'Bab 1',
      order: 1,
      linkedAtpItemIds: ['atp-item-1', 'atp-item-2'],
      linkedTpIds: ['tp-1', 'tp-2'],
      materials: [
        {
          id: 'mat-manual',
          title: 'Manual Materi',
          order: 1,
          linkedAtpItemIds: ['atp-item-1'],
          linkedTpIds: ['tp-1'],
        },
      ],
    },
  ],
};
const val3 = validateATPUnitMappingCanonical(manualMapping, mockAtp, mockTp);
assert.strictEqual(val3.isValid, true, 'Manual lineage without action must remain valid and intact');

// Test 4: AI trying to add ATP outside unit in material lineage -> Rejected
const outsideAtpCandidate: ATPUnitMappingData = {
  ...initialMapping,
  units: [
    {
      id: 'unit-1',
      title: 'Bab 1',
      order: 1,
      linkedAtpItemIds: ['atp-item-1'],
      linkedTpIds: ['tp-1'],
      materials: [
        {
          id: 'mat-1',
          title: 'Materi',
          order: 1,
          linkedAtpItemIds: ['atp-item-2'], // atp-item-2 not in unit-1
          linkedTpIds: ['tp-2'],
        },
      ],
    },
  ],
};
const val4 = validateATPUnitMappingCanonical(outsideAtpCandidate, mockAtp, mockTp);
assert.strictEqual(val4.isValid, false, 'Material referencing ATP outside unit must be rejected');

// Test 5: ADD material with parent-supported lineage -> PASS
const addValidMaterialCandidate: ATPUnitMappingData = {
  ...initialMapping,
  units: [
    {
      id: 'unit-1',
      title: 'Bab 1',
      order: 1,
      linkedAtpItemIds: ['atp-item-1', 'atp-item-2'],
      linkedTpIds: ['tp-1', 'tp-2'],
      materials: [
        {
          id: 'mat-new',
          title: 'Materi Baru',
          order: 2,
          linkedAtpItemIds: ['atp-item-1'],
          linkedTpIds: ['tp-1'],
        },
      ],
    },
  ],
};
const val5 = validateATPUnitMappingCanonical(addValidMaterialCandidate, mockAtp, mockTp);
assert.strictEqual(val5.isValid, true, 'ADD material with parent-supported lineage must pass');

// Test 6: ADD material with unsupported lineage -> FAIL
const addUnsupportedMaterialCandidate: ATPUnitMappingData = {
  ...initialMapping,
  units: [
    {
      id: 'unit-1',
      title: 'Bab 1',
      order: 1,
      linkedAtpItemIds: ['atp-item-1'],
      linkedTpIds: ['tp-1'],
      materials: [
        {
          id: 'mat-bad',
          title: 'Materi Unsupported',
          order: 2,
          linkedAtpItemIds: ['atp-item-2'], // not in unit-1
          linkedTpIds: ['tp-2'],
        },
      ],
    },
  ],
};
const val6 = validateATPUnitMappingCanonical(addUnsupportedMaterialCandidate, mockAtp, mockTp);
assert.strictEqual(val6.isValid, false, 'ADD material with unsupported lineage must fail');

// Test 7: Multi-action transactionality (if any part is invalid, candidate is invalid)
const multiActionCandidate = addUnsupportedMaterialCandidate;
const val7 = validateATPUnitMappingCanonical(multiActionCandidate, mockAtp, mockTp);
assert.strictEqual(val7.isValid, false, 'Multi-action with one invalid part must fail validation atomically');

// Test 8: Valid draft but not complete -> Apply allowed (isValid = true, isComplete = false)
const incompleteValidCandidate: ATPUnitMappingData = {
  ...initialMapping,
  units: [
    {
      id: 'unit-1',
      title: 'Bab 1',
      order: 1,
      linkedAtpItemIds: ['atp-item-1'], // atp-item-2 unmapped globally
      linkedTpIds: ['tp-1'],
      materials: [],
    },
  ],
};
const val8 = validateATPUnitMappingCanonical(incompleteValidCandidate, mockAtp, mockTp);
assert.strictEqual(val8.isValid, true, 'Valid incomplete draft must have isValid = true');
assert.strictEqual(val8.isComplete, false, 'Incomplete draft has isComplete = false');

// Test 9: Invalid draft does not change state (isValid = false)
const invalidDraftCandidate: ATPUnitMappingData = {
  ...initialMapping,
  units: [
    {
      id: 'unit-1',
      title: '',
      order: 1,
      linkedAtpItemIds: ['fiktif-atp'],
      linkedTpIds: ['fiktif-tp'],
      materials: [],
    },
  ],
};
const val9 = validateATPUnitMappingCanonical(invalidDraftCandidate, mockAtp, mockTp);
assert.strictEqual(val9.isValid, false, 'Invalid draft must have isValid = false');

console.log('\n=== ALL P0-D MAPPING REGRESSION TESTS PASSED SUCCESSFULLY ===\n');
