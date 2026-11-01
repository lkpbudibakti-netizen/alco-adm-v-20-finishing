import type { CPElem, CPAnalysisItem } from '../types';

export const CP4_FIELDS=['cpCompetence','materialScope','meaningfulUnderstanding','suggestedTp'] as const;
export type CP4Field=typeof CP4_FIELDS[number];
export interface CP4RepairTarget extends Record<CP4Field,string> {itemId:string;elementId:string;fields:CP4Field[];clauseText?:string}
export interface UnderstandingTarget { itemId: string; elementId: string; cpCompetence: string; materialScope: string }
export interface AnalysisIssue { elementId: string; itemId?: string; field: string; code: string; category?:'technical'|'structure'|'quality';rowIndex?:number;clauseIndex?:number }
export interface AnalysisAIRow {
  elementId: string; itemId?: string; elementName: string; cpText: string;
  cpCompetence: string; materialScope: string; scopeCode: string;
  meaningfulUnderstanding: string; suggestedTp: string;
}
export interface AnalysisAIValidation { items: AnalysisAIRow[]; issues: AnalysisIssue[]; valid: boolean }
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const tokens = (value: string) => value.toLowerCase().match(/[a-zà-ž]{4,}/g)?.filter(word => !['peserta','didik','murid','memahami','pemahaman','bermakna','dalam','untuk','dengan','serta','yang','dapat','mampu','secara','pada','bahwa','menjadi','mereka','kepada','dari','atas','oleh','akan','tentang','seperti','ialah','yakni','yaitu','bisa','harus','pula','hari'].includes(word)) || [];

export function stemIndonesianWord(word: string): string {
  let w = word.toLowerCase().trim();
  if (w.length <= 4) return w;
  // Suffixes: -kan, -nya, -lah, -kah, -pun
  w = w.replace(/(?:kan|nya|lah|kah|pun)$/, '');
  if (w.length > 5 && !['teman','halaman','zaman','pedoman','peradaban','minuman','makanan','akhlak','ibadah'].includes(w)) {
    w = w.replace(/(?:an|i)$/, '');
  }
  // Prefixes:
  if (/^memper/.test(w)) {
    w = w.slice(6);
  } else if (/^mem[aeiou]/.test(w) && w.length > 5) {
    w = 'p' + w.slice(3);
  } else if (/^men[aeiou]/.test(w) && w.length > 5) {
    w = 't' + w.slice(3);
  } else if (/^meng[aeiou]/.test(w) && w.length > 6) {
    w = 'k' + w.slice(4);
  } else if (/^meny[aeiou]/.test(w) && w.length > 6) {
    w = 's' + w.slice(4);
  } else if (/^pem[aeiou]/.test(w) && w.length > 5) {
    w = 'p' + w.slice(3);
  } else if (/^pen[aeiou]/.test(w) && w.length > 5) {
    w = 't' + w.slice(3);
  } else if (/^peng[aeiou]/.test(w) && w.length > 6) {
    w = 'k' + w.slice(4);
  } else if (/^peny[aeiou]/.test(w) && w.length > 6) {
    w = 's' + w.slice(4);
  } else {
    w = w.replace(/^(?:meng|men|mem|meny|me)(?=[a-z]{4,})/, '');
  }
  w = w.replace(/^(?:peng|pen|pem|peny|pel|per|pe)(?=[a-z]{4,})/, '');
  w = w.replace(/^(?:ber|bel)(?=[a-z]{4,})/, '');
  w = w.replace(/^ter(?=[a-z]{4,})/, '');
  w = w.replace(/^(?:di|ke|se)(?=[a-z]{4,})/, '');
  return w;
}

