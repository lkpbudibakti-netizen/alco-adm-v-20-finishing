import type { AppStorageStateV5 } from './storageV5';

/** A single scoped project, never an application backup. */
export interface CompleteProjectArchive {
  kind: 'ADMINISTRATION_PROJECT';
  schemaVersion: '2.0';
  exportedAt: string;
  project: AppStorageStateV5;
}

export interface CompleteProjectImportOptions {
  mode: 'RESTORE' | 'COPY' | 'IDENTITY_ONLY';
  documentDate?: string;
  targetProfileId: string;
  targetSchoolId: string;
  replaceYearPlanId?: string;
}
