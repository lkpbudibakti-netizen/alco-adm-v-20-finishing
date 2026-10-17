import { AssessmentCriterion, AssessmentPlanItem } from '../../types';
import { resolveScheduledLearningMeetings, ScheduledLearningMeetingProjection } from '../scheduledLearningMeetingProjectionService';
import { LearningPlan, DocumentGenerationContext } from './types';
import { validateLearningPlanForModulAjar, LearningPlanValidationResult } from '../learningPlanService';

export interface ModulAjarMeeting {
  id: string; order: number; title: string; date: string; jp: number;
  materials: ScheduledLearningMeetingProjection['materials'];
  linkedTpIds: string[]; linkedAtpItemIds: string[];
  resolvedTPs: ModulAjarProjection['resolvedTPs'];
  assessments: AssessmentPlanItem[];
  KKTP: AssessmentCriterion[];
}
export interface ModulAjarSection { title: string; lines: string[] }
export interface ModulAjarProjection {
  meetings?: ModulAjarMeeting[];
  sections?: ModulAjarSection[];
  isReady: boolean;
  error?: string;

  plan?: LearningPlan;

  resolvedTPs: Array<{
    id: string;
    code?: string;
    statement: string;
    materialScope?: string;
  }>;

  resolvedAllocatedJP?: number;

  jpResolutionSource:
    | 'CANONICAL_MEETINGS'
    | 'EXPLICIT_PLAN'
    | 'LINKED_TIME_ALLOCATION'
    | 'UNRESOLVED';

  validation?: LearningPlanValidationResult;
}

