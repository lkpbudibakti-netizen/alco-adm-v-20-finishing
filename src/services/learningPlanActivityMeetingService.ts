import type { LearningPlan } from '../types';

export interface ActivityMeetingScope { meetingId: string; jp: number }

/** Exact linkage and per-meeting time budget; global legacy activities are not reassigned. */
export function validateLearningPlanActivityMeetings(
  draft: Partial<LearningPlan>,
  meetingIds: readonly string[] = [],
  requireLinkage = false,
  meetings: readonly ActivityMeetingScope[] = [],
): { isValid: boolean; reason?: string } {
  const invalid = (reason: string) => ({ isValid: false, reason });
  if (meetingIds.some(id => typeof id !== 'string' || !id.trim()) || new Set(meetingIds).size !== meetingIds.length) {
    return invalid('Scope meeting canonical tidak valid atau berisi ID duplikat.');
  }
  const phases = ['opening', 'core', 'closing'] as const;
  if (Object.keys(draft.learningSteps || {}).some(phase => !phases.includes(phase as typeof phases[number]))) return invalid('Fase learningSteps tidak valid.');
  const collections = [draft.learningExperiences, ...Object.values(draft.learningSteps || {})];
  let hasLinkedActivities = false;
  for (const collection of collections) {
    if (collection === undefined) continue;
    if (!Array.isArray(collection)) return invalid('Daftar kegiatan/pengalaman belajar tidak valid.');
    for (const activity of collection) {
      if (!activity || typeof activity !== 'object') return invalid('Kegiatan/pengalaman belajar tidak valid.');
      const id = activity.learningMeetingId;
      if (id === undefined && !requireLinkage) continue;
      if (typeof id !== 'string' || !meetingIds.includes(id)) {
        return invalid('learningMeetingId kegiatan/pengalaman wajib exact dari scope meeting aktif; ID kosong/dangling ditolak.');
      }
      hasLinkedActivities = true;
      if (typeof activity.description !== 'string' || !activity.description.trim()) {
        return invalid("Deskripsi kegiatan meeting '" + id + "' belum lengkap.");
      }
    }
  }
  if (!requireLinkage && !hasLinkedActivities && !meetings.length) return { isValid: true };
  for (const id of meetingIds) {
    const scope = meetings.filter(m => m.meetingId === id);
    if (scope.length !== 1 || !Number.isFinite(scope[0].jp) || scope[0].jp <= 0) {
      return invalid("JP canonical meeting '" + id + "' tidak tersedia atau tidak valid; durasi tidak boleh ditebak.");
    }
    let total = 0;
    for (const phase of phases) {
      const steps = (draft.learningSteps?.[phase] || []).filter(step => step.learningMeetingId === id);
      if (!steps.length) return invalid("Meeting '" + id + "' wajib memiliki learningSteps." + phase + '.');
      for (const step of steps) {
        if (!Number.isFinite(step.durationMinutes) || !(step.durationMinutes! > 0)) {
          return invalid("Durasi learningSteps." + phase + " meeting '" + id + "' wajib lebih dari 0 menit.");
        }
        total += step.durationMinutes!;
      }
    }
    const expected = scope[0].jp * 35;
    if (total !== expected) return invalid("Durasi meeting '" + id + "' harus " + expected + ' menit (' + scope[0].jp + ' JP × 35), diterima ' + total + ' menit.');
  }
  // UNDERSTAND/APPLY/REFLECT describe the core approach; their durations are not an extra budget.
  return { isValid: true };
}

/** Editor update: explicit selection only, including explicit return to global. */
export function updateLearningPlanActivityMeeting(
  plan: LearningPlan,
  collection: 'experience' | 'opening' | 'core' | 'closing',
  activityId: string,
  learningMeetingId: string | undefined,
  allowedMeetingIds: readonly string[],
): Partial<LearningPlan> {
  if (learningMeetingId !== undefined &&
      (!allowedMeetingIds.includes(learningMeetingId) || !plan.learningMeetingIds?.includes(learningMeetingId))) {
    throw new Error('Pilihan meeting tidak termasuk scope canonical LearningPlan aktif.');
  }
  const list = collection === 'experience' ? plan.learningExperiences || [] : plan.learningSteps?.[collection] || [];
  if (list.filter(a => a.id === activityId).length !== 1) throw new Error('Identitas aktivitas tidak ditemukan atau ambigu.');
  const updated = list.map(activity => {
    if (activity.id !== activityId) return activity;
    const next = { ...activity };
    if (learningMeetingId === undefined) delete next.learningMeetingId;
    else next.learningMeetingId = learningMeetingId;
    return next;
  });
  return collection === 'experience'
    ? { learningExperiences: updated as LearningPlan['learningExperiences'] }
    : { learningSteps: { ...plan.learningSteps, [collection]: updated } };
}
