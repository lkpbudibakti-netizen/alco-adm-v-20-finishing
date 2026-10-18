import type { AnalyzeATPUnitMappingServerParams, MappingAnalysisResult } from './mappingAnalysis';
import type { MappingActionItem } from '../src/services/atpMappingActionApplyService';
import { applyATPMappingActions, computeMappingFingerprint } from '../src/services/atpMappingActionApplyService';
import { deriveMappingAtpIds } from '../src/services/atpMappingLineageService';
import { validateATPUnitMappingCanonical } from '../src/services/atpUnitMappingValidationService';
import { checkMappingSemanticEvidence } from './mappingSemanticEvidence';

/** Read-only Bab/Materi -> relevant TP -> exact canonical ATP parents. */
export function analyzeBabFirstMapping(raw: any, params: AnalyzeATPUnitMappingServerParams): MappingAnalysisResult {
  const { currentMapping, atpData: atp, tpData: tp } = params;
  const units = currentMapping.units || [];
  const fingerprint = computeMappingFingerprint(units, atp, tp);
  const atpFindings: MappingAnalysisResult['atpFindings'] = [];
  const materialFindings: MappingAnalysisResult['materialFindings'] = [];
  const rawMaterials: any[] = Array.isArray(raw?.materialFindings) ? raw.materialFindings : [];
  const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every(id => b.includes(id));
  const evidence = (label: string, ids: string[]) => ids.length > 0 && ids.every(id => {
    const item = tp.items.find(item => item.id === id);
    return !!item && checkMappingSemanticEvidence({ label, tpItems: [item] }).supported;
  });

  for (const unit of units) {
    const proposals = rawMaterials.filter(finding => finding.unitId === unit.id);
    const targets: Array<{ material?: typeof unit.materials[number]; proposal?: any; title: string; conflict?: boolean }> = [];
    for (const material of unit.materials || []) {
      const matches = proposals.filter(finding => finding.materialId === material.id || finding.action?.targetMaterialId === material.id);
      targets.push({ material, title: material.title, proposal: matches[0], conflict: matches.length > 1 });
    }
    // Never invent materials in a Bab that already has teacher-owned materials.
    if (!(unit.materials || []).length) {
      const additions = proposals.filter(finding => finding.status === 'MISSING_MATERIAL' && !finding.materialId);
      for (const proposal of additions) targets.push({ proposal, title: proposal.action?.title || proposal.suggestedTitle || '' });
      if (!targets.length) targets.push({ title: unit.title, proposal: proposals.find(finding => finding.status === 'MANUAL_REVIEW') });
    }

    for (const [index, target] of targets.entries()) {
      const { material, proposal, title } = target;
      const id = typeof proposal?.id === 'string' && proposal.id ? proposal.id : `bab-material-${unit.id}-${material?.id || index}`;
      const manual = (reason: string) => materialFindings.push({ id, unitId: unit.id, materialId: material?.id,
        status: 'MANUAL_REVIEW', supportingTpIds: [], supportingAtpItemIds: [], strength: 'LOW', reason });
      if (target.conflict || proposal?.status === 'MANUAL_REVIEW') {
        manual(target.conflict ? 'Saran materi ganda/ambigu; tinjau manual sebelum menerapkan bundle Bab.' : proposal.reason || 'Materi memerlukan tinjauan manual.');
        continue;
      }
      if (proposal?.action?.targetUnitId && proposal.action.targetUnitId !== unit.id) {
        manual('Bab target action berbeda dari Bab induk materi; tidak ada perpindahan materi otomatis.'); continue;
      }
      const proposedTpIds = proposal?.action?.linkedTpIds ?? proposal?.supportingTpIds;
      if (proposedTpIds !== undefined && (!Array.isArray(proposedTpIds) || proposedTpIds.length === 0)) {
        manual('Saran tidak memiliki subset TP canonical yang eksplisit dan lengkap.'); continue;
      }
      const existingTpIds = material?.linkedTpIds || [];
      // A raw AI proposal chooses TP only; AI ATP IDs are deliberately not consumed.
      const tpIds: string[] = Array.isArray(proposedTpIds) && proposedTpIds.length
        ? [...proposedTpIds]
        : existingTpIds.length ? [...existingTpIds]
        : tp.items.filter(item => checkMappingSemanticEvidence({ label: title, tpItems: [item] }).supported).map(item => item.id);
      const parents = deriveMappingAtpIds(tpIds, atp, tp);
      if (parents.issues.length || !tpIds.length || !evidence(title, tpIds)) {
        manual('Keselarasan TP belum dapat dipastikan: label tidak memuat kata kunci substansi yang cukup untuk TP pilihan. ' + parents.issues.join('; ')); continue;
      }
      if (!material && !checkMappingSemanticEvidence({ label: unit.title, tpItems: tp.items.filter(item => tpIds.includes(item.id)) }).supported) {
        manual('Judul Bab belum mendukung TP materi usulan; materi baru tidak ditambahkan otomatis ke Bab yang tidak relevan.'); continue;
      }
      const staleIds = (material?.linkedAtpItemIds || []).filter(id => !atp.items.some(item => item.id === id));
      const supported = !!material && sameIds(existingTpIds, tpIds) && sameIds(material.linkedAtpItemIds || [], parents.atpItemIds) &&
        parents.atpItemIds.every(id => unit.linkedAtpItemIds.includes(id)) && tpIds.every(id => unit.linkedTpIds.includes(id));
      let action: MappingAnalysisResult['materialFindings'][number]['action'];
      if (!supported) {
        action = material
          ? staleIds.length
            ? { type: 'RECOVER_ATP_LINEAGE', targetUnitId: unit.id, targetMaterialId: material.id,
                removeAtpItemIds: staleIds, linkedTpIds: tpIds, linkedAtpItemIds: parents.atpItemIds }
            : { type: 'ALIGN_EXISTING_MATERIAL', targetUnitId: unit.id, targetMaterialId: material.id,
                linkedTpIds: tpIds, linkedAtpItemIds: parents.atpItemIds }
          : { type: 'ADD_MATERIAL_TO_UNIT', targetUnitId: unit.id, title, linkedTpIds: tpIds, linkedAtpItemIds: parents.atpItemIds };
      }
      materialFindings.push({ id, unitId: unit.id, materialId: material?.id, suggestedTitle: material ? undefined : title,
        status: supported ? 'SUPPORTED' : material ? 'ALIGNABLE' : 'MISSING_MATERIAL',
        supportingTpIds: tpIds, supportingAtpItemIds: parents.atpItemIds, strength: 'STRONG',
        reason: 'Substansi Bab/Materi mendukung TP pilihan; ATP induk diturunkan deterministik dari relasi canonical.', action });
    }

    const findings = materialFindings.filter(finding => finding.unitId === unit.id);
    const proposedTps = [...new Set(findings.filter(finding => finding.status !== 'MANUAL_REVIEW').flatMap(finding => finding.supportingTpIds))];
    const parents = deriveMappingAtpIds(proposedTps, atp, tp);
    for (const atpId of parents.atpItemIds) {
      const item = atp.items.find(item => item.id === atpId)!;
      const subset = proposedTps.filter(id => item.linkedTpIds.includes(id));
      if (unit.linkedAtpItemIds.includes(atpId) && subset.every(id => unit.linkedTpIds.includes(id))) continue;
      atpFindings.push({ id: `bab-atp-${unit.id}-${atpId}`, atpItemId: atpId, status: units.some(unit => unit.linkedAtpItemIds.includes(atpId)) ? 'REVIEW' : 'UNMAPPED', suggestedUnitId: unit.id,
        supportingTpIds: subset, strength: 'STRONG', reason: 'Bagian dari bundle materi Bab; bukan pemindahan atau pengurutan ulang ATP.',
        action: { type: 'ASSIGN_ATP_TO_UNIT', atpItemId: atpId, targetUnitId: unit.id, linkedTpIds: subset } });
    }
  }

  const actions = () => [...atpFindings, ...materialFindings].flatMap(finding => finding.action ? [{ id: finding.id, ...finding.action } as MappingActionItem] : []);
  const preview = (selectedActions: MappingActionItem[]) => applyATPMappingActions({ units, atp, tp, selectedActions,
    expectedFingerprint: fingerprint, currentFingerprint: fingerprint });
  // The offered actions must pass the exact Apply gate together; unsafe suggestions remain visible as manual review.
  const proposed = actions();
  const transaction = preview(proposed);
  if (proposed.length && !transaction.success) {
    const reason = 'Bundle Bab/Materi/TP/ATP belum dapat diterapkan: ' + transaction.issues.join('; ');
    for (const finding of atpFindings) { finding.action = undefined; finding.strength = 'LOW'; finding.reason = reason; }
    for (const finding of materialFindings.filter(finding => !!finding.action)) {
      finding.action = undefined; finding.status = 'MANUAL_REVIEW'; finding.strength = 'LOW'; finding.reason = reason;
    }
  }
  const validation = validateATPUnitMappingCanonical(currentMapping, atp, tp);
  for (const gap of validation.materialCoverageGaps) {
    const finding = materialFindings.find(finding => finding.unitId === gap.unitId);
    if (finding) finding.reason += ` SOURCE_LINEAGE_MISSING: Bab masih memerlukan materi untuk TP [${gap.tpIds}] dan ATP [${gap.atpItemIds}].`;
  }
  const coverageFindings: MappingAnalysisResult['atpFindings'] = [];
  for (const item of atp.items) {
    const mappedUnits = units.filter(unit => unit.linkedAtpItemIds.includes(item.id));
    const covered = item.linkedTpIds?.every(id => mappedUnits.some(unit => unit.linkedTpIds.includes(id)));
    const rawFinding = (Array.isArray(raw?.atpFindings) ? raw.atpFindings : []).find((finding: any) => finding.atpItemId === item.id);
    const semantic = mappedUnits.every(unit => (unit.linkedTpIds || []).filter(id => item.linkedTpIds?.includes(id)).every(id =>
      unit.materials.some(material => material.linkedTpIds.includes(id) && evidence(material.title, [id]))));
    const aligned = mappedUnits.length > 0 && covered && semantic && rawFinding?.status !== 'REVIEW' &&
      (!rawFinding?.currentUnitId || mappedUnits.some(unit => unit.id === rawFinding.currentUnitId)) &&
      !validation.issues.some(issue => issue.includes('ATP_PROGRESSION_REVERSED') && issue.includes("'"+item.id+"'"));
    const firstActionIndex = atpFindings.findIndex(finding => finding.atpItemId === item.id);
    const firstAction = firstActionIndex < 0 ? undefined : atpFindings.splice(firstActionIndex, 1)[0];
    coverageFindings.push({ ...firstAction, id: rawFinding?.id || `atp-coverage-${item.id}`, atpItemId: item.id, status: aligned ? 'ALIGNED' : mappedUnits.length ? 'REVIEW' : 'UNMAPPED',
      supportingTpIds: item.linkedTpIds || [], strength: aligned ? 'STRONG' : 'LOW',
      reason: aligned ? 'Gabungan subset TP lintas Bab mencakup ATP canonical; urutan Bab dan ATP tetap terpisah.' : 'Cakupan ATP/TP lintas Bab belum lengkap; petakan TP melalui materi yang relevan.' });
  }
  const mappedAtp = atp.items.filter(item => units.some(unit => unit.linkedAtpItemIds.includes(item.id))).length;
  const finalAtpFindings = [...coverageFindings, ...atpFindings];
  return { atpFindings: finalAtpFindings, materialFindings, summary: {
    totalAtp: atp.items.length, mappedAtp, unmappedAtp: atp.items.length - mappedAtp,
    alignedAtp: new Set(finalAtpFindings.filter(f => f.status === 'ALIGNED').map(f => f.atpItemId)).size,
    reviewAtp: new Set(finalAtpFindings.filter(f => f.status === 'REVIEW').map(f => f.atpItemId)).size,
    alignableMaterials: materialFindings.filter(f => f.status === 'ALIGNABLE').length,
    missingMaterialSuggestions: materialFindings.filter(f => f.status === 'MISSING_MATERIAL').length,
    manualMaterialReview: materialFindings.filter(f => f.status === 'MANUAL_REVIEW').length,
  } };
}
