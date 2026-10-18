import assert from 'node:assert/strict';
import { validateAndBuildATPUnitMappings } from '../src/services/atpUnitMappingImportService';
import { sanitizeMappingAnalysisResult, fallbackAnalyzeMapping, buildMappingAnalysisPrompt } from '../server/mappingAnalysis';
import { applyATPMappingActions, computeMappingFingerprint } from '../src/services/atpMappingActionApplyService';
import { extractSelectedMappingActions, resolveApplyActionsEligibility } from '../src/services/atpApplyActionEligibilityService';
import { validateATPUnitMappingCanonical } from '../src/services/atpUnitMappingValidationService';
import { deriveMappingAtpIds } from '../src/services/atpMappingLineageService';
import { createEmptyUnitExecutionPlanData } from '../src/services/unitExecutionPlanService';
import { buildCurrentMappingDraftFromUnits, createInitialUnits } from '../src/components/ATPUnitMappingManager';
import type { ATPData, TPData, ATPUnitMappingData } from '../src/types';

const labels = ['Berjalan dan berlari', 'Memutar dan mengayun tubuh', 'Menangkap dan melempar bola',
  'Latihan kekuatan otot', 'Senam irama berpasangan', 'Makanan bergizi seimbang'];
const tp: TPData = { id: 'tp', academicSettingId: 'year', updatedAt: '2026-10-18', workflowStatus: 'SIAP',
  items: labels.map((label, i) => ({ id: 't'+(i+1), code: 'TP-'+(i+1), statement: 'Mempraktikkan '+label, competence: 'Mempraktikkan', contentScope: label })) };
const atp: ATPData = { id: 'atp', academicSettingId: 'year', tpId: tp.id, updatedAt: tp.updatedAt, workflowStatus: 'SIAP',
  items: [['t1','t3'], ['t2'], ['t4','t5'], ['t6']].map((linkedTpIds, i) => ({ id: 'a'+(i+1), stepNumber: i+1, focus: 'Fokus pedagogis '+(i+1), linkedTpIds })) };
function freeze(value: any): void { Object.freeze(value); for (const child of Object.values(value)) if (child && typeof child === 'object') freeze(child); }
freeze(atp); freeze(tp);
const canonicalBefore = JSON.stringify({ atp, tp });
const imported = validateAndBuildATPUnitMappings(labels.map((label, i) => ({ babOrder: i+1, babTitle: 'Bab guru '+(i+1), materialOrder: 1, materialTitle: label })));
assert(imported.success, imported.errors?.join('; ')); assert.equal(imported.units!.length, 6);
const units = imported.units!;
const structure = (items: typeof units) => items.map(unit => ({ id: unit.id, title: unit.title, order: unit.order,
  materials: unit.materials.map(material => ({ id: material.id, title: material.title, order: material.order })) }));
const mapping: ATPUnitMappingData = { id: 'mapping', academicSettingId: 'year', atpId: atp.id, tpDataId: tp.id, updatedAt: tp.updatedAt, units };
const params = { currentMapping: mapping, atpData: atp, tpData: tp };
const before = JSON.stringify(mapping);
const analysis = fallbackAnalyzeMapping(params);
const actions = extractSelectedMappingActions(analysis, new Set([...analysis.atpFindings,...analysis.materialFindings].filter(f=>f.action).map(f=>f.id)));
assert.equal(analysis.materialFindings.filter(f=>f.status==='ALIGNABLE').length, 6);
const fingerprint = computeMappingFingerprint(units, atp, tp);
const apply = (selectedActions: typeof actions) => applyATPMappingActions({ units, selectedActions, atp, tp, expectedFingerprint: fingerprint, currentFingerprint: fingerprint });
assert(resolveApplyActionsEligibility({ units, selectedActions: actions, selectedCount: actions.length, atp, tp, expectedFingerprint: fingerprint, currentFingerprint: fingerprint }).canApply);
const applied = apply(actions); assert(applied.success, applied.issues.join('; '));
assert.deepEqual(structure(applied.nextUnits!), structure(units));
assert.deepEqual(applied.nextUnits!.filter(unit=>unit.linkedAtpItemIds.includes('a1')).map(unit=>[unit.order,unit.linkedTpIds]), [[1,['t1']],[3,['t3']]]);
assert.deepEqual(applied.nextUnits!.filter(unit=>unit.linkedAtpItemIds.includes('a3')).map(unit=>[unit.order,unit.linkedTpIds]), [[4,['t4']],[5,['t5']]]);
const complete = validateATPUnitMappingCanonical({ ...mapping, units: applied.nextUnits! }, atp, tp);
assert(complete.isValid && complete.isComplete, complete.issues.join('; '));
assert.deepEqual(complete.unmappedAtpIds, []); assert.deepEqual(complete.uncoveredTpIds, []);
assert.equal(JSON.stringify(mapping), before); assert.equal(JSON.stringify({atp,tp}),canonicalBefore);