export const STANDARD_PEDAGOGICAL_TERMS = new Set([
  // Connective & relational
  'membantu','berkaitan','saling','hubungan','konsep','menunjukkan','terkait','keterkaitan','mendasari',
  'menghubungkan','berarti','memungkinkan','penting','sehingga','antara','terhadap','bukan','hanya','lebih',
  'juga','merupakan','mendukung','berdasarkan','melibatkan','melalui','tersebut','tentang','suatu',
  'memperkuat','memperteguh','membangun','membentuk','mengembangkan','memudahkan','mempermudah','mencerminkan',
  'meneladani','mengamalkan','membiasakan','menerapkan','mewujudkan','mengarahkan','meningkatkan','menumbuhkan',
  'karena','agar','supaya','sebagai','sebagaimana','berperan','mempunyai','memiliki','berfungsi','memfasilitasi','mencapai',
  'menjalin','jalin','hubungan','pengakuan','mengakui',
  // Real world & context
  'kehidupan','sehari','keseharian','harian','lingkungan','masyarakat','keluarga','dunia','nyata','situasi','konteks',
  'kondisi','aktivitas','kegiatan','kebiasaan','pengalaman','praktik','penerapan','kebutuhan','sekolah','rumah',
  'pergaulan','interaksi','sosial','komunikasi','pengawasan','keberadaan','perbuatan','tindakan','wujud','bentuk',
  'pedoman','hidup','keselamatan','manusia','akhirat','respons','kejadian','kerukunan','terpercaya','amanah',
  'usia','dini','sejak','masa','kanak','remaja','kisah','sejarah','peradaban','gelar','sebutan',
  // Character, attitude, mindset
  'sikap','tindakan','perilaku','karakter','kesadaran','tanggung','jawab','moral','etika','pribadi','sesama',
  'menghargai','menghormati','peduli','mandiri','kreatif','kritis','gotong','royong','kebhinekaan','sifat',
  'sabar','kesabaran','jujur','kejujuran','disiplin','santun','adab','tertib','teratur','mulia','terpuji',
  'cinta','kecintaan','sayang','menyayangi','kasih','peduli','biasa','kebiasaan','pembiasaan',
  // Religious & spiritual (PAI & Budi Pekerti, Pancasila)
  'allah','tuhan','pencipta','ciptaan','iman','takwa','taqwa','ketakwaan','ketaatan','keyakinan','akhlak',
  'ibadah','amal','amalan','pengamalan','kebaikan','pahala','syukur','mensyukuri','doa','teladan','ajaran',
  'kebenaran','budi','pekerti','adab','santun','jujur','disiplin','kasih','sayang','rukun','damai',
  'toleransi','bertaqwa','bertakwa','beriman','berakhlak','mulia','tartil','fasih','lafal','pelafalan','melafalkan',
  'ayat','suci','surah','hijaiah','harakat','tartil','syahadat','syahadatain','salat','fardu','wudu','wudhu',
  'nabi','rasul','rasulullah','muhammad','amin','al-amin','kitab','malaikat','keesaan','kerasulan','islam','agama',
  'beragama','lisan','ucap','mengucap','pujian','tayibah','thayyibah','fondasi','utama',
  // Cognitive & mathematical (Matematika, Sains, Umum)
  'bilangan','angka','jumlah','menjumlahkan','penjumlahan','pengurangan','mengurangi','operasi','hitung',
  'perhitungan','menghitung','membilang','cacah','pecahan','ukuran','mengukur','pengukuran','pola','aturan',
  'urutan','langkah','proses','hasil','pemecahan','masalah','penalaran','logika','analisis','kesimpulan',
  'strategi','solusi','dasar','fondasi','keterampilan','kemampuan','benda','objek','konkret','abstrak',
  // General pedagogy & teacher notes
  'catatan','manual','mandiri','guru','pendidik','siswa','peserta','didik','penjelasan','uraian','diskusi','tanya','jawab','pembelajaran'
]);

