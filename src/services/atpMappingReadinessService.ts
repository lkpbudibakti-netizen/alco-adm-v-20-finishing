import { ATPUnitMappingData, ATPData, TPData, AcademicSetting } from '../types';
import { validateATPUnitMappingCanonical, ATPUnitMappingValidationResult } from './atpUnitMappingValidationService';
import { isUpstreamStale } from './workflowEngine';

export interface MappingReadiness {
  canSaveDraft: boolean;
  canProceed: boolean;
  blockers: string[];
  validationResult?: ATPUnitMappingValidationResult;
}

/**
 * Resolves readiness and blockers for ATP Unit Mapping (Step 07 -> Step 08 transition).
 * Ensures Step 08 can only be used when:
 * 1. TP and ATP canonical are available and ready.
 * 2. Identity and source relationships are consistent.
 * 3. Upstream data is not substantively stale.
 * 4. Mapping is valid and complete.
 * 5. Empty mapping is not declared ready.
 * 
 * Note: Teachers are always allowed to save draft mappings even if incomplete (canSaveDraft = true).
 */
export function resolveATPUnitMappingReadiness(
  mapping: ATPUnitMappingData | undefined,
  atp: ATPData | undefined,
  tp: TPData | undefined,
  academicSetting?: AcademicSetting | null
): MappingReadiness {
  const blockers: string[] = [];

  // 1. Can Save Draft check: Teachers may save draft mapping
  const canSaveDraft = Boolean(mapping || academicSetting);
  if (!mapping) {
    blockers.push('Data pemetaan belum tersedia.');
  }

  // 2. TP & ATP canonical availability & readiness
  const isTpReady = Boolean(tp && Array.isArray(tp.items) && tp.items.length > 0 && tp.workflowStatus !== 'DRAFT' && !tp.needsReview);
  const isAtpReady = Boolean(atp && Array.isArray(atp.items) && atp.items.length > 0 && atp.workflowStatus !== 'DRAFT' && !atp.needsReview);

  if (!isTpReady) {
    blockers.push('Tujuan Pembelajaran (TP) canonical belum tersedia atau belum siap.');
  }

  if (!isAtpReady) {
    blockers.push('Alur Tujuan Pembelajaran (ATP) canonical belum tersedia atau belum siap.');
  }

  // 3. Identity and source relationship consistency
  if (mapping && academicSetting && mapping.academicSettingId && academicSetting.id && mapping.academicSettingId !== academicSetting.id) {
    blockers.push(`ID Academic Setting pada pemetaan (${mapping.academicSettingId}) tidak sesuai dengan konteks aktif (${academicSetting.id}).`);
  }

  // 4. Upstream staleness check
  let isStale = false;
  if (mapping && atp?.updatedAt && mapping.basedOnAtpUpdatedAt) {
    if (isUpstreamStale(atp.updatedAt, mapping.basedOnAtpUpdatedAt)) {
      isStale = true;
      blockers.push('Alur ATP telah diperbarui sejak pemetaan terakhir disimpan (stale).');
    }
  }
  if (mapping && tp?.updatedAt && mapping.basedOnTpUpdatedAt) {
    if (isUpstreamStale(tp.updatedAt, mapping.basedOnTpUpdatedAt)) {
      isStale = true;
      blockers.push('Tujuan Pembelajaran (TP) telah diperbarui sejak pemetaan terakhir disimpan (stale).');
    }
  }

  // 5. Mapping validity and completeness (Empty mapping / incomplete checks)
  const validationResult = validateATPUnitMappingCanonical(mapping, atp, tp);

  const hasUnits = Boolean(mapping && Array.isArray(mapping.units) && mapping.units.length > 0);
  if (!hasUnits) {
    blockers.push('Pemetaan Unit/Bab masih kosong.');
  }

  if (!validationResult.isValid) {
    blockers.push('Pemetaan Unit/Bab memiliki kesalahan validasi.');
    validationResult.issues.forEach((iss) => {
      if (!blockers.includes(iss)) {
        blockers.push(iss);
      }
    });
  }

  if (!validationResult.isComplete) {
    blockers.push('Pemetaan Unit/Bab belum lengkap.');
  }

  const canProceed =
    canSaveDraft &&
    Boolean(mapping) &&
    hasUnits &&
    validationResult.isValid &&
    validationResult.isComplete &&
    !isStale &&
    isTpReady &&
    isAtpReady &&
    blockers.length === 0;

  return {
    canSaveDraft,
    canProceed,
    blockers,
    validationResult,
  };
}
