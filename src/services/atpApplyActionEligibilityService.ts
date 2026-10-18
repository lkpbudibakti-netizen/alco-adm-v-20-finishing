import type { ATPData, TPData, ATPUnitMapping } from '../types';
import type { MappingActionItem } from './atpMappingActionApplyService';
import type { MappingAnalysisResult } from './aiService';

export interface ActionValidityCheckResult {
  valid: boolean;
  issue?: string;
}

export interface ApplyActionEligibilityResult {
  canApply: boolean;
  disabledReason?: string;
  diagnosticWarning?: string;
  issues: string[];
  selectedCount: number;
  executableActionsCount: number;
}

function getCanonicalTpsForAtpItem(atpItem: any): string[] {
  if (!atpItem) return [];
  if (Array.isArray(atpItem.linkedTpIds) && atpItem.linkedTpIds.length > 0) {
    return atpItem.linkedTpIds;
  }
  if (atpItem.tpId) {
    return [atpItem.tpId];
  }
  return [];
}

/**
 * Extracts executable MappingActionItem list from the analysisResult matching the selected finding IDs.
 */
export function extractSelectedMappingActions(
  analysisResult: MappingAnalysisResult | null | undefined,
  selectedActionIds: Set<string>
): MappingActionItem[] {
  if (!analysisResult || !selectedActionIds || selectedActionIds.size === 0) {
    return [];
  }

  const actions: MappingActionItem[] = [];

  (analysisResult.atpFindings || []).forEach((f) => {
    if (f.action && selectedActionIds.has(f.id)) {
      actions.push({
        id: f.id,
        ...f.action,
      });
    }
  });

  (analysisResult.materialFindings || []).forEach((m) => {
    if (m.action && selectedActionIds.has(m.id)) {
      actions.push({
        id: m.id,
        ...m.action,
      });
    }
  });

  return actions;
}

/**
 * Validates a single action against the current draft units, ATP, and TP items.
 */
export function validateActionAgainstDraft(
  action: MappingActionItem,
  units: ATPUnitMapping[],
  atp: ATPData,
  tp: TPData
): ActionValidityCheckResult {
  if (!action || !action.type) {
    return { valid: false, issue: 'Action tidak dikenal atau kosong.' };
  }

  const validTypes = [
    'ASSIGN_ATP_TO_UNIT',
    'ADD_MATERIAL_TO_UNIT',
    'ALIGN_EXISTING_MATERIAL',
    'RECOVER_ATP_LINEAGE',
  ];
  if (!validTypes.includes(action.type)) {
    return { valid: false, issue: `Tipe action tidak valid: ${action.type}` };
  }

  const validAtpIds = new Set((atp?.items || []).map((a) => a.id));
  const validTpIds = new Set((tp?.items || []).map((t) => t.id));
  const atpMap = new Map((atp?.items || []).map((a) => [a.id, a]));

  const unitMap = new Map<string, { unit: ATPUnitMapping; materialIds: Set<string> }>();
  (units || []).forEach((u) => {
    const matSet = new Set((u.materials || []).map((m) => m.id));
    unitMap.set(u.id, { unit: u, materialIds: matSet });
  });

  const targetUnitId = String(action.targetUnitId || '').trim();
  if (!targetUnitId || !unitMap.has(targetUnitId)) {
    return {
      valid: false,
      issue: `Bab target (ID: ${targetUnitId || '-'}) tidak ditemukan dalam draf saat ini.`,
    };
  }

  if (action.type === 'ASSIGN_ATP_TO_UNIT') {
    const atpId = String(action.atpItemId || '').trim();
    if (!atpId || !validAtpIds.has(atpId)) {
      return { valid: false, issue: `Langkah ATP (ID: ${atpId || '-'}) tidak ditemukan dalam data ATP.` };
    }
    const linkedTps = Array.isArray(action.linkedTpIds) ? action.linkedTpIds : [];
    if (linkedTps.length === 0) {
      return { valid: false, issue: 'ASSIGN_ATP wajib menyertakan subset linkedTpIds.' };
    }
    const atpObj = atpMap.get(atpId);
    const canonTps = getCanonicalTpsForAtpItem(atpObj);
    for (const tId of linkedTps) {
      if (!validTpIds.has(tId) || !canonTps.includes(tId)) {
        return { valid: false, issue: `Subset TP '${tId}' tidak didukung oleh ATP canonical tertaut.` };
      }
    }
  } else if (action.type === 'ADD_MATERIAL_TO_UNIT') {
    const title = String(action.title || '').trim();
    if (!title) {
      return { valid: false, issue: 'ADD_MATERIAL wajib memiliki judul materi.' };
    }
    const rawAtps = Array.isArray(action.linkedAtpItemIds) && action.linkedAtpItemIds.length > 0
      ? action.linkedAtpItemIds
      : (action.atpItemId ? [action.atpItemId] : []);
    const linkedAtps = rawAtps.map((id) => String(id).trim()).filter(Boolean);
    if (linkedAtps.length === 0) {
      return { valid: false, issue: 'ADD_MATERIAL wajib merujuk minimal 1 ATP canonical.' };
    }
    for (const aId of linkedAtps) {
      if (!validAtpIds.has(aId)) {
        return { valid: false, issue: `ADD_MATERIAL merujuk ATP tidak valid: ${aId}` };
      }
    }
  } else if (action.type === 'ALIGN_EXISTING_MATERIAL' || action.type === 'RECOVER_ATP_LINEAGE') {
    const matId = String(action.targetMaterialId || '').trim();
    const unitInfo = unitMap.get(targetUnitId);
    if (matId && (!unitInfo || !unitInfo.materialIds.has(matId))) {
      return { valid: false, issue: `Materi target (ID: ${matId}) tidak ditemukan dalam Bab.` };
    }
    if (action.type === 'ALIGN_EXISTING_MATERIAL' && !matId) {
      return { valid: false, issue: 'ALIGN_EXISTING_MATERIAL wajib menargetkan Lingkup Materi existing.' };
    }
    const linkedAtps = Array.isArray(action.linkedAtpItemIds) ? action.linkedAtpItemIds : [];
    const linkedTps = Array.isArray(action.linkedTpIds) ? action.linkedTpIds : [];
    if (linkedAtps.length === 0 || linkedTps.length === 0) {
      return { valid: false, issue: `${action.type} wajib memiliki lineage ATP dan TP yang lengkap.` };
    }
    for (const aId of linkedAtps) {
      if (!validAtpIds.has(aId)) {
        return { valid: false, issue: `${action.type} merujuk ATP tidak valid: ${aId}` };
      }
    }
    for (const tId of linkedTps) {
      if (!validTpIds.has(tId)) {
        return { valid: false, issue: `${action.type} merujuk TP tidak valid: ${tId}` };
      }
    }
  }

  return { valid: true };
}

