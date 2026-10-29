import type { CPElem, CPAnalysisItem } from '../types';

export interface UnderstandingTarget { itemId: string; elementId: string; cpCompetence: string; materialScope: string }
export interface AnalysisIssue { elementId: string; itemId?: string; field: string; code: string }
export interface AnalysisAIRow {
  elementId: string; itemId?: string; elementName: string; cpText: string;
  cpCompetence: string; materialScope: string; scopeCode: string;
  meaningfulUnderstanding: string; suggestedTp: string;
}
export interface AnalysisAIValidation { items: AnalysisAIRow[]; issues: AnalysisIssue[]; valid: boolean }
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const tokens = (value: string) => value.toLowerCase().match(/[a-zà-ž]{4,}/g)?.filter(word => !['peserta','didik','murid','memahami','pemahaman','bermakna','dalam','untuk','dengan','serta','yang','dapat','mampu','secara','pada','bahwa','menjadi','mereka'].includes(word)) || [];
const relationalWords=new Set(['membantu','berkaitan','saling','hubungan','konsep','menunjukkan','terkait','keterkaitan','mendasari','menghubungkan','berarti','memungkinkan','penting','sehingga','antara','terhadap','bukan','hanya','lebih','juga','merupakan','mendukung','berdasarkan','melibatkan','melalui','tersebut','tentang','suatu']);

// Conservative grounding screen, not a claim of semantic equivalence. Never invent a replacement.
export function understandingIssue(value: unknown, element: Pick<CPElem,'content'>): string | null {
  if(typeof value !== 'string' || !value.trim()) return 'MU_EMPTY';
  if(value.trim().length < 20 || /^(?:-|n\/?a|null|undefined|belum|tidak ada|contoh|lorem ipsum)\.?$/i.test(value.trim())) return 'MU_INVALID';
  if(value.toLowerCase().replace(/[\s.]+/g,'')===(element.content || '').toLowerCase().replace(/[\s.]+/g,'')) return 'MU_INVALID';
  const source = new Set(tokens(element.content || ''));
  const overlap = new Set(tokens(value).filter(word => source.has(word)));
  if(!source.size || overlap.size < Math.min(2,source.size)) return 'MU_GROUNDING_REVIEW';
  // Unknown content terms require review; overlap alone must not admit a new topic.
  if(tokens(value).some(word=>!source.has(word)&&!relationalWords.has(word))) return 'MU_GROUNDING_REVIEW';
  return null;
}

export function validateAnalysisAI(payload: unknown, elements: CPElem[], targets: UnderstandingTarget[] = []): AnalysisAIValidation {
  const issues: AnalysisIssue[] = []; const items: AnalysisAIRow[] = [];
  const raw = payload && typeof payload === 'object' ? (payload as any).items : null;
  if(!Array.isArray(raw) || !raw.length) return {items,issues:[{elementId:'',field:'items',code:'RESPONSE_INVALID'}],valid:false};
  const seen = new Set<string>();
  for(const input of raw) {
    const elementId = text(input?.elementId);
    const element = elements.find(e=>e.id === elementId);
    const itemId = targets.length ? text(input?.itemId) : '';
    const target = targets.find(t=>t.itemId===itemId && t.elementId===elementId);
    if(!element || (targets.length && !target)) {issues.push({elementId:element?.id || '',field:'elementId',code:'CANONICAL_REFERENCE_INVALID'});continue;}
    if(targets.length && seen.has(itemId)) {issues.push({elementId,itemId,field:'itemId',code:'DUPLICATE_TARGET'});continue;}
    seen.add(targets.length ? itemId : elementId);
    const row: AnalysisAIRow = {elementId,itemId:itemId || undefined,elementName:element.name,cpText:element.content || '',
      cpCompetence:target?.cpCompetence ?? text(input.cpCompetence),materialScope:target?.materialScope ?? text(input.materialScope),
      scopeCode:text(input.scopeCode),meaningfulUnderstanding:text(input.meaningfulUnderstanding),suggestedTp:text(input.suggestedTp)};
    if(!targets.length) for(const field of ['cpCompetence','materialScope','suggestedTp'] as const) {
      if(!row[field]) issues.push({elementId,field,code:'FIELD_EMPTY'});
    }
    const code=understandingIssue(input.meaningfulUnderstanding,element);
    if(code) issues.push({elementId,itemId:itemId||undefined,field:'meaningfulUnderstanding',code});
    items.push(row);
  }
  for(const target of targets.length ? targets : elements.map(e=>({elementId:e.id,itemId:''}))) {
    if(!seen.has(targets.length ? target.itemId : target.elementId)) issues.push({elementId:target.elementId,itemId:target.itemId||undefined,field:'items',code:'ELEMENT_MISSING'});
  }
  return {items,issues,valid:issues.length===0};
}