// A subset must carry its matching material in the same transaction.
const assign = actions.find(action=>action.type==='ASSIGN_ATP_TO_UNIT')!;
assert(!apply([assign]).success);
assert(!resolveApplyActionsEligibility({ units, selectedActions:[assign], selectedCount:1, atp,tp,expectedFingerprint:fingerprint,currentFingerprint:fingerprint }).canApply);
const incompleteBundle = actions.filter(action=>!(action.type==='ALIGN_EXISTING_MATERIAL' && action.targetUnitId===units[0].id));
const rejected = apply(incompleteBundle); assert(!rejected.success); assert(!rejected.nextUnits);
assert(rejected.issues.some(issue=>issue.includes('SOURCE_LINEAGE_MISSING') || issue.includes('materi pendukung')));
assert.equal(JSON.stringify(mapping),before);
// AI-selected ATP IDs have no authority; TP selection determines exact parents.
const raw = { materialFindings: units.map((unit,i)=>({ unitId:unit.id,materialId:unit.materials[0].id,status:'ALIGNABLE',
  action:{type:'ALIGN_EXISTING_MATERIAL',targetUnitId:unit.id,targetMaterialId:unit.materials[0].id,linkedTpIds:['t'+(i+1)],linkedAtpItemIds:['AI_FICTION']}})) };
const sanitized = sanitizeMappingAnalysisResult(raw,params);
assert.deepEqual(sanitized.materialFindings.map(f=>f.supportingAtpItemIds), [['a1'],['a2'],['a1'],['a3'],['a3'],['a4']]);
const manual = structuredClone(raw); manual.materialFindings[0].status='MANUAL_REVIEW';
const reviewed = sanitizeMappingAnalysisResult(manual,params);
assert(!reviewed.atpFindings.some(f=>f.action?.targetUnitId===units[0].id));
assert(!reviewed.materialFindings.find(f=>f.unitId===units[0].id)!.action);
const unsupported = sanitizeMappingAnalysisResult({ atpFindings:[{atpItemId:'a1',action:{type:'ASSIGN_ATP_TO_UNIT',atpItemId:'a1',targetUnitId:units[0].id,linkedTpIds:['t6']}}],
  materialFindings:units.map(unit=>({unitId:unit.id,materialId:unit.materials[0].id,status:'MANUAL_REVIEW'})) },params);
assert(!unsupported.atpFindings.some(f=>f.action));
assert(deriveMappingAtpIds(['UNKNOWN'],atp,tp).issues.length);
assert.deepEqual(deriveMappingAtpIds(['t1'],{...atp,items:[...atp.items,{...atp.items[0],id:'another-parent',stepNumber:10}]},tp).atpItemIds,['a1','another-parent']);
const fullWithOrphanTp = validateATPUnitMappingCanonical({...mapping,units:applied.nextUnits!},atp,{...tp,items:[...tp.items,{...tp.items[0],id:'orphan-tp'}]});
assert(!fullWithOrphanTp.isComplete);assert(fullWithOrphanTp.uncoveredTpIds.includes('orphan-tp'));
const manualWithAction = {...analysis,materialFindings:analysis.materialFindings.map(f=>({...f,status:'MANUAL_REVIEW' as const}))};
assert(!extractSelectedMappingActions(manualWithAction,new Set(analysis.materialFindings.map(f=>f.id))).length);
assert(!apply([{...assign,linkedTpIds:[]}]).success);
assert(!apply([{id:'missing-tp-subset',type:'ADD_MATERIAL_TO_UNIT',targetUnitId:units[0].id,title:labels[0],linkedAtpItemIds:['a1']}]).success);

// Strictly inverted pedagogical spans fail; revisits/interleaving and nonmatching Bab numbers remain valid.
const reversed=structuredClone(applied.nextUnits!);
[reversed[0].order, reversed[5].order] = [reversed[5].order, reversed[0].order];
const inverted=validateATPUnitMappingCanonical({...mapping,units:reversed},atp,tp);
assert(!inverted.isValid);assert(inverted.issues.some(issue=>issue.includes('ATP_PROGRESSION_REVERSED')));
assert(validateATPUnitMappingCanonical({...mapping,units:applied.nextUnits!.map(unit=>({...unit,order:unit.order+10}))},atp,tp).isComplete);
// Step 8 sorts by teacher unit.order, not array position or ATP step.
const reversedArray=[...applied.nextUnits!].reverse();
assert.deepEqual(createEmptyUnitExecutionPlanData({...mapping,units:reversedArray}).units.map(unit=>unit.unitId),units.map(unit=>unit.id));
assert.deepEqual(buildCurrentMappingDraftFromUnits(reversedArray).units.map(unit=>unit.order),reversedArray.map(unit=>unit.order));
assert.deepEqual(createInitialUnits({...mapping,units:reversedArray},atp.items).map(unit=>unit.order),reversedArray.map(unit=>unit.order));
assert(buildMappingAnalysisPrompt(params).includes('Bab/Materi → pilih subset TP relevan'));
console.log('PASS: imported six-Bab structure preserved, ATP1 across Bab1/3 and ATP3 across Bab4/5, canonical immutability/global coverage, deterministic TP parents, atomic supported bundles, no safe action from MANUAL_REVIEW, progression guard and Step8 unit.order.');