/**
 * Evaluates whether the "Terapkan Pilihan" button can be enabled and returns
 * clear diagnostic reasons and warnings if disabled.
 */
export function resolveApplyActionsEligibility(params: {
  selectedCount: number;
  selectedActions: MappingActionItem[];
  units: ATPUnitMapping[];
  atp: ATPData;
  tp: TPData;
  expectedFingerprint?: string | null;
  currentFingerprint?: string | null;
}): ApplyActionEligibilityResult {
  const {
    selectedCount,
    selectedActions,
    units,
    atp,
    tp,
    expectedFingerprint,
    currentFingerprint,
  } = params;

  // Reason 1: belum ada saran dipilih
  if (selectedCount === 0) {
    return {
      canApply: false,
      disabledReason: 'belum ada saran dipilih',
      issues: [],
      selectedCount: 0,
      executableActionsCount: 0,
    };
  }

  // Reason 2: pilihan tidak memiliki action valid
  if (selectedActions.length === 0) {
    return {
      canApply: false,
      disabledReason: 'pilihan tidak memiliki action valid',
      diagnosticWarning: `Anda telah memilih ${selectedCount} saran, tetapi tidak ada tindakan otomatis yang valid untuk diterapkan ke draft. Saran ini bersifat tinjauan/catatan manual.`,
      issues: ['Pilihan tidak memiliki action yang dapat dieksekusi secara otomatis.'],
      selectedCount,
      executableActionsCount: 0,
    };
  }

  // Reason 3: hasil analisis stale/kedaluwarsa
  const isStale = Boolean(
    !expectedFingerprint ||
    !currentFingerprint ||
    expectedFingerprint !== currentFingerprint
  );
  if (isStale) {
    return {
      canApply: false,
      disabledReason: 'hasil analisis stale/kedaluwarsa',
      diagnosticWarning: 'Hasil analisis sudah kedaluwarsa karena struktur Bab atau data telah berubah setelah analisis. Jalankan analisis ulang.',
      issues: ['Analisis tidak tersedia atau sudah kedaluwarsa. Jalankan analisis ulang.'],
      selectedCount,
      executableActionsCount: selectedActions.length,
    };
  }

  // Reason 4: action tidak lagi cocok dengan draft saat ini
  const mismatchIssues: string[] = [];
  for (const action of selectedActions) {
    const check = validateActionAgainstDraft(action, units, atp, tp);
    if (!check.valid && check.issue) {
      mismatchIssues.push(check.issue);
    }
  }

  if (mismatchIssues.length > 0) {
    return {
      canApply: false,
      disabledReason: 'action tidak lagi cocok dengan draft saat ini',
      diagnosticWarning: `Tindakan yang dipilih tidak lagi cocok dengan draf saat ini: ${mismatchIssues.join('; ')}`,
      issues: mismatchIssues,
      selectedCount,
      executableActionsCount: selectedActions.length,
    };
  }

  // Action valid -> tombol enabled
  return {
    canApply: true,
    disabledReason: undefined,
    diagnosticWarning: undefined,
    issues: [],
    selectedCount,
    executableActionsCount: selectedActions.length,
  };
}