export function getUnderstandingTargets(items: CPAnalysisItem[], elements: CPElem[]): UnderstandingTarget[] {
  return items.filter(item=> {
    const element=elements.find(e=>e.id===item.elementId);
    return element && understandingIssue(item.meaningfulUnderstanding,element);
  }).map(item=>({itemId:item.id,elementId:item.elementId!,cpCompetence:item.cpCompetence,materialScope:item.materialScope}));
}

export function validateStep4Understanding(items:CPAnalysisItem[], elements:CPElem[]):AnalysisIssue[] {
  return items.flatMap(item=> {
    const element=elements.find(e=>e.id===item.elementId);
    // Existing/manual prose is not rewritten or subjected to AI vocabulary restrictions.
    const value=item.meaningfulUnderstanding;
    const code=!element?'CANONICAL_REFERENCE_INVALID':typeof value!=='string'||!value.trim()?'MU_EMPTY':/^(?:-|n\/?a|null|undefined|belum|tidak ada|lorem ipsum)\.?$/i.test(value.trim())?'MU_INVALID':null;
    return code?[{elementId:item.elementId || '',itemId:item.id,field:'meaningfulUnderstanding',code}]:[];
  });
}

export function explainAnalysisIssue(code:string):string {
  return ({MU_EMPTY:'Kolom 3 kosong atau bukan teks.',MU_INVALID:'Kolom 3 bukan pemahaman bermakna yang valid.',MU_GROUNDING_REVIEW:'Keterkaitan kolom 3 atau istilah isi belum terbukti dari CP; perlu ditinjau.',FIELD_EMPTY:'Kolom analisis wajib kosong.',ELEMENT_MISSING:'Elemen/baris target belum tercakup dalam respons.',CANONICAL_REFERENCE_INVALID:'Referensi elemen/baris tidak sesuai ID kanonikal.',DUPLICATE_TARGET:'AI mengembalikan target retry yang sama lebih dari sekali.',CP_COVERAGE_REVIEW:'Cakupan klausa CP belum lengkap.',RESPONSE_INVALID:'Struktur respons analisis tidak valid.',WORKFLOW_NOT_READY:'Prasyarat workflow analisis belum lengkap.'} as Record<string,string>)[code] || 'Permintaan AI gagal pada target ini.';
}

export interface UnderstandingPatch { itemId:string; elementId:string; before:string; after:string }
export function createUnderstandingPatches(items: CPAnalysisItem[], result: AnalysisAIValidation): UnderstandingPatch[] {
  return result.items.flatMap(row=> {
    const item=items.find(i=>i.id===row.itemId && i.elementId===row.elementId);
    if(!item || result.issues.some(issue=>issue.elementId===row.elementId && (!issue.itemId || issue.itemId===row.itemId))) return [];
    // Non-empty manual/previous values always require manual editing, never an AI overwrite.
    if(item.meaningfulUnderstanding?.trim()) return [];
    return [{itemId:item.id,elementId:row.elementId,before:item.meaningfulUnderstanding || '',after:row.meaningfulUnderstanding}];
  });
}
export function applyUnderstandingPatches(items: CPAnalysisItem[], patches: UnderstandingPatch[]): CPAnalysisItem[] {
  return items.map(item=> {
    if(item.meaningfulUnderstanding?.trim()) return item;
    const patch=patches.find(p=>p.itemId===item.id && p.elementId===item.elementId && p.before===(item.meaningfulUnderstanding || ''));
    return patch ? {...item,meaningfulUnderstanding:patch.after} : item;
  });
}

export function createInitialAnalysisDraft(result: AnalysisAIValidation, elements:CPElem[]):CPAnalysisItem[] {
  const rows=elements.flatMap(element=> {
    const matching=result.items.filter(row=>row.elementId===element.id);
    return (matching.length ? matching : [{elementId:element.id,cpCompetence:'',materialScope:'',scopeCode:'',meaningfulUnderstanding:'',suggestedTp:''}]).map((row,index)=>({
      id:`ana-ai-${element.id}-${index+1}`,elementId:element.id,elementName:element.name,cpText:element.content || '',
      cpCompetence:row.cpCompetence,materialScope:row.materialScope,scopeCode:row.scopeCode,
      meaningfulUnderstanding:understandingIssue(row.meaningfulUnderstanding,element)?'':row.meaningfulUnderstanding,suggestedTp:row.suggestedTp,order:0,
    }));
  });
  return rows.map((row,index)=>({...row,order:index+1}));
}
