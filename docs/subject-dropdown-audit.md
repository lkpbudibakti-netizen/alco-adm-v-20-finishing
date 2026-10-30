# Subject dropdown audit

All four editable subject inputs now use `SubjectSelect`: profile default,
academic setting, new administration, and teaching-load assignment.
Choices use the existing `subjects.ts` masters (including distinct CP046 codes),
structure rules and CP level/phase metadata. No subject IDs or storage fields
were added. The legacy `SUBJECT_OPTIONS` export is retained for compatibility;
no runtime input uses it as a separate list.

New selections use existing canonical codes in the dropdown and existing names
in persisted fields. Rendering, changing the editor mode, and selecting the same
resolved identity preserve the original string, including aliases and local
subject names. No automatic normalization is saved. Academic settings skip the
old JP reset when the subject value is unchanged. A real different selection
keeps the existing JP recalculation behavior.

Changing level/grade retains a previously selected subject with a review notice
if it is absent from the filtered list. It does not clear or save the subject.
Custom/local subjects use an explicit dropdown option and controlled manual
field. Existing unknown values remain visible, including Guru Kelas and
vocational subjects. Editing one profile/workspace cannot carry the manual
editor state into a different profile/workspace.

The master has no complete SMK structure. Its general subject catalog remains
available with an explicit vocational/manual option. CP046 Merdeka phase
metadata is not used to exclude K13 language subjects where K13 coverage is
incomplete. These are conservative catalog choices, not new JP/legal rules.
JP resolution, CP resolution, saved profile/project IDs, storage, migrations,
imports/exports, document producers and stale/dependency logic were unchanged.

Validation:

- `testSubjectSelectionRegression.tsx`: master IDs/aliases, level/phase/grade,
  all 84 CP046 choices, K13 languages, actual dropdown callbacks/render,
  custom input, retained incompatible values, same-identity JP preservation,
  explicit subject changes and profile/workspace editor isolation.
- Existing profile-school binding, Storage V5 contract, document snapshot,
  CP046 safety/review and complete-project ZIP archive regressions.
- Production build and TypeScript check.

Baseline test failures identified without changing them:

- `testCP046CompatibilityRegression.ts`: its baseline module loader appends
  `.ts` to a JSON import, requesting `...review.json.ts` from origin/main.
- `testCurriculumMaster.ts`: historical 2024/2025 CP source assertion fails.

The starting HEAD `53ae582` and origin/main `4fd5b92` have the identical Git tree
`a139e0fb1c5ab8a1254e3ccd816b1fd72c4f1586`. Both failing scripts and their entire
curriculum/data/resolver dependency graph are unchanged by this implementation.
No unrelated test or curriculum-source change was made to hide these failures.

Results: dropdown regression, profile-school binding, Storage V5 contract (8/8),
snapshot immutability, CP046 safety/review (84 records, 327 elements, 30
subelements), complete-project ZIP archive, and production build PASS.
TypeScript remains FAIL with the identical 68 diagnostic headers as baseline;
there are zero new diagnostics. The two curriculum tests above remain FAIL
baseline. UI proof covers actual event handlers and server rendering; a browser
visual inspection was not performed.

Files changed: `src/App.tsx`, `src/components/ProfileManager.tsx`,
`src/components/AcademicSettings.tsx`, `src/components/TeacherTeachingLoadModal.tsx`,
`src/components/SubjectSelect.tsx`, `src/services/subjectSelection.ts`,
`scripts/testSubjectSelectionRegression.tsx`, and this report.
