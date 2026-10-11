import { resolveATPUnitMappingReadiness } from '../src/services/atpMappingReadinessService';
import { ATPUnitMappingData, ATPData, TPData, AcademicSetting } from '../src/types';

function assert(condition: boolean, message: string, details?: any) {
  if (!condition) {
    console.error('FAIL details:', details);
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('Running P1-D4 Mapping Readiness Gate Regression Tests...');

const mockSetting: AcademicSetting = {
  id: 'setting-1',
  academicYear: '2025/2026',
  semester: '1 (Ganjil)',
  level: 'SMP',
  grade: 'Kelas 7',
  subject: 'Matematika',
};

const mockTP: TPData = {
  id: 'tp-1',
  academicSettingId: 'setting-1',
  workflowStatus: 'SIAP',
  items: [
    {
      id: 'tp-item-1',
      code: 'E1-MAT-01',
      statement: 'Memahami bilangan bulat',
      competence: 'Memahami',
      contentScope: 'Bilangan Bulat',
    }
  ],
  updatedAt: '2025-01-01T00:00:00Z',
};

const mockATP: ATPData = {
  id: 'atp-1',
  academicSettingId: 'setting-1',
  workflowStatus: 'SIAP',
  tpId: 'tp-1',
  basedOnTpUpdatedAt: '2025-01-01T00:00:00Z',
  items: [
    { id: 'atp-item-1', stepNumber: 1, focus: 'Bilangan Bulat', linkedTpIds: ['tp-item-1'] }
  ],
  updatedAt: '2025-01-01T00:00:00Z',
};

const validMapping: ATPUnitMappingData = {
  id: 'map-1',
  academicSettingId: 'setting-1',
  basedOnAtpUpdatedAt: '2025-01-01T00:00:00Z',
  basedOnTpUpdatedAt: '2025-01-01T00:00:00Z',
  units: [
    {
      id: 'unit-1',
      title: 'Bab 1 Bilangan',
      linkedAtpItemIds: ['atp-item-1'],
      linkedTpIds: ['tp-item-1'],
      materials: [
        {
          id: 'mat-1',
          title: 'Materi Bilangan Bulat',
          linkedAtpItemIds: ['atp-item-1'],
          linkedTpIds: ['tp-item-1'],
        }
      ]
    }
  ],
  updatedAt: '2025-01-01T00:00:00Z',
};

// Test 1: Valid & Complete mapping -> canSaveDraft = true, canProceed = true
{
  const res = resolveATPUnitMappingReadiness(validMapping, mockATP, mockTP, mockSetting);
  console.log('Test 1 res:', res);
  assert(res.canSaveDraft === true, 'Valid mapping can save draft', res);
  assert(res.canProceed === true, 'Valid & complete mapping can proceed to Step 08', res);
  assert(res.blockers.length === 0, 'No blockers for valid mapping', res);
}

// Test 2: Incomplete / Empty mapping -> canSaveDraft = true (draft allowed), canProceed = false
{
  const emptyMapping: ATPUnitMappingData = {
    id: 'map-empty',
    academicSettingId: 'setting-1',
    units: [],
    updatedAt: '2025-01-01T00:00:00Z',
  };
  const res = resolveATPUnitMappingReadiness(emptyMapping, mockATP, mockTP, mockSetting);
  assert(res.canSaveDraft === true, 'Empty mapping draft can still be saved');
  assert(res.canProceed === false, 'Empty mapping cannot proceed to Step 08');
  assert(res.blockers.length > 0, 'Should have blockers for empty mapping');
}

// Test 3: Stale upstream (ATP updated after mapping basedOnAtpUpdatedAt) -> canProceed = false
{
  const staleATP: ATPData = {
    ...mockATP,
    updatedAt: '2025-01-02T00:00:00Z', // newer than mapping's basedOnAtpUpdatedAt
  };
  const res = resolveATPUnitMappingReadiness(validMapping, staleATP, mockTP, mockSetting);
  assert(res.canSaveDraft === true, 'Can save draft even if stale');
  assert(res.canProceed === false, 'Cannot proceed when upstream ATP is stale');
  assert(res.blockers.some(b => b.toLowerCase().includes('stale') || b.toLowerCase().includes('diperbarui')), 'Blocker mentions stale ATP');
}

// Test 4: Unready TP -> canProceed = false
{
  const unreadyTP: TPData = {
    ...mockTP,
    workflowStatus: 'DRAFT',
  };
  const res = resolveATPUnitMappingReadiness(validMapping, mockATP, unreadyTP, mockSetting);
  assert(res.canProceed === false, 'Cannot proceed when TP is not ready');
}

console.log('All P1-D4 Mapping Readiness Gate Regression Tests passed successfully!');
