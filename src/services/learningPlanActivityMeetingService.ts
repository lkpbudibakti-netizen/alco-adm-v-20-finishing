import type { LearningPlan } from '../types';

/** Exact ID checks only. Legacy/manual activities without linkage remain global. */
export function validateLearningPlanActivityMeetings(
  draft: Partial<LearningPlan>,
  meetingIds: readonly string[] = [],
  requireLinkage = false,
): { isValid: boolean; reason?: string } {
  if (meetingIds.some(id => typeof id !== 'string' || !id.trim()) || new Set(meetingIds).size !== meetingIds.length) {
    return { isValid: false, reason: 'Scope meeting canonical tidak valid atau berisi ID duplikat.' };
  }
  const collections = [draft.learningExperiences, ...Object.values(draft.learningSteps || {})];
  const covered = new Set<string>();
  for (const collection of collections) {
    if (collection === undefined) continue;
    if (!Array.isArray(collection)) return { isValid: false, reason: 'Daftar kegiatan/pengalaman belajar tidak valid.' };
    for (const activity of collection) {
      if (!activity || typeof activity !== 'object') return { isValid: false, reason: 'Kegiatan/pengalaman belajar tidak valid.' };
      const id = activity.learningMeetingId;
      if (id === undefined && !requireLinkage) continue;
      if (typeof id !== 'string' || !meetingIds.includes(id)) {
        return { isValid: false, reason: 'learningMeetingId kegiatan/pengalaman wajib exact dari scope meeting aktif; ID kosong/dangling ditolak.' };
      }
      if (requireLinkage && (typeof activity.description !== 'string' || !activity.description.trim())) {
        return { isValid: false, reason: `Deskripsi kegiatan meeting '${id}' belum lengkap.` };
      }
      covered.add(id);
    }
  }
  if (requireLinkage && meetingIds.some(id => !covered.has(id))) {
    return { isValid: false, reason: 'Setiap meeting canonical wajib memiliki kegiatan/pengalaman belajar dengan learningMeetingId exact.' };
  }
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
