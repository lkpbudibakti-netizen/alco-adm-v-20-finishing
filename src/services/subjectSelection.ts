import { ALL_MASTER_CP_ENTRIES, REVIEW_CP046_ENTRIES, resolveCPContext, parseAcademicYearStart, type MasterCPEntry } from '../data/curriculum/cp';
import { GRADE_PHASE_MAP, getPhaseFromGrade } from '../data/curriculumDefaults';
import type { CurriculumPhase, SchoolLevel } from '../data/curriculum/types';
import { CURRICULUM_SUBJECTS, CP046_SUBJECTS, findCP046Subject, findSubjectByCode, findSubjectByNameOrAlias, normalizeSubjectString } from '../data/curriculum/subjects';
import type { CurriculumSubject } from '../data/curriculum/types';

const master=[...new Map([...CURRICULUM_SUBJECTS,...CP046_SUBJECTS].map(s=>[s.code,s])).values()];
export interface SubjectSelectionContext {level:string;grade?:string;phase?:string;curriculum?:string;academicYear?:string;sourceSet?:'historical'|'review046'}
export interface SubjectCPAvailability {
  status:'RESOLVED'|'UNRESOLVED'|'AMBIGUOUS'|'PENDING'|'NOT_APPLICABLE';
  reason:string;
  sources:Array<{id:string;sourceSet:'historical'|'review046';regulationSourceId:string;verificationStatus:MasterCPEntry['verificationStatus']}>;
  blockedSources:Array<{sourceSet:'historical'|'review046';status:'UNRESOLVED'|'AMBIGUOUS'}>;
}

// Use existing identities; a fuzzy match must never turn a local/custom name into another subject.
export function resolveSelectionSubject(value:string):CurriculumSubject|undefined {
  const subject=findCP046Subject(value)||findSubjectByCode(value)||findSubjectByNameOrAlias(value);
  const name=normalizeSubjectString(value);
  return subject&&[subject.code,subject.name,...(subject.aliases||[])].some(s=>normalizeSubjectString(s)===name)?subject:undefined;
}

function contextState(context:SubjectSelectionContext):{status:SubjectCPAvailability['status'];reason:string;phase?:CurriculumPhase} {
  if(!['SD','SMP','SMA','SMK'].includes(context.level))return {status:'UNRESOLVED',reason:'Pilih jenjang terlebih dahulu.'};
  if(context.level==='SMK')return {status:'UNRESOLVED',reason:'Registry CP bawaan belum mencakup SMK. Pertahankan mapel yang ada atau gunakan mapel khusus dan CP manual.'};
  if(context.curriculum==='K13')return {status:'NOT_APPLICABLE',reason:'K13 menggunakan KI/KD. Daftar ini hanya katalog mapel; ketersediaan CP tidak dinyatakan.'};
  const explicit=context.phase?.trim().replace(/^Fase\s*/i,'').toUpperCase();
  const number=Number(context.grade?.match(/\d+/)?.[0])||undefined;
  if(context.grade && !GRADE_PHASE_MAP[context.level]?.some(g=>Number(g.grade.match(/\d+/)?.[0])===number))
    return {status:'UNRESOLVED',reason:'Kelas tidak sesuai jenjang; periksa Data Pembelajaran.'};
  const derived=context.grade?getPhaseFromGrade(context.level,context.grade).replace(/^Fase\s*/i,''):undefined;
  const phase=(explicit||derived) as CurriculumPhase|undefined;
  if((explicit&&derived&&explicit!==derived)||(phase&&!allEntries.some(e=>e.level===context.level&&e.phase===phase)))
    return {status:'UNRESOLVED',reason:'Fase tidak sesuai kelas/jenjang atau tidak tercatat dalam registry CP.'};
  if(context.academicYear && parseAcademicYearStart(context.academicYear)===null)
    return {status:'UNRESOLVED',reason:'Tahun ajaran harus berurutan, misalnya 2025/2026.'};
  if(!phase||!context.academicYear)return {status:'PENDING',reason:'Katalog mapel CP menurut jenjang. Lengkapi kelas/fase dan tahun ajaran untuk memeriksa ketersediaan CP.',phase};
  return {status:'RESOLVED',reason:'',phase};
}

