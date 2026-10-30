import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as selection from '../src/services/subjectSelection';
import { CURRICULUM_SUBJECTS, CP046_SUBJECTS } from '../src/data/curriculum/subjects';
import { SMP_REVIEW_CP_ENTRIES } from '../src/data/curriculum/cp/smp';
import { SMA_REVIEW_CP_ENTRIES } from '../src/data/curriculum/cp/sma';
import { GRADE_PHASE_MAP, getPhaseFromGrade } from '../src/data/curriculumDefaults';
import { lookupOfficialWeeklyJP } from '../src/services/curriculumRules';

const {getSubjectChoices,resolveSelectionSubject,subjectValueForSelection}=selection;
const master=new Map([...CURRICULUM_SUBJECTS,...CP046_SUBJECTS].map(s=>[s.code,s]));
for(const level of ['SD','SMP','SMA','SMK']) {
  const choices=getSubjectChoices({level});
  assert.equal(new Set(choices.map(s=>s.code)).size,choices.length);
  for(const s of choices)assert.equal(s,master.get(s.code));
  for(const code of ['BINDO','MAT','PJOK','PAI','PAK','PKAT','PHINDU','PBUDDHA','PKHONGHUCU'])assert(choices.some(s=>s.code===code),`${level}/${code}`);
}
for(const entry of [...SMP_REVIEW_CP_ENTRIES,...SMA_REVIEW_CP_ENTRIES]) {
  assert(getSubjectChoices({level:entry.level,phase:entry.phase,curriculum:'KURIKULUM_MERDEKA'}).some(s=>s.code===entry.subjectCode),entry.id);
}
assert(!getSubjectChoices({level:'SD'}).some(s=>s.code==='FISIKA'));
assert(!getSubjectChoices({level:'SMP'}).some(s=>s.code==='B_JEPANG'));
assert(!getSubjectChoices({level:'SMA',grade:'Kelas 10'}).some(s=>s.code==='SEJARAH_LANJUT'));
assert(getSubjectChoices({level:'SMA',grade:'Kelas 11'}).some(s=>s.code==='SEJARAH_LANJUT'));
assert(getSubjectChoices({level:'SMA',grade:'Kelas 10',curriculum:'K13'}).some(s=>s.code==='B_JEPANG'),'Incomplete K13 metadata must not erase distinct foreign-language choices');
for(const value of ['MTK','MAT',' Matematika ','B. Indonesia','PJOK','Bahasa Jawa','B_JEPANG','Bahasa Perancis']) {
  const resolved=resolveSelectionSubject(value)!;assert(resolved,value);assert.equal(subjectValueForSelection(value,resolved.code),value);
}
assert.equal(resolveSelectionSubject('Matematika Adat'),undefined);
assert.equal(resolveSelectionSubject('Guru Kelas'),undefined);
assert.equal(resolveSelectionSubject('Bahasa Jepang')?.code,'B_JEPANG');
assert.equal(subjectValueForSelection('Guru Kelas','BINDO'),'Bahasa Indonesia');
assert.equal(subjectValueForSelection('MTK',''),'');
console.log('PASS master: unique existing codes, six religions, level/grade/phase filtering, all 84 CP046 subject-phase choices, exact aliases and custom-name safety.');