// Conservative grounding screen, not a claim of semantic equivalence. Never invent a replacement.
export function understandingIssue(
  value: unknown,
  element: Pick<CPElem,'content'> & { name?: string },
  reviewMetadata?: { reviewConfirmed?: boolean; reviewedText?: string; reviewedCpText?: string }
): string | null {
  if(typeof value !== 'string' || !value.trim()) return 'MU_EMPTY';
  if(value.trim().length < 15 || /^(?:-|n\/?a|null|undefined|belum|tidak ada|contoh|lorem ipsum)\.?$/i.test(value.trim())) return 'MU_INVALID';
  if(value.toLowerCase().replace(/[\s.]+/g,'')===(element.content || '').toLowerCase().replace(/[\s.]+/g,'')) return 'MU_INVALID';

  // Strict review confirmation check: requires teacher confirmation, non-empty reviewedText matching current value, and non-empty valid reviewedCpText matching element content
  const currentText = typeof value === 'string' ? value.trim() : '';
  const canonicalCp = (element.content || '').trim();
  if (
    reviewMetadata?.reviewConfirmed === true &&
    typeof reviewMetadata.reviewedText === 'string' &&
    reviewMetadata.reviewedText.trim() === currentText &&
    currentText.length > 0 &&
    typeof reviewMetadata.reviewedCpText === 'string' &&
    reviewMetadata.reviewedCpText.trim().length > 0 &&
    reviewMetadata.reviewedCpText.trim() === canonicalCp
  ) {
    return null;
  }

  const sourceContent = ((element.content || '') + ' ' + (element.name || '')).trim();
  const rawSourceTokens = tokens(sourceContent);
  const source = new Set(rawSourceTokens);
  const sourceStems = new Set(rawSourceTokens.map(stemIndonesianWord));
  if (source.has('nabi') || source.has('muhammad')) {
    source.add('rasulullah');
    source.add('rasul');
    sourceStems.add('rasulullah');
    sourceStems.add('rasul');
  }

  const valTokens = tokens(value);
  if(!valTokens.length) return 'MU_INVALID';

  const overlap = valTokens.filter(word => source.has(word) || sourceStems.has(stemIndonesianWord(word)));

  // Grounding and pedagogical domain alignment: allow reasonable paraphrasing while flagging alien topics
  const isAllowed = (w: string) => source.has(w) || sourceStems.has(stemIndonesianWord(w)) || STANDARD_PEDAGOGICAL_TERMS.has(w) || STANDARD_PEDAGOGICAL_TERMS.has(stemIndonesianWord(w));
  const supportedTokens = valTokens.filter(isAllowed);
  const supportedRatio = supportedTokens.length / valTokens.length;
  const unsupportedCount = valTokens.length - supportedTokens.length;

  const hasGroundedOverlap = overlap.length >= 2 || (overlap.length >= 1 && supportedRatio >= 0.85);
  if(!source.size || !hasGroundedOverlap) return 'MU_GROUNDING_REVIEW';

  if (supportedRatio < 0.65 || unsupportedCount > 3) return 'MU_GROUNDING_REVIEW';
  return null;
}

