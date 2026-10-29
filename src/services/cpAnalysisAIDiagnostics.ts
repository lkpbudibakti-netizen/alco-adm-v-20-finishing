import { APP_BUILD_ID, APP_BUILD_SHA } from '../config/buildInfo';
import { explainAnalysisIssue, type AnalysisIssue } from './cpAnalysisAIContract';
import { findSubjectByCode, findSubjectByNameOrAlias } from '../data/curriculum/subjects';

const messages:Record<string,string>={
  AI_TIMEOUT:'Permintaan AI melewati batas waktu.',AI_PROVIDER_ERROR:'Layanan AI gagal menghasilkan analisis.',
  AI_API_ERROR:'Permintaan API analisis CP gagal.',AI_NOT_CONFIGURED:'Layanan AI belum dikonfigurasi.',
  RESPONSE_INVALID:'Respons AI bukan JSON analisis yang valid.',VALIDATION_FAILED:'Sebagian hasil AI perlu diperbaiki; periksa diagnosis per elemen.',
  DRAFT_CHANGED:'Data berubah selama permintaan AI. Hasil tidak diterapkan.',CP_ELEMENTS_REQUIRED:'Lengkapi elemen CP kanonikal sebelum analisis AI.',
  RETRY_TARGET_INVALID:'Target retry tidak sesuai ID baris dan elemen CP.',
};
export class CPAnalysisAIError extends Error {
  constructor(public code:string,public stage:string) {super(messages[code] || messages.AI_API_ERROR);}
}
export interface CPAnalysisDiagnosis {
  time:string; build:string; step:string; subject:string; phase:string; grade:string;
  code:string; stage:string; elementCount:number; issues:AnalysisIssue[]; message:string;
}
const safe=(value:unknown)=>String(value ?? '').replace(/[\r\n\t]/g,' ').replace(/AIza[\w-]+|Bearer\s+\S+|(?:api[-_ ]?key|token|authorization)\s*[:=]\s*\S+|[\w.+-]+@[\w.-]+|\b\d{8,}\b/gi,'[REDACTED]').slice(0,100);
export function createCPAnalysisDiagnosis(context:{subject?:string;phase?:string;grade?:string}, count:number, code:string, stage:string, issues:AnalysisIssue[]=[]):CPAnalysisDiagnosis {
  const subject=findSubjectByCode(context.subject || '') || findSubjectByNameOrAlias(context.subject || '');
  return {time:new Date().toISOString(),build:`${APP_BUILD_ID} ${APP_BUILD_SHA || ''}`.trim(),step:'04 — Analisis CP',subject:subject?.name || '[mapel tidak dikenal]',phase:/^(?:Fase\s*)?[A-F]$/i.test(context.phase || '')?safe(context.phase):'[fase tidak dikenal]',grade:/^(?:Kelas\s*)?\d{1,2}(?:\s*[-/]\s*\d{1,2})?$/i.test(context.grade || '')?safe(context.grade):'[kelas tidak dikenal]',
    code:messages[code]?code:'AI_API_ERROR',stage:['request','provider','transport','response','validation','apply','save'].includes(stage)?stage:'transport',elementCount:count,
    issues:issues.map(i=>({elementId:safe(i.elementId),itemId:i.itemId?safe(i.itemId):undefined,field:safe(i.field),code:safe(i.code)})),message:messages[code] || messages.AI_API_ERROR};
}
export function formatCPAnalysisDiagnosis(d:CPAnalysisDiagnosis):string {
  return [`Waktu: ${d.time}`,`Build: ${d.build}`,`Step: ${d.step}`,`Mapel: ${d.subject}`,`Fase: ${d.phase}`,`Kelas: ${d.grade}`,`Kode error: ${d.code}`,`Tahapan gagal: ${d.stage}`,`Jumlah elemen: ${d.elementCount}`,`ID elemen bermasalah: ${[...new Set(d.issues.map(i=>i.elementId).filter(Boolean))].join(', ') || '-'}`,`Pesan error: ${d.message}`,`Ringkasan validasi: ${d.issues.length} masalah`,...d.issues.map(i=>`${i.elementId || '-'} / ${i.itemId || '-'} / ${i.field}: ${i.code} — ${explainAnalysisIssue(i.code)}`)].join('\n');
}
export async function copyCPAnalysisDiagnosis(report:string):Promise<'copied'|'manual'> {
  try {if(navigator.clipboard?.writeText) {await navigator.clipboard.writeText(report);return 'copied';}} catch { /* Embedded/HTTP previews can deny Clipboard API. */ }
  let area:HTMLTextAreaElement|undefined;
  const focused=typeof document!=='undefined'?document.activeElement:null;
  try {
    area=document.createElement('textarea');area.value=report;area.setAttribute('readonly','');area.style.position='fixed';area.style.opacity='0';
    document.body.appendChild(area);area.select();
    if(document.execCommand('copy')) return 'copied';
  } catch { /* Show a selectable manual copy field in the UI. */ }
  finally {area?.remove();if(typeof HTMLElement!=='undefined' && focused instanceof HTMLElement) focused.focus();}
  return 'manual';
}
