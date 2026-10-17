import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildModulAjarProjection } from '../src/services/documentEngine/modulAjarProjection';
import { createDocumentSnapshot } from '../src/services/documentEngine/snapshot';
const stamp = '2026-10-17T00:00:00Z';
const tpIds = ['t1', 't2'];
const atpIds = ['a1', 'a2'];
const setting: any = { id: 'sem', curriculumType: 'KURIKULUM_MERDEKA', curriculum: 'Kurikulum Merdeka', semester: '1', subject: 'PJOK', grade: '7' };
const tp: any = { id: 'tp', academicSettingId: 'sem', workflowStatus: 'SIAP', updatedAt: stamp,
  items: tpIds.map((id,i) => ({ id, code: id, statement: 'Kompetensi '+id, order:i+1 })) };
const atp: any = { id: 'atp', academicSettingId: 'sem', workflowStatus: 'SIAP', updatedAt: stamp, basedOnTpUpdatedAt: stamp,
  items: atpIds.map((id,i) => ({ id, tpId: tpIds[i], linkedTpIds:[tpIds[i]], stepNumber:i+1, semester:1, jp:3 })) };
const mapping: any = { id: 'mapping', academicSettingId:'sem', updatedAt:stamp, units:[{
  id:'unit', title:'Unit', order:1, linkedTpIds:tpIds, linkedAtpItemIds:atpIds,
  materials:tpIds.map((id,i)=>({ id:'mat'+i, title:'Materi '+id, order:i+1, linkedTpIds:[id], linkedAtpItemIds:[atpIds[i]] }))
}] };
const meetings = [3,1,2].map(order => ({ id:'m'+order, title:'Judul '+order, unitId:'unit', order, jp:2,
  linkedTpIds:[tpIds[order===2?1:0]], linkedAtpItemIds:[atpIds[order===2?1:0]], materialIds:['mat'+(order===2?1:0)] }));
const execution: any = { id:'execution', academicSettingId:'sem', mappingId:'mapping', basedOnMappingUpdatedAt:stamp, units:[{unitId:'unit', meetings}] };
const schedules: any = [{ semesterPlanId:'sem', semester:1, schedule:{ semesterPlanId:'sem', status:'COMPLETE', entries:meetings.map(m=>({ meetingId:m.id, semesterPlanId:'sem', unitId:'unit', date:'2026-10-'+(18+m.order), jp:2, mode:'MANUAL', dayOfWeek:1, weekIndex:m.order })) } }];
const criteria: any = [...tpIds,'unrelated'].map(id=>({ id:'c'+id, academicSettingId:'sem', tpId:id, description:'KKTP '+id, approach:'deskripsi', indicators:['Indikator '+id], levels:[{level:'Baik',description:'Mandiri'}], workflowStatus:'SIAP', updatedAt:stamp }));
const assessment = (type:string) => ({ id:type, type, linkedTpIds:['t1'], description:'Asesmen '+type });
const plan: any = { id:'lp', curriculumType:'KURIKULUM_MERDEKA', academicSettingId:'sem', unitId:'unit', learningMeetingIds:['m3','m1','m2'], tpIds, atpItemIds:atpIds,
  kktpCriterionIds:['ct1','ct2'], sourceType:'MANUAL', status:'SIAP', confirmedAt:stamp, createdAt:stamp, updatedAt:stamp,
  objectives:tp.items.map((t:any)=>({ ...t, tpId:t.id })), topic:'Topik', allocatedJP:6,
  initialCompetency:'Kompetensi awal', graduateProfileDimensions:['Kemandirian'], resources:[{id:'r',title:'Buku'}], learningModel:'Praktik',
  learningExperiences:['UNDERSTAND','APPLY','REFLECT'].map((phase,i)=>({id:'e'+i,phase,description:'Kegiatan '+phase})),
  assessmentPlan:{ initial:[assessment('INITIAL')], formative:[{...assessment('FORMATIVE'), learningMeetingId:'m1'}], summative:[assessment('SUMMATIVE')] },
  differentiation:{content:'Konten'}, enrichmentPlan:'Pengayaan', remedialPlan:'Remedial', reflection:{teacherReflection:'Guru',studentReflection:'Murid'} };