export function buildModulAjarProjection(context: DocumentGenerationContext): ModulAjarProjection {
  const isBlankMode = context.documentMode === 'blank';

  if (isBlankMode) {
    return {
      isReady: true,
      resolvedTPs: [],
      resolvedAllocatedJP: undefined,
      jpResolutionSource: 'UNRESOLVED',
    };
  }

  const learningPlans = context.learningPlans || [];
  const activePlanId = context.activeLearningPlanId;

  let selectedPlan: LearningPlan | undefined;

  if (activePlanId) {
    const plan = learningPlans.find((p) => p.id === activePlanId);
    if (!plan) {
      return {
        isReady: false,
        error: `Rencana pembelajaran terpilih dengan ID "${activePlanId}" tidak ditemukan.`,
        resolvedTPs: [],
        resolvedAllocatedJP: undefined,
        jpResolutionSource: 'UNRESOLVED',
      };
    }
    if (plan.status !== 'SIAP') {
      return {
        isReady: false,
        error: `Rencana pembelajaran "${plan.topic || plan.id}" terpilih belum diubah statusnya menjadi SIAP.`,
        resolvedTPs: [],
        resolvedAllocatedJP: undefined,
        jpResolutionSource: 'UNRESOLVED',
      };
    }
    selectedPlan = plan;
  } else {
    const siapPlans = learningPlans.filter((p) => p.status === 'SIAP');
    if (siapPlans.length === 0) {
      return {
        isReady: false,
        error: 'Belum ada rencana pembelajaran (Modul Ajar) dengan status SIAP.',
        resolvedTPs: [],
        resolvedAllocatedJP: undefined,
        jpResolutionSource: 'UNRESOLVED',
      };
    }
    if (siapPlans.length > 1) {
      return {
        isReady: false,
        error: 'Terdapat lebih dari satu rencana pembelajaran (Modul Ajar) dengan status SIAP. Silakan pilih salah satu rencana secara eksplisit.',
        resolvedTPs: [],
        resolvedAllocatedJP: undefined,
        jpResolutionSource: 'UNRESOLVED',
      };
    }
    selectedPlan = siapPlans[0];
  }

  const validation = validateLearningPlanForModulAjar(selectedPlan, {
    academicSetting: context.academicSetting,
    tp: context.tp,
    atp: context.atp,
    atpUnitMapping: context.atpUnitMapping,
    unitExecutionPlan: context.unitExecutionPlan,
    learningMeetingSchedules: context.learningMeetingSchedules,
    k13Analysis: context.k13Analysis,
    timeAllocations: context.timeAllocations,
    assessmentCriteria: context.assessmentCriteria,
  });

  if (!validation.valid) {
    return {
      isReady: false,
      error: validation.errors.join('; '),
      resolvedTPs: [],
      resolvedAllocatedJP: undefined,
      jpResolutionSource: 'UNRESOLVED',
      validation,
    };
  }

  const invalid = (error: string): ModulAjarProjection => ({
    isReady: false, error, resolvedTPs: [], jpResolutionSource: 'UNRESOLVED', validation,
  });
  if (!selectedPlan.unitId || !selectedPlan.learningMeetingIds?.length ||
      !context.atpUnitMapping || !context.unitExecutionPlan || !context.learningMeetingSchedules?.length) {
    return invalid('Lineage Unit → Meeting → LearningPlan belum lengkap.');
  }
  if (context.snapshot?.learningPlanId &&
      (context.snapshot.learningPlanId !== selectedPlan.id ||
       context.snapshot.sourceVersions?.learningPlanUpdatedAt !== selectedPlan.updatedAt)) {
    return invalid('Lineage LearningPlan berbeda dari snapshot.');
  }
  const scheduled = resolveScheduledLearningMeetings({
    mapping: context.atpUnitMapping, unitExecutionPlan: context.unitExecutionPlan,
    schedules: context.learningMeetingSchedules, tp: context.tp, atp: context.atp,
  });
  if (!scheduled.isValid) return invalid(scheduled.errors.join('; '));
  const ids = selectedPlan.learningMeetingIds;
  const rows = scheduled.rows.filter(r => r.semesterPlanId === context.academicSetting.id && ids.includes(r.meetingId));
  if (new Set(ids).size !== ids.length || rows.length !== ids.length ||
      new Set(rows.map(r => r.meetingId)).size !== ids.length ||
      new Set(rows.map(r => r.meetingOrder)).size !== ids.length ||
      rows.some(r => r.unitId !== selectedPlan.unitId || !/^\d{4}-\d{2}-\d{2}$/.test(r.date) ||
        !Number.isFinite(Date.parse(r.date)) || !Number.isFinite(r.jp) || !(r.jp > 0) ||
        !Number.isInteger(r.meetingOrder) || r.meetingOrder < 1 ||
        !r.linkedTpIds.length || !r.linkedAtpItemIds.length ||
        r.linkedTpIds.some(id => !selectedPlan.tpIds.includes(id)) ||
        r.linkedAtpItemIds.some(id => !selectedPlan.atpItemIds.includes(id)))) {
    return invalid('Pertemuan atau lineage TP/ATP/Unit tidak valid.');
  }
  const assessments = Object.values(selectedPlan.assessmentPlan).flatMap(items => items || []);
  const criteria = (context.assessmentCriteria || []).filter(c =>
    c.academicSettingId === context.academicSetting.id && selectedPlan.tpIds.includes(c.tpId) &&
    (!selectedPlan.kktpCriterionIds?.length || selectedPlan.kktpCriterionIds.includes(c.id)));
  if ((selectedPlan.kktpCriterionIds || []).some(id => !criteria.some(c => c.id === id))) {
    return invalid('Referensi KKTP tidak ditemukan pada TP dan semester LearningPlan.');
  }
  const meetings: ModulAjarMeeting[] = rows.sort((a,b) => a.meetingOrder - b.meetingOrder).map(r => ({
    id: r.meetingId, order: r.meetingOrder, title: r.meetingTitle, date: r.date, jp: r.jp,
    materials: r.materials, linkedTpIds: r.linkedTpIds, linkedAtpItemIds: r.linkedAtpItemIds,
    resolvedTPs: validation.resolvedTPs.filter(t => r.linkedTpIds.includes(t.id)),
    assessments: assessments.filter(a => a.learningMeetingId === r.meetingId &&
      a.linkedTpIds.every(id => r.linkedTpIds.includes(id))),
    KKTP: criteria.filter(c => r.linkedTpIds.includes(c.tpId)),
  }));
  const sections = buildSections(selectedPlan, meetings, validation.resolvedTPs, assessments, criteria);

  const jpResolutionSource = validation.jpResolutionSource === 'CANONICAL_ATP'
    ? 'UNRESOLVED'
    : (validation.jpResolutionSource || 'UNRESOLVED');

  return {
    isReady: true,
    plan: selectedPlan,
    meetings, sections,
    resolvedTPs: validation.resolvedTPs || [],
    resolvedAllocatedJP: validation.resolvedAllocatedJP,
    jpResolutionSource,
    validation,
  };
}


