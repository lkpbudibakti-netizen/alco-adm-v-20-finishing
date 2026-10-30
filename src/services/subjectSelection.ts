import { CURRICULUM_SUBJECTS, CP046_SUBJECTS, findCP046Subject, findSubjectByCode, findSubjectByNameOrAlias, normalizeSubjectString } from '../data/curriculum/subjects';
import { ALL_CURRICULUM_STRUCTURE_RULES } from '../data/curriculum/structure';
import { SMP_REVIEW_CP_ENTRIES } from '../data/curriculum/cp/smp';
import { SMA_REVIEW_CP_ENTRIES } from '../data/curriculum/cp/sma';
import { getPhaseForGrade } from '../data/curriculum/resolver';
import type { CurriculumSubject } from '../data/curriculum/types';

const master=[...new Map([...CURRICULUM_SUBJECTS,...CP046_SUBJECTS].map(s=>[s.code,s])).values()];
const cpEntries=[...SMP_REVIEW_CP_ENTRIES,...SMA_REVIEW_CP_ENTRIES];
export interface SubjectSelectionContext {level:string;grade?:string;phase?:string;curriculum?:string}

// Use existing identities; a fuzzy match must never turn a local/custom name into another subject.
export function resolveSelectionSubject(value:string):CurriculumSubject|undefined {
  const subject=findCP046Subject(value)||findSubjectByCode(value)||findSubjectByNameOrAlias(value);
  const name=normalizeSubjectString(value);
  return subject&&[subject.code,subject.name,...(subject.aliases||[])].some(s=>normalizeSubjectString(s)===name)?subject:undefined;
}

export function getSubjectChoices({level,grade,phase,curriculum}:SubjectSelectionContext):CurriculumSubject[] {
  if(!['SD','SMP','SMA','SMK'].includes(level))return [];
  // The registry has no SMK structure. Keep the general master available and allow vocational input.
  if(level==='SMK')return master;
  const number=Number(grade?.match(/\d+/)?.[0])||undefined;
  const selectedPhase=phase?.replace(/^Fase\s*/i,'').toUpperCase()||(number?getPhaseForGrade(number):undefined);
  return master.filter(subject=>{
    const rules=ALL_CURRICULUM_STRUCTURE_RULES.filter(r=>r.subjectCode===subject.code&&r.level===level&&(!curriculum||r.curriculumType===curriculum));
    const entries=cpEntries.filter(e=>e.subjectCode===subject.code&&e.level===level);
    if(rules.length||entries.length)return rules.some(r=>(!number||r.grade===number)&&(!selectedPhase||!r.phase||r.phase===selectedPhase))
      // CP046 phase restrictions describe Merdeka, not a complete K13 subject exclusion matrix.
      ||entries.some(e=>curriculum==='K13'||!selectedPhase||e.phase===selectedPhase);
    // Use defaultLevel only where no registry coverage exists; it is not an exhaustive legality rule.
    const known=ALL_CURRICULUM_STRUCTURE_RULES.some(r=>r.subjectCode===subject.code)||cpEntries.some(e=>e.subjectCode===subject.code);
    return !known&&(!subject.defaultLevel||subject.defaultLevel===level);
  });
}

export function subjectValueForSelection(current:string,code:string):string {
  if(!code)return '';
  if(resolveSelectionSubject(current)?.code===code)return current;
  return master.find(s=>s.code===code)?.name??current;
}
