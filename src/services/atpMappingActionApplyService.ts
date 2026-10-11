import type { ATPData, TPData, ATPUnitMapping, ATPUnitMaterial, ATPUnitMappingData } from '../types';
import { validateATPUnitMappingCanonical } from './atpUnitMappingValidationService';

export interface MappingActionItem {
  id: string;
  type: 'ASSIGN_ATP_TO_UNIT' | 'ADD_MATERIAL_TO_UNIT' | 'ALIGN_EXISTING_MATERIAL';
  atpItemId?: string;
  targetUnitId?: string;
  targetMaterialId?: string;
  title?: string;
  linkedAtpItemIds?: string[];
  linkedTpIds?: string[];
}

export interface ApplyATPMappingActionsInput {
  units: ATPUnitMapping[];
  selectedActions: MappingActionItem[];
  atp: ATPData;
  tp: TPData;
  mappingId?: string;
  academicSettingId?: string;
  expectedFingerprint?: string;
  currentFingerprint?: string;
}

export interface ApplyATPMappingActionsResult {
  success: boolean;
  nextUnits?: ATPUnitMapping[];
  issues: string[];
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

export function computeMappingFingerprint(units: ATPUnitMapping[], atp: ATPData, tp: TPData): string {
  const unitSummary = (units || []).map((u) => ({
    id: u.id,
    title: u.title,
    atp: [...(u.linkedAtpItemIds || [])].sort(),
    tp: [...(u.linkedTpIds || [])].sort(),
    mats: (u.materials || []).map((m) => ({
      id: m.id,
      title: m.title,
      atp: [...(m.linkedAtpItemIds || [])].sort(),
      tp: [...(m.linkedTpIds || [])].sort(),
    })).sort((a, b) => a.id.localeCompare(b.id)),
  }));
  const atpSummary = (atp.items || []).map((a) => ({
    id: a.id,
    tps: [...getCanonicalTpsForAtpItem(a)].sort(),
  })).sort((a, b) => a.id.localeCompare(b.id));
  const tpSummary = (tp.items || []).map((t) => t.id).sort();

  return JSON.stringify({
    units: unitSummary,
    atpVersion: atp.updatedAt || '',
    atpItems: atpSummary,
    tpVersion: tp.updatedAt || '',
    tpItems: tpSummary,
  });
}

export function buildMappingDraftFromUnits(
  units: ATPUnitMapping[],
  mappingId?: string,
  academicSettingId?: string,
  atpId?: string,
  tpDataId?: string,
  basedOnTpUpdatedAt?: string,
  basedOnAtpUpdatedAt?: string
): ATPUnitMappingData {
  const finalUnits: ATPUnitMapping[] = (units || []).map((u, idx) => {
    const uId = u.id && u.id.trim() ? u.id.trim() : `unit-${Date.now()}-${idx + 1}`;
    const uTitle = u.title !== undefined ? u.title : `Bab ${idx + 1}`;
    const linkedAtpItemIds = Array.isArray(u.linkedAtpItemIds) ? [...u.linkedAtpItemIds] : [];
    const linkedTpIds = Array.isArray(u.linkedTpIds) ? [...u.linkedTpIds] : [];

    const materials: ATPUnitMaterial[] = (u.materials || []).map((m, mIdx) => {
      const matAtpIds = Array.isArray(m.linkedAtpItemIds) ? [...m.linkedAtpItemIds] : [];
      const matTpIds = Array.isArray(m.linkedTpIds) ? [...m.linkedTpIds] : [];

      return {
        id: m.id && m.id.trim() ? m.id.trim() : `mat-${Date.now()}-${mIdx + 1}`,
        title: m.title !== undefined ? m.title : '',
        order: mIdx + 1,
        linkedTpIds: matTpIds,
        linkedAtpItemIds: matAtpIds,
      };
    });

    return {
      id: uId,
      title: uTitle,
      order: idx + 1,
      linkedAtpItemIds,
      linkedTpIds,
      materials,
    };
  });

  return {
    id: mappingId && mappingId.trim() ? mappingId.trim() : (atpId ? `mapping-${atpId}` : `atp-mapping-${Date.now()}`),
    academicSettingId: academicSettingId || '',
    atpId: atpId || '',
    tpDataId: tpDataId || '',
    units: finalUnits,
    basedOnTpUpdatedAt,
    basedOnAtpUpdatedAt,
    updatedAt: new Date().toISOString(),
  };
}

export function applyATPMappingActions(input: ApplyATPMappingActionsInput): ApplyATPMappingActionsResult {
  const {
    units,
    selectedActions,
    atp,
    tp,
    mappingId,
    academicSettingId,
    expectedFingerprint,
    currentFingerprint,
  } = input;

  const issues: string[] = [];

  // 1. Stale Analysis Guard
  if (expectedFingerprint && currentFingerprint && expectedFingerprint !== currentFingerprint) {
    return {
      success: false,
      issues: [
        'Hasil analisis sudah kedaluwarsa karena draf, ATP, atau TP telah mengalami perubahan. Harap lakukan analisis ulang.',
      ],
    };
  }

  if (!Array.isArray(selectedActions) || selectedActions.length === 0) {
    return {
      success: true,
      nextUnits: JSON.parse(JSON.stringify(units)),
      issues: [],
    };
  }

  const validAtpIds = new Set((atp.items || []).map((a) => a.id));
  const validTpIds = new Set((tp.items || []).map((t) => t.id));
  const atpMap = new Map((atp.items || []).map((a) => [a.id, a]));

  const unitMap = new Map<string, { unit: ATPUnitMapping; materialIds: Set<string> }>();
  (units || []).forEach((u) => {
    const matSet = new Set((u.materials || []).map((m) => m.id));
    unitMap.set(u.id, { unit: u, materialIds: matSet });
  });

  // Pre-validate all actions atomically (no silent continue/skip)
  for (const action of selectedActions) {
    if (!action || !action.type) {
      issues.push('Ditemukan action tidak dikenal atau kosong.');
      continue;
    }

    if (
      action.type !== 'ASSIGN_ATP_TO_UNIT' &&
      action.type !== 'ADD_MATERIAL_TO_UNIT' &&
      action.type !== 'ALIGN_EXISTING_MATERIAL'
    ) {
      issues.push(`Tipe action tidak valid: ${action.type}`);
      continue;
    }

    const targetUnitId = String(action.targetUnitId || '').trim();
    if (!targetUnitId || !unitMap.has(targetUnitId)) {
      issues.push(`Action menargetkan Bab dengan ID fiktif atau tidak ada: ${targetUnitId}`);
      continue;
    }

    if (action.type === 'ASSIGN_ATP_TO_UNIT') {
      const atpId = String(action.atpItemId || '').trim();
      if (!atpId || !validAtpIds.has(atpId)) {
        issues.push(`ASSIGN_ATP merujuk ID ATP fiktif atau tidak valid: ${atpId}`);
      }
      const linkedTps = Array.isArray(action.linkedTpIds) ? action.linkedTpIds : [];
      if (linkedTps.length === 0) {
        issues.push(`ASSIGN_ATP wajib menyertakan subset linkedTpIds.`);
      } else {
        const atpObj = atpMap.get(atpId);
        const canonTps = getCanonicalTpsForAtpItem(atpObj);
        for (const tId of linkedTps) {
          if (!validTpIds.has(tId) || !canonTps.includes(tId)) {
            issues.push(`Subset TP '${tId}' tidak didukung oleh ATP canonical tertaut.`);
          }
        }
      }
    } else if (action.type === 'ADD_MATERIAL_TO_UNIT') {
      const title = String(action.title || '').trim();
      if (!title) {
        issues.push('ADD_MATERIAL wajib memiliki judul materi.');
      }
      const linkedAtps = Array.isArray(action.linkedAtpItemIds) ? action.linkedAtpItemIds : [];
      const linkedTps = Array.isArray(action.linkedTpIds) ? action.linkedTpIds : [];
      for (const aId of linkedAtps) {
        if (!validAtpIds.has(aId)) issues.push(`ADD_MATERIAL merujuk ATP fiktif: ${aId}`);
      }
      for (const tId of linkedTps) {
        if (!validTpIds.has(tId)) issues.push(`ADD_MATERIAL merujuk TP fiktif: ${tId}`);
      }
    } else if (action.type === 'ALIGN_EXISTING_MATERIAL') {
      const matId = String(action.targetMaterialId || '').trim();
      const unitInfo = unitMap.get(targetUnitId);
      if (!matId || !unitInfo || !unitInfo.materialIds.has(matId)) {
        issues.push(`ALIGN_EXISTING_MATERIAL merujuk Lingkup Materi fiktif atau tidak sesuai Bab: ${matId}`);
      }
      const linkedAtps = Array.isArray(action.linkedAtpItemIds) ? action.linkedAtpItemIds : [];
      const linkedTps = Array.isArray(action.linkedTpIds) ? action.linkedTpIds : [];
      if (linkedAtps.length === 0 || linkedTps.length === 0) {
        issues.push(`ALIGN_EXISTING_MATERIAL wajib memiliki lineage ATP dan TP yang lengkap.`);
      }
      for (const aId of linkedAtps) {
        if (!validAtpIds.has(aId)) issues.push(`ALIGN_EXISTING_MATERIAL merujuk ATP fiktif: ${aId}`);
      }
      for (const tId of linkedTps) {
        if (!validTpIds.has(tId)) issues.push(`ALIGN_EXISTING_MATERIAL merujuk TP fiktif: ${tId}`);
      }
    }
  }

  if (issues.length > 0) {
    return {
      success: false,
      issues,
    };
  }

  // Deep clone units for transaction application
  let nextUnits: ATPUnitMapping[] = JSON.parse(JSON.stringify(units));

  for (const action of selectedActions) {
    const targetUnitId = action.targetUnitId!;

    if (action.type === 'ASSIGN_ATP_TO_UNIT') {
      const atpId = action.atpItemId!;
      const actionTpIds = action.linkedTpIds || [];

      nextUnits = nextUnits.map((u) => {
        if (u.id !== targetUnitId) return u;
        const nextLinkedAtp = [...(u.linkedAtpItemIds || [])];
        if (!nextLinkedAtp.includes(atpId)) {
          nextLinkedAtp.push(atpId);
        }
        const nextTpIds = Array.from(new Set([...(u.linkedTpIds || []), ...actionTpIds]));
        return {
          ...u,
          linkedAtpItemIds: nextLinkedAtp,
          linkedTpIds: nextTpIds,
        };
      });
    } else if (action.type === 'ADD_MATERIAL_TO_UNIT') {
      const currentMats = nextUnits.find((u) => u.id === targetUnitId)?.materials || [];
      const newMat: ATPUnitMaterial = {
        id: `mat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title: action.title!,
        order: currentMats.length + 1,
        linkedTpIds: action.linkedTpIds || [],
        linkedAtpItemIds: action.linkedAtpItemIds || [],
      };

      nextUnits = nextUnits.map((u) => {
        if (u.id !== targetUnitId) return u;
        return {
          ...u,
          materials: [...(u.materials || []), newMat],
        };
      });
    } else if (action.type === 'ALIGN_EXISTING_MATERIAL') {
      const matId = action.targetMaterialId!;
      const proposedAtp = action.linkedAtpItemIds || [];
      const proposedTp = action.linkedTpIds || [];

      const sortedAtpIds = [...proposedAtp].sort((a, b) => {
        const indexA = (atp.items || []).findIndex((item) => item.id === a);
        const indexB = (atp.items || []).findIndex((item) => item.id === b);
        return indexA - indexB;
      });

      const sortedTpIds = [...proposedTp].sort((a, b) => {
        const indexA = (tp.items || []).findIndex((item) => item.id === a);
        const indexB = (tp.items || []).findIndex((item) => item.id === b);
        return indexA - indexB;
      });

      nextUnits = nextUnits.map((u) => {
        if (u.id !== targetUnitId) return u;
        const nextMaterials = (u.materials || []).map((mat) => {
          if (mat.id !== matId) return mat;
          return {
            ...mat,
            linkedAtpItemIds: sortedAtpIds,
            linkedTpIds: sortedTpIds,
          };
        });
        return {
          ...u,
          materials: nextMaterials,
        };
      });
    }
  }

  // Validate candidate using canonical validator
  const candidateMapping = buildMappingDraftFromUnits(
    nextUnits,
    mappingId,
    academicSettingId,
    atp.id,
    tp.id,
    tp.updatedAt,
    atp.updatedAt
  );

  const validation = validateATPUnitMappingCanonical(candidateMapping, atp, tp);

  if (!validation.isValid) {
    return {
      success: false,
      issues: validation.issues.length > 0 ? validation.issues : ['Validasi canonical gagal pada draf hasil penerapan action.'],
    };
  }

  return {
    success: true,
    nextUnits,
    issues: [],
  };
}