// Execute the real component and its event handlers with controlled React hook state.
let manual=false;
const source=fs.readFileSync('src/components/SubjectSelect.tsx','utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
const module={exports:{} as any};
new Function('require','module','exports',compiled)((name:string)=>name==='react'?{...React,useState:()=>[manual,(v:boolean)=>{manual=v;}]}:selection,module,module.exports);
const SubjectSelect=module.exports.SubjectSelect;
function find(node:any,type:string):any {
  if(!node||typeof node!=='object')return undefined;
  if(node.type===type)return node;
  for(const child of React.Children.toArray(node.props?.children)) {const result=find(child,type);if(result)return result;}
}
let value='MTK',changes=0;
const props=()=>({id:'test',level:'SMP',value,onChange:(v:string)=>{changes++;value=v;},required:true});
let tree=SubjectSelect(props());assert.equal(find(tree,'select').props.value,'MAT');assert.equal(changes,0);
find(tree,'select').props.onChange({target:{value:'MAT'}});assert.equal(value,'MTK');
tree=SubjectSelect({...props(),level:'SD',value:'Fisika'});
assert.equal(find(tree,'select').props.value,'__retained__');assert(renderToStaticMarkup(tree).includes('Tinjau pilihan'));assert.equal(value,'MTK');
tree=SubjectSelect({...props(),value:'Guru Kelas'});assert.equal(find(tree,'select').props.value,'__retained__');
const before=changes;find(tree,'select').props.onChange({target:{value:'__custom__'}});assert.equal(changes,before);
tree=SubjectSelect({...props(),value:'Guru Kelas'});const custom=find(tree,'input');assert(custom);assert.equal(custom.props.maxLength,160);assert.equal(custom.props.required,true);
custom.props.onChange({target:{value:'Bahasa Daerah Setempat'}});assert.equal(value,'Bahasa Daerah Setempat');
tree=SubjectSelect(props());find(tree,'select').props.onChange({target:{value:'BINDO'}});assert.equal(value,'Bahasa Indonesia');assert.equal(manual,false);
console.log('PASS actual dropdown handlers/render: alias/canonical selection, incompatible and custom values retained, explicit manual editing, bounded required field, return to master list.');

function callback(file:string,name:string,bindings:Record<string,unknown>) {
  const text=fs.readFileSync(file,'utf8'),ast=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let expression='';
  function visit(n:ts.Node){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)===name)expression=n.initializer!.getText(ast);ts.forEachChild(n,visit);}visit(ast);assert(expression,name);
  const js=ts.transpileModule('return ('+expression+');',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  return new Function(...Object.keys(bindings),js)(...Object.values(bindings));
}
const saved=Object.freeze({id:'existing-setting',subject:'Fisika',level:'SMA',grade:'Kelas 11',phase:'Fase F',curriculum:'Kurikulum Merdeka',totalHoursPerWeek:5,hoursSourceType:'USER_OVERRIDE',isHoursOverridden:true});
const bytes=JSON.stringify(saved);let draft:any={...saved},writes=0;
const bindings=()=>({formData:draft,GRADE_PHASE_MAP,getPhaseFromGrade,lookupOfficialWeeklyJP,setFormData:(fn:any)=>{writes++;draft=fn(draft);}});
callback('src/components/AcademicSettings.tsx','handleLevelChange',bindings())('SD');
assert.equal(draft.subject,'Fisika');assert.equal(draft.level,'SD');assert.equal(JSON.stringify(saved),bytes);
assert(renderToStaticMarkup(SubjectSelect({id:'changed',level:'SD',value:draft.subject,onChange:()=>{throw Error('Render cannot change data');}})).includes('Tinjau pilihan'));
draft={...saved,subject:'MTK'};writes=0;
callback('src/components/AcademicSettings.tsx','handleSubjectChange',bindings())(subjectValueForSelection('MTK','MAT'));
assert.equal(writes,0);assert.equal(draft.totalHoursPerWeek,5);assert.equal(draft.hoursSourceType,'USER_OVERRIDE');
callback('src/components/AcademicSettings.tsx','handleSubjectChange',bindings())('Bahasa Indonesia');
assert.equal(draft.subject,'Bahasa Indonesia');assert.equal(draft.totalHoursPerWeek,null);
assert.equal(JSON.stringify(saved),bytes);
for(const [file,key] of [['src/components/ProfileManager.tsx','profileForm.id'],['src/components/AcademicSettings.tsx','setting.id']]) {
  assert(fs.readFileSync(file,'utf8').includes(`SubjectSelect key={${key}}`),'Profile/workspace switch remounts manual editor');
}
for(const file of ['src/components/ProfileManager.tsx','src/components/AcademicSettings.tsx','src/App.tsx','src/components/TeacherTeachingLoadModal.tsx']) {
  const text=fs.readFileSync(file,'utf8');assert(text.includes('<SubjectSelect'));assert(!text.includes('SUBJECT_OPTIONS'));
}
console.log('PASS legacy data: level change preserves saved subject, render never writes, equivalent alias retains JP/override without dirty change, explicit different selection resets JP as before, profile/workspace editor isolation.');