const context: any = { school:{name:'Sekolah'},profile:{name:'Guru'}, academicSetting:setting,tp,atp, atpUnitMapping:mapping, unitExecutionPlan:execution, learningMeetingSchedules:schedules, learningPlans:[plan],activeLearningPlanId:'lp',assessmentCriteria:criteria };
const projection = buildModulAjarProjection(context);
assert.equal(projection.isReady,true,projection.error);
assert.deepEqual(projection.meetings?.map(m=>m.id),['m1','m2','m3']);
assert.deepEqual(projection.meetings?.map(m=>m.KKTP.map(c=>c.tpId)),[['t1'],['t2'],['t1']]);
assert.deepEqual(projection.meetings?.map(m=>m.assessments.length),[1,0,0]);
assert.equal(projection.sections?.length,8);
assert(!JSON.stringify(projection.sections).includes('unrelated'));
for (const mutation of [
  (c:any)=>c.learningPlans[0].learningMeetingIds.push('dangling'),
  (c:any)=>c.learningMeetingSchedules[0].schedule.entries[0].unitId='other',
  (c:any)=>c.unitExecutionPlan.units[0].meetings[0].linkedTpIds=['missing'],
  (c:any)=>c.learningPlans[0].unitId=undefined,
]) {
  const changed=structuredClone(context); mutation(changed);
  assert.equal(buildModulAjarProjection(changed).isReady,false);
}
const snap=createDocumentSnapshot(context);
assert.equal(snap.learningPlanId,plan.id);
assert.equal(snap.sourceVersions?.learningPlanUpdatedAt,stamp);
assert.equal(buildModulAjarProjection({...context,snapshot:snap}).isReady,true);
assert.equal(buildModulAjarProjection({...context,snapshot:{...snap,sourceVersions:{...snap.sourceVersions,learningPlanUpdatedAt:'old'}}}).isReady,false);
for(const path of ['src/services/documentEngine/generators/modulAjarGenerator.ts','src/services/documentEngine/renderers/pdf/pdfDocGenerators.ts']) {
  const source=readFileSync(path,'utf8');
  assert(source.includes('buildModulAjarProjection(context)'));
  assert(source.includes('Projection.sections') || source.includes('projection.sections'));
  assert(source.includes('section.lines'));
}
console.log('PASS: ordered 3 meetings, invalid lineage, scoped KKTP, shared DOCX/PDF sections, snapshot LearningPlan lineage.');


// Execute both renderers, then inspect DOCX content in addition to the source wiring check.
const { generateModulAjar } = await import('../src/services/documentEngine/generators/modulAjarGenerator');
const { generatePdfDocument } = await import('../src/services/documentEngine/renderers/pdf/pdfDocGenerators');
const { default: JSZip } = await import('jszip');
const docx = await generateModulAjar({...context,skipDownload:true});
assert(docx.blob);
const zip = await JSZip.loadAsync(await docx.blob!.arrayBuffer());
const xml = await zip.file('word/document.xml')!.async('string');
assert(xml.indexOf('Pertemuan 1: Judul 1') < xml.indexOf('Pertemuan 2: Judul 2'));
assert(xml.indexOf('Pertemuan 2: Judul 2') < xml.indexOf('Pertemuan 3: Judul 3'));
for(const section of projection.sections || []) assert(xml.includes(section.title.replace('&','&amp;')));
const pdf = await generatePdfDocument('MODUL_AJAR',{...context,skipDownload:true});
assert(pdf.blob.size > 0);
assert.equal(pdf.snapshot.learningPlanId,'lp');
console.log('PASS: real DOCX/PDF generation; DOCX ordered meeting text and all 8 sections; PDF snapshot lineage.');
const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
const pdfTask = getDocument({ data:new Uint8Array(await pdf.blob.arrayBuffer()), useSystemFonts:true });
const parsedPdf = await pdfTask.promise;
const pdfLines: string[] = [];
for(let i=1;i<=parsedPdf.numPages;i++) {
  const page=await parsedPdf.getPage(i);
  const content=await page.getTextContent();
  pdfLines.push(content.items.map((item:any)=>item.str || '').join(' '));
}
const pdfText=pdfLines.join(' ');
for(const section of projection.sections || []) assert(pdfText.includes(section.title),section.title);
for(const meeting of projection.meetings || []) assert(pdfText.includes('Pertemuan '+meeting.order+': '+meeting.title));
assert(pdfText.indexOf('Pertemuan 1: Judul 1') < pdfText.indexOf('Pertemuan 2: Judul 2'));
assert(pdfText.indexOf('Pertemuan 2: Judul 2') < pdfText.indexOf('Pertemuan 3: Judul 3'));
await pdfTask.destroy();
console.log('PASS: extracted PDF text contains all 8 sections and the same 3 ordered meetings.');

