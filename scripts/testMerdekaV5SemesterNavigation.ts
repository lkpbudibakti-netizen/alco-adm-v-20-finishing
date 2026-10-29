import ts from 'typescript';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  createInitialStorageV5,
  loadStorageV5,
  saveStorageV5,
  resetStorageV5,
  createProfileV5,
  createSchoolV5,
  createYearHierarchyV5,
  setActiveYearPlanV5,
  setActiveSemesterPlanV5,
  saveCPV5,
  saveCPAnalysisV5,
  saveTPV5,
  saveATPV5,
  STORAGE_KEY_V5,
} from '../src/services/storageV5';
import { getRuntimeContextV5 } from '../src/services/runtimeV5';
import { CPData, CPAnalysisData, TPData, ATPData, WorkflowStepId } from '../src/types';

console.log('=== RUNNING AUDIT: MERDEKA V5 SEMESTER NAVIGATION (B.3A) ===\n');

let totalTests = 0;
let passedTests = 0;

function runTest(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] ${totalTests}. ${name}`);
    passedTests++;
  } catch (err: any) {
    console.error(`[FAIL] ${totalTests}. ${name}:`, err.message);
    throw err;
  }
}

// Mock localStorage in Node environment
class MockLocalStorage {
  private store: Map<string, string> = new Map();
  public readCount = 0;
  public writeCount = 0;

  getItem(key: string): string | null {
    this.readCount++;
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.writeCount++;
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
    this.readCount = 0;
    this.writeCount = 0;
  }

  get length(): number {
    return this.store.size;
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] || null;
  }
}

const mockStorage = new MockLocalStorage();
(globalThis as any).localStorage = mockStorage;

const V3_STORAGE_KEY = 'administrasi_guru_ai_storage_v3';

// Setup immutable V3 sentinel
const v3Sentinel = JSON.stringify({
  marker: 'V3_SENTINEL_IMMUTABLE_SEMESTER_NAV_TEST',
  checksum: 'semester-v5-sentinel-777',
  timestamp: 1719000000000,
  workspaces: [{ id: 'legacy-w1', academicSettingId: 'as-1' }],
});
mockStorage.setItem(V3_STORAGE_KEY, v3Sentinel);

// Initialize fresh V5 state
resetStorageV5();

const testSchool = createSchoolV5({
  name: 'SD Negeri Sukamaju 04',
  npsn: '20262004',
  address: 'Jl. Merdeka No. 14',
  village: 'Sukamaju',
  district: 'Pintar',
  regency: 'Kota Mandiri',
  province: 'Jawa Tengah',
  principalName: 'Sri Wahyuni, M.Pd.',
  principalNip: '197508122000032001',
});

const testProfile = createProfileV5({
  name: 'Guru IPAS Berprestasi',
  nip: '198703152012011002',
  status: 'PNS',
  defaultSubject: 'Ilmu Pengetahuan Alam dan Sosial (IPAS)',
  defaultLevel: 'SD',
  schoolId: testSchool.id,
});

const hierarchyA = createYearHierarchyV5({
  profileId: testProfile.id,
  schoolId: testSchool.id,
  academicYear: '2026/2027',
  curriculumType: 'KURIKULUM_MERDEKA',
  level: 'SD',
  grade: 'Kelas 4',
  subject: 'Ilmu Pengetahuan Alam dan Sosial (IPAS)',
  phase: 'B',
  workspaceName: 'IPAS — Kelas 4 — 2026/2027',
});
const yearPlanA = hierarchyA.yearPlan;
const semesterPlansA = hierarchyA.semesterPlans;
const semester1A = semesterPlansA.find((s) => s.semester === 1)!;
const semester2A = semesterPlansA.find((s) => s.semester === 2)!;

const hierarchyB = createYearHierarchyV5({
  profileId: testProfile.id,
  schoolId: testSchool.id,
  academicYear: '2027/2028',
  curriculumType: 'KURIKULUM_MERDEKA',
  level: 'SD',
  grade: 'Kelas 5',
  subject: 'Ilmu Pengetahuan Alam dan Sosial (IPAS)',
  phase: 'C',
  workspaceName: 'IPAS — Kelas 5 — 2027/2028',
});
const yearPlanB = hierarchyB.yearPlan;
const semesterPlansB = hierarchyB.semesterPlans;

// Setup Annual CP, CP Analysis, TP, ATP for YearPlan A
const cpA: CPData = {
  id: `cp-${yearPlanA.id}`,
  academicSettingId: yearPlanA.id,
  generalDescription: 'Capaian Pembelajaran IPAS Kelas 4',
  elements: [{ id: 'elem-1', name: 'Pemahaman IPAS', content: 'Memahami ekosistem sekitar.' }],
  updatedAt: '2026-02-10T08:00:00.000Z',
};
saveCPV5(yearPlanA.id, cpA);

const analysisA: CPAnalysisData = {
  id: `cpanalysis-${yearPlanA.id}`,
  academicSettingId: yearPlanA.id,
  cpId: cpA.id,
  generalSummary: 'Analisis IPAS',
  basedOnCpUpdatedAt: cpA.updatedAt,
  items: [
    {
      id: 'ana-1',
      elementId: 'elem-1',
      elementName: 'Pemahaman IPAS',
      cpText: 'Memahami ekosistem sekitar.',
      cpCompetence: 'Memahami',
      materialScope: 'Ekosistem',
      order: 1,
    },
  ],
  updatedAt: '2026-02-10T09:00:00.000Z',
};
saveCPAnalysisV5(yearPlanA.id, analysisA);

const tpA: TPData = {
  id: `tp-${yearPlanA.id}`,
  academicSettingId: yearPlanA.id,
  cpId: cpA.id,
  cpAnalysisId: analysisA.id,
  academicYear: '2026/2027',
  subjectCode: 'IPAS',
  phase: 'B',
  items: [
    {
      id: 'tp-item-1',
      code: 'TP 4.1',
      statement: 'Menganalisis hubungan antarmakhluk hidup dalam ekosistem.',
      competence: 'Menganalisis',
      contentScope: 'Ekosistem',
      order: 1,
    },
  ],
  workflowStatus: 'SIAP',
  generatedBy: 'TEACHER',
  needsReview: false,
  basedOnCpUpdatedAt: cpA.updatedAt,
  basedOnAnalysisUpdatedAt: analysisA.updatedAt,
  updatedAt: '2026-02-10T10:00:00.000Z',
};
saveTPV5(yearPlanA.id, tpA);

const atpA: ATPData = {
  id: `atp-${yearPlanA.id}`,
  academicSettingId: yearPlanA.id,
  tpId: tpA.id,
  tpDataId: tpA.id,
  academicYear: '2026/2027',
  subjectCode: 'IPAS',
  phase: 'B',
  rationale: 'Alur disusun mulai dari pengamatan lingkungan.',
  items: [
    {
      id: 'atp-item-1',
      stepNumber: 1,
      tpId: 'tp-item-1',
      tpCode: 'TP 4.1',
      tpStatement: 'Menganalisis hubungan antarmakhluk hidup dalam ekosistem.',
      materialScope: 'Ekosistem',
      p3Dimensions: ['Bernalar Kritis'],
    },
  ],
  totalJP: 0,
  knownTotalJP: 0,
  hasUnknownJP: true,
  allocationComplete: false,
  workflowStatus: 'SIAP',
  generatedBy: 'TEACHER',
  needsReview: false,
  basedOnTpUpdatedAt: tpA.updatedAt,
  updatedAt: '2026-02-10T11:00:00.000Z',
};
saveATPV5(yearPlanA.id, atpA);

setActiveYearPlanV5(yearPlanA.id);

const appPath = path.resolve(process.cwd(), 'src/App.tsx');
const appSource = fs.readFileSync(appPath, 'utf-8').replace(/\r\n/g, '\n');

const stepperPath = path.resolve(process.cwd(), 'src/components/WorkflowStepper.tsx');
const stepperSource = fs.readFileSync(stepperPath, 'utf-8').replace(/\r\n/g, '\n');

const typesPath = path.resolve(process.cwd(), 'src/types/index.ts');
const typesSource = fs.readFileSync(typesPath, 'utf-8').replace(/\r\n/g, '\n');

const semesterSelectorPath = path.resolve(process.cwd(), 'src/components/SemesterSelector.tsx');
const semesterSelectorSource = fs.readFileSync(semesterSelectorPath, 'utf-8').replace(/\r\n/g, '\n');

const adminHubPath = path.resolve(process.cwd(), 'src/components/administration/AdministrationHub.tsx');
const adminHubSource = fs.readFileSync(adminHubPath, 'utf-8').replace(/\r\n/g, '\n');

// Parse the actual JSX/step definitions; unrelated handlers cannot satisfy a transition.
const appAst = ts.createSourceFile(appPath, appSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const stepperAst = ts.createSourceFile(stepperPath, stepperSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function findNode(root: ts.Node, predicate: (node: ts.Node) => boolean): ts.Node {
  let found: ts.Node | undefined;
  function visit(node: ts.Node) { if (!found && predicate(node)) found = node; if (!found) ts.forEachChild(node, visit); }
  visit(root); assert.ok(found, 'Expected navigation node must exist'); return found;
}
const merdekaSteps = (findNode(stepperAst, node => ts.isConditionalExpression(node) && node.condition.getText(stepperAst) === 'isMerdekaActive') as ts.ConditionalExpression).whenTrue as ts.ArrayLiteralExpression;
function property(step: ts.ObjectLiteralExpression, name: string): ts.Expression {
  const prop = step.properties.find(p => ts.isPropertyAssignment(p) && p.name.getText(stepperAst) === name) as ts.PropertyAssignment;
  assert.ok(prop, 'Missing step property ' + name); return prop.initializer;
}
function stepDefinition(id: string): ts.ObjectLiteralExpression {
  const step = merdekaSteps.elements.find(node => ts.isObjectLiteralExpression(node) && (property(node, 'id') as ts.StringLiteral).text === id);
  assert.ok(step, 'Missing Merdeka step ' + id); return step as ts.ObjectLiteralExpression;
}
function evaluateStep(id: string, name: string, stepStates: Record<string, any>, selected: boolean) {
  const expression = property(stepDefinition(id), name).getText(stepperAst);
  return new Function('stepStates', 'hasSelectedSemester', 'return (' + expression + ');')(stepStates, selected);
}
function componentProp(component: string, name: string): string {
  const node = findNode(appAst, node => (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText(appAst) === component) as ts.JsxSelfClosingElement;
  const prop = node.attributes.properties.find(p => ts.isJsxAttribute(p) && p.name.getText(appAst) === name) as ts.JsxAttribute;
  assert.ok(prop && prop.initializer && ts.isJsxExpression(prop.initializer) && prop.initializer.expression, component + '.' + name);
  return (prop.initializer as ts.JsxExpression).expression!.getText(appAst).replace(/\s+/g, '');
}

// -----------------------------------------------------------------------------
// TEST 1: WorkflowStepId contains 'semester'
// -----------------------------------------------------------------------------
runTest("1. WorkflowStepId type union contains 'semester'", () => {
  assert.ok(
    typesSource.includes("| 'semester'"),
    "WorkflowStepId in src/types/index.ts must include | 'semester'"
  );
});

// -----------------------------------------------------------------------------
// TEST 2: Merdeka Stepper Order: 06 ATP -> 07 PEMETAAN -> 08 RENCANA TAHUNAN -> 09 SEMESTER -> 10 ADMINISTRASI
// -----------------------------------------------------------------------------
runTest('2. Merdeka preserves all ten V20 steps and their numbers', () => {
 const expected = ['profile','academic','cp','cp-analysis','tp','atp','atp-mapping','annual-planning','semester','admin'];
 assert.deepStrictEqual(merdekaSteps.elements.map(node => (property(node as ts.ObjectLiteralExpression,'id') as ts.StringLiteral).text),expected);
 expected.forEach((id,index)=>assert.strictEqual((property(stepDefinition(id),'num') as ts.StringLiteral).text,String(index+1).padStart(2,'0')));
});

// -----------------------------------------------------------------------------
// TEST 3: V20 forward/back transitions and mapping readiness guard
// -----------------------------------------------------------------------------
runTest('3. Forward/back navigation includes mapping and annual planning without skipped stages', () => {
 for(const [component,prop,target] of [
  ['ATPManager','onNextStep','atp-mapping'], ['ATPManager','onBackToTP','tp'],
  ['ATPUnitMappingManager','onBackToATP','atp'],
  ['AnnualPlanningManager','onNextStep','semester'], ['AnnualPlanningManager','onBackToMapping','atp-mapping'],
  ['SemesterSelector','onNextStep','admin'], ['SemesterSelector','onBackToATP','annual-planning'],
 ]) assert.strictEqual(componentProp(component,prop),"()=>setCurrentStep('"+target+"')",component+'.'+prop);
 assert.strictEqual(componentProp('ATPUnitMappingManager','onNextStep'),'handleEnterAnnualPlanning');
 const handler = findNode(appAst,node=>ts.isVariableDeclaration(node)&&node.name.getText(appAst)==='handleEnterAnnualPlanning') as ts.VariableDeclaration;
 const body=handler.initializer!.getText(appAst).replace(/\s+/g,'');
 assert.ok(body.includes('resolveATPUnitMappingReadiness('));
 assert.ok(body.includes("if(!readiness.canProceed){"));
 assert.ok(body.includes("setCurrentStep('atp-mapping');return;"));
 assert.ok(body.endsWith("setCurrentStep('annual-planning');}"));
 const selection=findNode(appAst,node=>ts.isVariableDeclaration(node)&&node.name.getText(appAst)==='handleSelectStep') as ts.VariableDeclaration;
 assert.ok(selection.initializer!.getText(appAst).replace(/\s+/g,'').includes("if(step==='annual-planning'){handleEnterAnnualPlanning();return;}"));
});

// -----------------------------------------------------------------------------
// TEST 4: App imports and uses setActiveSemesterPlanV5
// -----------------------------------------------------------------------------
runTest('4. App.tsx imports and uses setActiveSemesterPlanV5', () => {
  assert.ok(
    appSource.includes('setActiveSemesterPlanV5,'),
    'App.tsx must import setActiveSemesterPlanV5 from storageV5'
  );
  assert.ok(
    appSource.includes('setActiveSemesterPlanV5(semesterPlanId)'),
    'App.tsx must invoke setActiveSemesterPlanV5 with selected semesterPlanId'
  );
});

// -----------------------------------------------------------------------------
// TEST 5: App consumes semesterPlansForActiveYear & activeSemesterPlan from Runtime V5
// -----------------------------------------------------------------------------
runTest('5. App.tsx consumes semesterPlansForActiveYear and activeSemesterPlan directly from runtimeContext', () => {
  assert.ok(
    appSource.includes('semesterPlansForActiveYear,'),
    'App.tsx must destructure semesterPlansForActiveYear from runtimeContext'
  );
  assert.ok(
    appSource.includes('activeSemesterPlan,'),
    'App.tsx must destructure activeSemesterPlan from runtimeContext'
  );
});

// -----------------------------------------------------------------------------
// TEST 6: Selection handler calls setActiveSemesterPlanV5 and refreshV5
// -----------------------------------------------------------------------------
runTest('6. handleSelectSemester calls setActiveSemesterPlanV5 followed by refreshV5', () => {
  const handlerMatch = appSource.match(/const handleSelectSemester = \(([\s\S]*?)\n  \};/);
  assert.ok(handlerMatch, 'handleSelectSemester function must exist in App.tsx');
  const handlerBody = handlerMatch[0];

  assert.ok(
    handlerBody.includes('setActiveSemesterPlanV5(semesterPlanId)'),
    'handleSelectSemester must call setActiveSemesterPlanV5(semesterPlanId)'
  );
  assert.ok(
    handlerBody.includes('refreshV5()'),
    'handleSelectSemester must call refreshV5()'
  );
});

// -----------------------------------------------------------------------------
// TEST 7: SemesterSelector Component Structure & Contract
// -----------------------------------------------------------------------------
runTest('7. SemesterSelector accepts SemesterPlan[] and renders actual records', () => {
  assert.ok(
    semesterSelectorSource.includes('semesterPlans: SemesterPlan[]'),
    'SemesterSelectorProps must accept semesterPlans: SemesterPlan[]'
  );
  assert.ok(
    semesterSelectorSource.includes('activeSemesterPlan?: SemesterPlan'),
    'SemesterSelectorProps must accept activeSemesterPlan?: SemesterPlan'
  );
  assert.ok(
    semesterSelectorSource.includes('onSelectSemester: (semesterPlanId: string) => void'),
    'SemesterSelectorProps must define onSelectSemester callback'
  );
});

// -----------------------------------------------------------------------------
// TEST 8: No Local Semester Authority / Fake State
// -----------------------------------------------------------------------------
runTest('8. SemesterSelector has no local useState for active semester selection', () => {
  assert.ok(
    !semesterSelectorSource.includes('useState<string>'),
    'SemesterSelector must not maintain an independent local selectedId state'
  );
  assert.ok(
    !semesterSelectorSource.includes('useState<number>'),
    'SemesterSelector must not maintain an independent local semester state'
  );
});

// -----------------------------------------------------------------------------
// TEST 9: No Auto-Selection of Semester 1
// -----------------------------------------------------------------------------
runTest('9. Runtime Context initial state has activeSemesterPlan === undefined (no auto-selection)', () => {
  const state = loadStorageV5();
  // Ensure activeSemesterPlanId is not pre-selected
  assert.strictEqual(state.activeSemesterPlanId, undefined);

  const runtime = getRuntimeContextV5();
  assert.strictEqual(
    runtime.activeSemesterPlan,
    undefined,
    'Fresh runtime must not auto-select Semester 1'
  );
  assert.strictEqual(runtime.semesterPlansForActiveYear.length, 2);
});

// -----------------------------------------------------------------------------
// TEST 10: Continue Button Requires Selected SemesterPlan
// -----------------------------------------------------------------------------
runTest('10. Continue button in SemesterSelector is disabled when no semester is active', () => {
  assert.ok(
    semesterSelectorSource.includes('disabled={!isSelectedValid}'),
    'Continue button must be disabled when isSelectedValid is false'
  );
  assert.ok(
    semesterSelectorSource.includes('const isSelectedValid ='),
    'SemesterSelector must compute isSelectedValid based on activeSemesterPlan and semesterPlans'
  );
});

// -----------------------------------------------------------------------------
// TEST 11: Annual Context Remains Free of Semester Mutation
// -----------------------------------------------------------------------------
runTest("11. transitionalAcademicSetting and transitionalActiveContext keep semester: ''", () => {
  assert.ok(
    appSource.includes("semester: '', // Strictly empty for annual workflow"),
    "transitionalAcademicSetting and transitionalActiveContext must maintain semester: ''"
  );
});

// -----------------------------------------------------------------------------
// TEST 12: Selecting Semester 1 Resolves activeSemesterPlan.semester === 1
// -----------------------------------------------------------------------------
runTest('12. Selecting Semester 1 via Storage V5 updates activeSemesterPlan to Semester 1', () => {
  setActiveSemesterPlanV5(semester1A.id);
  const runtime = getRuntimeContextV5();

  assert.ok(runtime.activeSemesterPlan, 'activeSemesterPlan must be defined after selection');
  assert.strictEqual(runtime.activeSemesterPlan.id, semester1A.id);
  assert.strictEqual(runtime.activeSemesterPlan.semester, 1);
});

// -----------------------------------------------------------------------------
// TEST 13: Selecting Semester 2 Resolves activeSemesterPlan.semester === 2
// -----------------------------------------------------------------------------
runTest('13. Selecting Semester 2 via Storage V5 updates activeSemesterPlan to Semester 2', () => {
  setActiveSemesterPlanV5(semester2A.id);
  const runtime = getRuntimeContextV5();

  assert.ok(runtime.activeSemesterPlan, 'activeSemesterPlan must be defined after selection');
  assert.strictEqual(runtime.activeSemesterPlan.id, semester2A.id);
  assert.strictEqual(runtime.activeSemesterPlan.semester, 2);
});

// -----------------------------------------------------------------------------
// TEST 14: Semester Switching Does Not Mutate Parent YearPlan
// -----------------------------------------------------------------------------
runTest('14. Switching semester selection does not mutate YearPlan attributes', () => {
  const stateBefore = loadStorageV5();
  const ypBefore = stateBefore.yearPlans.find((yp) => yp.id === yearPlanA.id)!;

  setActiveSemesterPlanV5(semester1A.id);
  setActiveSemesterPlanV5(semester2A.id);

  const stateAfter = loadStorageV5();
  const ypAfter = stateAfter.yearPlans.find((yp) => yp.id === yearPlanA.id)!;

  assert.strictEqual(ypBefore.academicYear, ypAfter.academicYear);
  assert.strictEqual(ypBefore.grade, ypAfter.grade);
  assert.strictEqual(ypBefore.subject, ypAfter.subject);
  assert.strictEqual((ypAfter as any).semester, undefined, 'YearPlan must not acquire a semester field');
});

// -----------------------------------------------------------------------------
// TEST 15: Semester Selection Does Not Mutate Annual Data (CP, CP Analysis, TP, ATP)
// -----------------------------------------------------------------------------
runTest('15. Semester selection preserves annual CP, CP Analysis, TP, ATP data intact', () => {
  const runtime = getRuntimeContextV5();

  assert.ok(runtime.annualData?.cp, 'CP must remain present');
  assert.strictEqual(runtime.annualData.cp.id, cpA.id);

  assert.ok(runtime.annualData?.cpAnalysis, 'CP Analysis must remain present');
  assert.strictEqual(runtime.annualData.cpAnalysis.id, analysisA.id);

  assert.ok(runtime.annualData?.tp, 'TP must remain present');
  assert.strictEqual(runtime.annualData.tp.id, tpA.id);

  assert.ok(runtime.annualData?.atp, 'ATP must remain present');
  assert.strictEqual(runtime.annualData.atp.id, atpA.id);
});

// -----------------------------------------------------------------------------
// TEST 16: Switching YearPlan Clears Incompatible Active SemesterPlan
// -----------------------------------------------------------------------------
runTest('16. Switching YearPlan clears incompatible activeSemesterPlan from previous YearPlan', () => {
  // Set Semester 2 under YearPlan A active
  setActiveSemesterPlanV5(semester2A.id);
  let runtime = getRuntimeContextV5();
  assert.strictEqual(runtime.activeSemesterPlan?.id, semester2A.id);

  // Switch to YearPlan B
  setActiveYearPlanV5(yearPlanB.id);
  runtime = getRuntimeContextV5();

  assert.strictEqual(runtime.activeYearPlan?.id, yearPlanB.id);
  assert.strictEqual(
    runtime.activeSemesterPlan,
    undefined,
    'Switching to YearPlan B must clear activeSemesterPlan from YearPlan A'
  );
});

// -----------------------------------------------------------------------------
// TEST 17: V3 Sentinel Remains Completely Untouched
// -----------------------------------------------------------------------------
runTest('17. V3 Storage Sentinel remains byte-identical throughout semester operations', () => {
  const currentV3 = mockStorage.getItem(V3_STORAGE_KEY);
  assert.strictEqual(currentV3, v3Sentinel, 'V3 sentinel must remain untouched');
});

// -----------------------------------------------------------------------------
// TEST 18: Academic Calendar & Time Allocation Activated in B.4.1 & B.4.2, Other Handlers Remain Unactivated
// -----------------------------------------------------------------------------
runTest('18. Calendar/time saves support explicit semester targets; students use selected semester', () => {
 assert.ok(appSource.includes('saveAcademicCalendarV5(targetSemesterPlan.id,'));
 assert.ok(appSource.includes('saveTimeAllocationV5(targetSemesterPlan.id, allocations);'));
 assert.ok(appSource.includes('explicitSemesterPlanId || activeSemesterPlan?.id'));
 assert.ok(appSource.includes('saveRosterV5(activeSemesterPlan.id, stdList);'));
});

// -----------------------------------------------------------------------------
// TEST 19: Semester Step Incomplete Semantics in WorkflowEngine
// -----------------------------------------------------------------------------
runTest('19. Semester readiness requires completed, current annual planning, not ATP alone', () => {
 const engine=fs.readFileSync(path.resolve('src/services/workflowEngine.ts'),'utf8').replace(/\s+/g,'');
 assert.ok(engine.includes('constisSemesterBlocked=!isAnnualPlanningComplete||isAnnualPlanningStale;'));
 const body=engine.match(/stepStates\.semester=\{([^}]+)\};/)![1];
 assert.ok(body.includes("status:isSemesterBlocked?'BLOCKED':'READY'"));
 assert.ok(body.includes('isBlocked:isSemesterBlocked'));
 assert.ok(body.includes('isComplete:false'));
});

// -----------------------------------------------------------------------------
// TEST 20: App Derives isActiveSemesterValid from activeSemesterPlan & semesterPlansForActiveYear
// -----------------------------------------------------------------------------
runTest('20. App.tsx derives isActiveSemesterValid without local authority or independent state', () => {
  assert.ok(
    appSource.includes('const isActiveSemesterValid ='),
    'App.tsx must define isActiveSemesterValid'
  );
  assert.ok(
    appSource.includes('semesterPlansForActiveYear.some('),
    'App.tsx must check that activeSemesterPlan is in semesterPlansForActiveYear'
  );
  assert.ok(
    !appSource.includes('useState<string>("semester-') &&
      !appSource.includes('useState<string | null>(null)') &&
      !appSource.includes('useState<SemesterPlan>'),
    'App.tsx must not maintain an independent useState for semester authority'
  );
});

// -----------------------------------------------------------------------------
// TEST 21: semesterAcademicSetting Compatibility Projection Semantics
// -----------------------------------------------------------------------------
runTest('21. Semester projection uses canonical identity, selected semester and actual weekly JP', () => {
 assert.ok(appSource.includes('const semesterAcademicSetting = useMemo<AcademicSetting | undefined>('));
 assert.ok(appSource.replace(/\s+/g,'').includes("activeSemesterPlan.semester===1?'1(Ganjil)':'2(Genap)'"));
 assert.ok(appSource.includes('id: activeSemesterPlan.id,'));
 assert.ok(appSource.includes('totalHoursPerWeek: weeklyJP,'));
 assert.ok(appSource.includes('hoursSourceType: weeklyJPSource,'));
});

// -----------------------------------------------------------------------------
// TEST 22: WorkflowStepper Receives activeSemesterPlan & Enforces Merdeka Gate
// -----------------------------------------------------------------------------
runTest('22. Selected semester cannot override upstream blocking/staleness in Stepper', () => {
 for(const blocked of [false,true]) for(const selected of [false,true]) {
  const states={semester:{status:blocked?'BLOCKED':'READY',isBlocked:blocked,isComplete:false,reason:blocked?'annual planning incomplete':undefined},admin:{status:blocked?'STALE':'READY',isBlocked:blocked,isComplete:false,reason:blocked?'annual planning stale':undefined}};
  assert.strictEqual(evaluateStep('semester','status',states,selected),blocked?'BLOCKED':selected?'COMPLETE':'READY');
  assert.strictEqual(evaluateStep('semester','isComplete',states,selected),!blocked&&selected);
  assert.strictEqual(evaluateStep('semester','isLocked',states,selected),blocked);
  assert.strictEqual(evaluateStep('admin','isLocked',states,selected),blocked||!selected);
  assert.strictEqual(evaluateStep('admin','status',states,selected),blocked?'BLOCKED':selected?'READY':'BLOCKED');
  assert.strictEqual(evaluateStep('admin','isComplete',states,selected),false);
  assert.strictEqual(evaluateStep('admin','lockReason',states,selected),blocked?'annual planning stale':!selected?'Pilih semester aktif terlebih dahulu':undefined);
 }
});

// -----------------------------------------------------------------------------
// TEST 23: App.tsx Passes activeSemesterPlan to WorkflowStepper
// -----------------------------------------------------------------------------
runTest('23. App.tsx passes activeSemesterPlan and handleSelectStep guard to WorkflowStepper', () => {
  assert.ok(
    appSource.includes('activeSemesterPlan={activeSemesterPlan}'),
    'App.tsx must pass activeSemesterPlan to WorkflowStepper'
  );
  assert.ok(
    appSource.includes('onSelectStep={handleSelectStep}'),
    'App.tsx must pass guarded handleSelectStep to WorkflowStepper'
  );
});

// -----------------------------------------------------------------------------
// TEST 24: Direct Navigation Guard in App.tsx
// -----------------------------------------------------------------------------
runTest("24. handleSelectStep intercepts 'admin' when semester is invalid and routes to 'semester'", () => {
  const handlerMatch = appSource.match(/const handleSelectStep = \(([\s\S]*?)\n  \};/);
  assert.ok(handlerMatch, 'handleSelectStep function must exist in App.tsx');
  const handlerBody = handlerMatch[0];

  assert.ok(
    handlerBody.includes("if (isMerdeka && step === 'admin' && !isActiveSemesterValid)"),
    "handleSelectStep must check if Merdeka, step === 'admin', and !isActiveSemesterValid"
  );
  assert.ok(
    handlerBody.includes("setCurrentStep('semester')"),
    "handleSelectStep must redirect to 'semester'"
  );
  assert.ok(
    handlerBody.includes('Pilih Semester 1 atau Semester 2 terlebih dahulu sebelum membuka Administrasi.'),
    'handleSelectStep must show clear warning notice'
  );
});

// -----------------------------------------------------------------------------
// TEST 25: AdministrationHub Input Projection for Merdeka
// -----------------------------------------------------------------------------
runTest('25. Merdeka AdministrationHub receives semesterAcademicSetting and is not rendered if undefined', () => {
  assert.ok(
    appSource.includes('const effectiveAdminAcademicSetting = isK13(transitionalAcademicSetting)'),
    'App.tsx must derive effectiveAdminAcademicSetting based on curriculum'
  );
  assert.ok(
    appSource.includes("{currentStep === 'admin' && effectiveAdminAcademicSetting && ("),
    "App.tsx must gate AdministrationHub render with effectiveAdminAcademicSetting"
  );
  assert.ok(
    appSource.includes('academicSetting={effectiveAdminAcademicSetting}'),
    'AdministrationHub must receive effectiveAdminAcademicSetting'
  );
});

// -----------------------------------------------------------------------------
// TEST 26: AdministrationHub Back Navigation to Semester for Merdeka
// -----------------------------------------------------------------------------
runTest("26. AdministrationHub back button navigates to 'semester' with label (09) for Merdeka", () => {
  assert.ok(
    adminHubSource.includes("onClick={() => onBackToStep(isK13Active ? 'k13-tujuan' : 'semester')}"),
    "AdministrationHub back button must call onBackToStep('semester') for Merdeka"
  );
  assert.ok(
    adminHubSource.includes("{isK13Active ? '← Kembali ke Tujuan & IPK (05)' : '← Kembali ke Pilih Semester (09)'}"),
    "AdministrationHub back button label must be '← Kembali ke Pilih Semester (09)' for Merdeka"
  );
});

// -----------------------------------------------------------------------------
// TEST 27: K13 Back Navigation Remains Preserved
// -----------------------------------------------------------------------------
runTest("27. K13 back button navigates to 'k13-tujuan' with label (05)", () => {
  assert.ok(
    adminHubSource.includes("'k13-tujuan'"),
    "AdministrationHub back button must keep 'k13-tujuan' for K13"
  );
  assert.ok(
    adminHubSource.includes("'← Kembali ke Tujuan & IPK (05)'"),
    "AdministrationHub back button must keep '← Kembali ke Tujuan & IPK (05)' for K13"
  );
});

// -----------------------------------------------------------------------------
// TEST 28: Semester Save Handler Availability
// -----------------------------------------------------------------------------
runTest('28. All semester save handlers remain defined in App.tsx', () => {
  const noOpHandlers = [
    'handleSaveCalendar',
    'handleSaveTimeAllocations',
    'handleSaveStudents',
    'handleSaveAttendance',
    'handleSaveCriteria',
    'handleSaveAssessment',
    'handleDeleteAssessment',
    'handleSaveAssessmentPlan',
    'handleDeleteAssessmentPlan',
    'handleSaveAssessmentPackage',
    'handleDeleteAssessmentPackage',
    'handleSaveRemedials',
    'handleSaveEnrichments',
    'handleSaveLearningPlan',
    'handleDeleteLearningPlan',
  ];

  for (const handler of noOpHandlers) {
    assert.ok(
      appSource.includes(`const ${handler} = `),
      `App.tsx must define ${handler}`
    );
  }
});

console.log(`\nAll ${totalTests} Merdeka V5 Semester Navigation audit tests PASSED successfully!\n`);
