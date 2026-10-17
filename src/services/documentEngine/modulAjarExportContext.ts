import type { DocumentGenerationContext, DocumentSnapshot } from './types';
import { createDocumentSnapshot, resolveEffectiveContext } from './snapshot';

export function prepareModulAjarExportContext(
  liveContext: DocumentGenerationContext,
  format: 'docx' | 'pdf',
  source: 'live' | 'snapshot' = 'live',
  historicalSnapshot?: DocumentSnapshot,
): DocumentGenerationContext {
  // Discard inherited snapshots before resolving a new live snapshot.
  const live = { ...liveContext, snapshot: undefined };
  if (source === 'snapshot') {
    if (!historicalSnapshot) throw new Error('Snapshot lama belum tersedia.');
    if (historicalSnapshot.documentMode !== 'blank' &&
        (!historicalSnapshot.learningPlanId || !historicalSnapshot.sourceVersions?.learningPlanUpdatedAt)) {
      throw new Error('Snapshot lama tidak memiliki lineage LearningPlan lengkap; dokumen historis tidak dapat direkonstruksi dengan aman.');
    }
    return resolveEffectiveContext({
      ...live,
      activeLearningPlanId: historicalSnapshot.learningPlanId,
    }, historicalSnapshot);
  }
  return resolveEffectiveContext(live, createDocumentSnapshot(live, format, live.documentMode, 'MODUL_AJAR'));
}