function buildSections(plan: LearningPlan, meetings: ModulAjarMeeting[], tps: ModulAjarProjection['resolvedTPs'], assessments: AssessmentPlanItem[], criteria: AssessmentCriterion[]): ModulAjarSection[] {
  const criterionLines = (items: AssessmentCriterion[]) => items.map(c =>
    [tps.find(t => t.id === c.tpId)?.code || c.tpId, c.description, c.approach,
      ...c.indicators, ...c.levels.map(l => (l.label || l.level) + ': ' + l.description),
      c.passingThreshold != null ? 'Ambang: ' + c.passingThreshold : '', c.notes].filter(Boolean).join(' | '));
  const assessmentLines = (items: AssessmentPlanItem[]) => items.map(a =>
    [a.type, a.description, a.method, a.technique, a.instrument, 'TP: ' + a.linkedTpIds.join(', ')].filter(Boolean).join(' | '));
  return [
    { title: 'I. INFORMASI UMUM', lines: [
      'Kompetensi Awal: ' + (plan.initialCompetency || '-'),
      'Dimensi Profil Lulusan: ' + (plan.graduateProfileDimensions || plan.p3Dimensions || []).join(', '),
      'Sarana dan Prasarana: ' + (plan.resources || []).map(r => r.title + (r.source ? ' (' + r.source + ')' : '')).join('; '),
      'Karakteristik/Kebutuhan Belajar Murid: ' + (plan.targetStudents || '-'),
      'Model/Praktik Pembelajaran: ' + (plan.learningModel || '-')] },
    { title: 'II. KOMPONEN INTI', lines: [...tps.map(t => (t.code || t.id) + ': ' + t.statement + (t.materialScope ? ' (Materi: ' + t.materialScope + ')' : '')),
      'Pemahaman Bermakna: ' + (plan.meaningfulUnderstanding || '-'),
      'Pertanyaan Pemantik: ' + (plan.triggerQuestions || []).join('; '),
      ...(plan.learningExperiences || []).map(e => e.phase + ': ' + e.description + (e.durationMinutes ? ' (' + e.durationMinutes + ' Menit)' : '')),
      ...Object.entries(plan.learningSteps || {}).flatMap(([phase, steps]) => (steps || []).map(step => phase + ': ' + (step.title || '') + ' ' + step.description + (step.durationMinutes ? ' (' + step.durationMinutes + ' Menit)' : '')))] },
    { title: 'III. RENCANA PERTEMUAN', lines: meetings.flatMap(m => [
      'Pertemuan ' + m.order + ': ' + m.title + ' | ' + m.date + ' | ' + m.jp + ' JP',
      'Materi: ' + m.materials.map(x => x.title).join('; '),
      ...m.resolvedTPs.map(t => (t.code || t.id) + ': ' + t.statement),
      ...assessmentLines(m.assessments), ...criterionLines(m.KKTP)]) },
    { title: 'IV. ASESMEN + KKTP', lines: [...assessmentLines(assessments), ...criterionLines(criteria)] },
    { title: 'V. DIFERENSIASI', lines: Object.entries(plan.differentiation || {}).map(([key,value]) => key + ': ' + value) },
    { title: 'VI. PENGAYAAN/REMEDIAL', lines: ['Pengayaan: ' + (plan.enrichmentPlan || '-'), 'Remedial: ' + (plan.remedialPlan || '-')] },
    { title: 'VII. REFLEKSI', lines: ['Guru: ' + (plan.reflection?.teacherReflection || '-'), 'Murid: ' + (plan.reflection?.studentReflection || '-')] },
    { title: 'VIII. PENGESAHAN', lines: [] },
  ];
}