const allEntries=[...ALL_MASTER_CP_ENTRIES,...REVIEW_CP046_ENTRIES];
function catalog(context:SubjectSelectionContext):CurriculumSubject[] {
  const state=contextState(context);
  const lvl=context.level;
  const phase=state.phase;

  if(!['SD','SMP','SMA','SMK'].includes(lvl)) return [];

  // Filter master subjects based on school level and phase relevance
  if(lvl==='SD') {
    const sdCodes=['PAI','PAK','PKAT','PHINDU','PBUDDHA','PKHONGHUCU','PANCASILA','BINDO','MAT','PJOK','BING','SENI_RUPA','SENI_MUSIK','SENI_TARI','SENI_TEATER','PRAKARYA','CODING_AI','LOCAL_CONTENT'];
    if(phase==='B'||phase==='C') sdCodes.splice(9,0,'IPAS');
    return master.filter(s=>sdCodes.includes(s.code));
  }
  if(lvl==='SMP') {
    const smpCodes=['PAI','PAK','PKAT','PHINDU','PBUDDHA','PKHONGHUCU','PANCASILA','BINDO','MAT','IPA','IPS','BING','PJOK','INFORMATIKA','SENI_RUPA','SENI_MUSIK','SENI_TARI','SENI_TEATER','PRAKARYA','PRAKARYA_BUDI_DAYA','PRAKARYA_KERAJINAN','PRAKARYA_PENGOLAHAN','PRAKARYA_REKAYASA','CODING_AI','LOCAL_CONTENT'];
    return master.filter(s=>smpCodes.includes(s.code));
  }
  if(lvl==='SMA'||lvl==='SMK') {
    if(phase==='E') {
      const smaECodes=['PAI','PAK','PKAT','PHINDU','PBUDDHA','PKHONGHUCU','PANCASILA','BINDO','MAT','IPA','IPS','BING','PJOK','INFORMATIKA','SENI_RUPA','SENI_MUSIK','SENI_TARI','SENI_TEATER','FISIKA','KIMIA','BIOLOGI','SOSIOLOGI','EKONOMI','GEOGRAFI','SEJARAH','PRAKARYA','PRAKARYA_BUDI_DAYA','PRAKARYA_KERAJINAN','PRAKARYA_PENGOLAHAN','PRAKARYA_REKAYASA','PKWU_BUDI_DAYA','PKWU_KERAJINAN','PKWU_PENGOLAHAN','PKWU_REKAYASA','CODING_AI','LOCAL_CONTENT'];
      return master.filter(s=>smaECodes.includes(s.code));
    } else {
      const smaFCodes=['PAI','PAK','PKAT','PHINDU','PBUDDHA','PKHONGHUCU','PANCASILA','BINDO','MAT','BING','PJOK','INFORMATIKA','SENI_RUPA','SENI_MUSIK','SENI_TARI','SENI_TEATER','PRAKARYA','CODING_AI','LOCAL_CONTENT','FISIKA','KIMIA','BIOLOGI','SOSIOLOGI','EKONOMI','GEOGRAFI','SEJARAH','ANTROPOLOGI','MAT_LANJUT','BINDO_LANJUT','BING_LANJUT','BAHASA_ASING_LAIN','SEJARAH_LANJUT','PRAKARYA_BUDI_DAYA','PRAKARYA_KERAJINAN','PRAKARYA_PENGOLAHAN','PRAKARYA_REKAYASA','PKWU_BUDI_DAYA','PKWU_KERAJINAN','PKWU_PENGOLAHAN','PKWU_REKAYASA','B_ARAB','B_JEPANG','B_JERMAN','B_KOREA','B_MANDARIN','B_PRANCIS'];
      return master.filter(s=>smaFCodes.includes(s.code));
    }
  }
  return master;
}

export function getSubjectCPAvailability(value:string,context:SubjectSelectionContext):SubjectCPAvailability {
  const subject=resolveSelectionSubject(value),state=contextState(context);
  const empty=(status:SubjectCPAvailability['status'],reason:string):SubjectCPAvailability=>({status,reason,sources:[],blockedSources:[]});
  if(state.status!=='RESOLVED')return empty(state.status,state.reason);
  if(!subject)return empty('UNRESOLVED','Mapel khusus/nama lama tidak mempunyai CP bawaan yang dapat dipastikan. Gunakan CP manual di Step 3.');
  const sources:SubjectCPAvailability['sources']=[],blockedSources:SubjectCPAvailability['blockedSources']=[];
  const sets: Array<'historical'|'review046'>=context.sourceSet?[context.sourceSet]:['historical','review046'];
  for(const sourceSet of sets) {
    const result=resolveCPContext({subjectCode:subject.code,level:context.level as SchoolLevel,
      phase:state.phase!,academicYear:context.academicYear,sourceSet:sourceSet==='review046'?'review046':undefined});
    // Do not let legacy fuzzy matching advertise a different subject's CP under a new code.
    if(result.status==='RESOLVED'&&result.cp?.subjectCode===subject.code)
      sources.push({id:result.cp.id,sourceSet,regulationSourceId:result.cp.regulationSourceId,verificationStatus:result.cp.verificationStatus});
    else blockedSources.push({sourceSet,status:result.status==='AMBIGUOUS'?'AMBIGUOUS':'UNRESOLVED'});
  }
  if(sources.length)return {status:'RESOLVED',sources,blockedSources,reason:'Pilihan sumber CP diperiksa terpisah; pilih sumber secara eksplisit di Step 3. CP tersimpan tidak berubah.'};
  const ambiguous=blockedSources.some(s=>s.status==='AMBIGUOUS');
  return {status:ambiguous?'AMBIGUOUS':'UNRESOLVED',sources,blockedSources,
    reason:(ambiguous?'CP ambigu (AMBIGUOUS).':'CP belum tersedia bawaan.')+' Mapel tetap dapat dipilih, lanjutkan pengisian CP manual di Step 3.'};
}

export function getSubjectChoices(context:SubjectSelectionContext):CurriculumSubject[] {
  const state=contextState(context);
  if(state.status==='UNRESOLVED')return [];
  return catalog(context);
}

export function subjectCPLabel(availability:SubjectCPAvailability):string {
  if(availability.status!=='RESOLVED')return availability.reason;
  const labels=availability.sources.map(s=>(s.sourceSet==='review046'?'046/2025 REVIEW':'Bawaan/historis')+' / '+s.verificationStatus+' ['+s.regulationSourceId+']');
  const ambiguous=availability.blockedSources.filter(s=>s.status==='AMBIGUOUS').map(s=>' Sumber '+(s.sourceSet==='review046'?'046/2025 REVIEW':'historis')+' ambigu dan tidak dapat dipilih.').join('');
  return labels.join('; ')+'. Pilih sumber di Step 3.'+ambiguous;
}

export function subjectValueForSelection(current:string,code:string):string {
  if(!code)return '';
  if(resolveSelectionSubject(current)?.code===code)return current;
  return master.find(s=>s.code===code)?.name??current;
}
