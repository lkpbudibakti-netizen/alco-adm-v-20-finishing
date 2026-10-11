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
 * Implements shared production readiness resolver for Step 07 and Step 08:
 * 1. canSaveDraft: True if mapping or academicSetting is present, with matching academicSettingId if both exist.
 * 2. TP & ATP canonical availability & readiness: Must be present, non-empty items, and workflowStatus === 'SIAP'. Empty or unknown status cannot be considered ready.
 * 3. Identity and source relationships consistency (academicSettingId, ATP-TP source identity).
 * 4. Upstream staleness: Only check when source metadata exists on both upstream and downstream. Do not lock mapping just due to metadata timestamp differences or missing source metadata.
 * 5. Mapping validity and completeness via validateATPUnitMappingCanonical.
 * 6. Non-empty units / mapping: canProceed = false if mapping is empty, upstream not ready, or structure incomplete.
 */
export function resolveATPUnitMappingReadiness(
  mapping: ATPUnitMappingData | undefined,
  atp: ATPData | undefined,
  tp: TPData | undefined,
  academicSetting?: AcademicSetting | null
): MappingReadiness {
  const blockers: string[] = [];

  // 1. canSaveDraft check
  let canSaveDraft = Boolean(mapping || academicSetting);
  if (mapping && academicSetting && mapping.academicSettingId && academicSetting.id) {
    if (mapping.academicSettingId !== academicSetting.id) {
      canSaveDraft = false;
      blockers.push(`ID Academic Setting pada pemetaan (${mapping.academicSettingId}) tidak sesuai dengan konteks aktif (${academicSetting.id}).`);
    }
  }
  if (!mapping && !academicSetting) {
    canSaveDraft = false;
  }

  // 2. TP & ATP canonical availability & readiness
  const tpStatus = tp?.workflowStatus;
  const atpStatus = atp?.workflowStatus;

  const isTpReady = Boolean(
    tp &&
    Array.isArray(tp.items) &&
    tp.items.length > 0 &&
    (tpStatus === 'SIAP' || (tp as any).status === 'SIAP') &&
    !tp.needsReview
  );

  const isAtpReady = Boolean(
    atp &&
    Array.isArray(atp.items) &&
    atp.items.length > 0 &&
    (atpStatus === 'SIAP' || (atp as any).status === 'SIAP') &&
    !atp.needsReview
  );

  if (!isTpReady) {
    blockers.push('Tujuan Pembelajaran (TP) canonical belum berstatus SIAP atau belum lengkap.');
  }

  if (!isAtpReady) {
    blockers.push('Alur Tujuan Pembelajaran (ATP) canonical belum berstatus SIAP atau belum lengkap.');
  }

  // 3. Identity & source relationship consistency
  if (mapping && tp && mapping.academicSettingId && tp.academicSettingId && mapping.academicSettingId !== tp.academicSettingId) {
    blockers.push('Ketiadaan konsistensi academicSettingId antara Pemetaan dan TP.');
  }
  if (mapping && atp && mapping.academicSettingId && atp.academicSettingId && mapping.academicSettingId !== atp.academicSettingId) {
    blockers.push('Ketiadaan konsistensi academicSettingId antara Pemetaan dan ATP.');
  }

  // 4. Upstream staleness check (only if source metadata exists and strictly newer; do not assume freshness if metadata is missing)
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

  // 5. Mapping validity and completeness
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