export function validateAnalysisAI(payload: unknown, elements: CPElem[], targets: UnderstandingTarget[] = [], repairTargets:CP4RepairTarget[]=[]): AnalysisAIValidation {
  const issues: AnalysisIssue[] = []; const items: AnalysisAIRow[] = [];
  const raw = payload && typeof payload === 'object' ? (payload as any).items : null;
  if(!Array.isArray(raw) || !raw.length) return {items,issues:[{elementId:'',field:'items',code:'RESPONSE_INVALID',category:'technical'}],valid:false};
  const seen = new Set<string>();
  for(const [rowIndex,input] of raw.entries()) {
    const elementId = text(input?.elementId);
    const element = elements.find(e=>e.id === elementId);
    const itemId = targets.length || repairTargets.length ? text(input?.itemId) : '';
    const repair=repairTargets.find(t=>t.itemId===itemId&&t.elementId===elementId);
    const target = repair || targets.find(t=>t.itemId===itemId && t.elementId===elementId);
    if(!element || ((targets.length || repairTargets.length) && !target)) {issues.push({elementId:element?.id || '',field:'elementId',code:'CANONICAL_REFERENCE_INVALID'});continue;}
    if((targets.length || repairTargets.length) && seen.has(itemId)) {issues.push({elementId,itemId,field:'itemId',code:'DUPLICATE_TARGET'});continue;}
    seen.add(targets.length || repairTargets.length ? itemId : elementId);
    const row: AnalysisAIRow = {elementId,itemId:itemId || undefined,elementName:element.name,cpText:element.content || '',
      cpCompetence:target?.cpCompetence ?? text(input.cpCompetence),materialScope:target?.materialScope ?? text(input.materialScope),
      scopeCode:text(input.scopeCode),meaningfulUnderstanding:text(input.meaningfulUnderstanding),suggestedTp:text(input.suggestedTp)};
    if(repair)for(const field of CP4_FIELDS)row[field]=repair.fields.includes(field)?text(input[field]):repair[field];
    if(!targets.length) for(const field of (repair?.fields || ['cpCompetence','materialScope','suggestedTp']) as typeof CP4_FIELDS[number][]) {
      if(!row[field]) issues.push({elementId,itemId:itemId||undefined,rowIndex,field,code:field==='meaningfulUnderstanding'?'MU_EMPTY':'FIELD_EMPTY'});
    }
    const code=(!repair || repair.fields.includes('meaningfulUnderstanding'))?understandingIssue(input.meaningfulUnderstanding,element,input):null;
    if(code) issues.push({elementId,itemId:itemId||undefined,rowIndex,field:'meaningfulUnderstanding',code});
    items.push(row);
  }
  for(const target of repairTargets.length ? repairTargets : targets.length ? targets : elements.map(e=>({elementId:e.id,itemId:''}))) {
    if(!seen.has(targets.length || repairTargets.length ? target.itemId : target.elementId)) issues.push({elementId:target.elementId,itemId:target.itemId||undefined,field:'items',code:'ELEMENT_MISSING'});
  }
  for(const issue of issues)issue.category=['MU_GROUNDING_REVIEW','CP_COVERAGE_REVIEW'].includes(issue.code)?'quality':issue.code==='RESPONSE_INVALID'?'technical':'structure';
  const keys=new Set<string>();const unique=issues.filter(issue=>{const key=JSON.stringify([issue.elementId,issue.itemId,issue.rowIndex,issue.field,issue.code,issue.clauseIndex]);if(keys.has(key))return false;keys.add(key);return true;});
  const hasBlocking = unique.some(i => i.category === 'structure' || i.category === 'technical');
  return {items,issues:unique,valid:!hasBlocking};
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
    const value=item.meaningfulUnderstanding;
    const baseCode=!element?'CANONICAL_REFERENCE_INVALID':typeof value!=='string'||!value.trim()?'MU_EMPTY':/^(?:-|n\/?a|null|undefined|belum|tidak ada|lorem ipsum)\.?$/i.test(value.trim())?'MU_INVALID':null;
    if (baseCode) return [{elementId:item.elementId || '',itemId:item.id,field:'meaningfulUnderstanding',code:baseCode}];
    if (element && value) {
      const issueCode = understandingIssue(value, element, {
        reviewConfirmed: item.reviewConfirmed,
        reviewedText: item.reviewedText,
        reviewedCpText: item.reviewedCpText,
      });
      if (issueCode) return [{elementId:item.elementId || '',itemId:item.id,field:'meaningfulUnderstanding',code:issueCode}];
    }
    return [];
  });
}

export function explainAnalysisIssue(code:string):string {
  return ({PEDAGOGY_REVIEW:'Keselarasan kompetensi, materi atau usulan TP terhadap CP perlu ditinjau.',MU_EMPTY:'Kolom 3 kosong atau bukan teks.',MU_INVALID:'Kolom 3 bukan pemahaman bermakna yang valid.',MU_GROUNDING_REVIEW:'Keterkaitan kolom 3 atau istilah isi belum terbukti dari CP; perlu ditinjau.',FIELD_EMPTY:'Kolom analisis wajib kosong.',ELEMENT_MISSING:'Elemen/baris target belum tercakup dalam respons.',CANONICAL_REFERENCE_INVALID:'Referensi elemen/baris tidak sesuai ID kanonikal.',DUPLICATE_TARGET:'AI mengembalikan target retry yang sama lebih dari sekali.',CP_COVERAGE_REVIEW:'Cakupan klausa CP belum lengkap.',RESPONSE_INVALID:'Struktur respons analisis tidak valid.',WORKFLOW_NOT_READY:'Prasyarat workflow analisis belum lengkap.'} as Record<string,string>)[code] || 'Permintaan AI gagal pada target ini.';
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
