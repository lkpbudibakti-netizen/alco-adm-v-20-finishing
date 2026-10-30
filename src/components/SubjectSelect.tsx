import React, { useState } from 'react';
import { getSubjectChoices, resolveSelectionSubject, subjectValueForSelection, type SubjectSelectionContext } from '../services/subjectSelection';

interface Props extends SubjectSelectionContext {id:string;value:string;onChange:(value:string)=>void;required?:boolean;className?:string}
export const SubjectSelect: React.FC<Props> = ({id,value,onChange,required,className,...context}:Props) => {
  const [manual,setManual]=useState(false);
  const options=getSubjectChoices(context);
  const current=resolveSelectionSubject(value);
  const compatible=current&&options.some(s=>s.code===current.code);
  const retained=Boolean(value&&!compatible);
  return <div className="space-y-1.5">
    <select id={id} aria-label="Mata pelajaran" required={required} className={className}
      value={manual?'__custom__':compatible?current!.code:retained?'__retained__':''}
      onChange={e=>{if(e.target.value==='__custom__'){setManual(true);return;}setManual(false);if(e.target.value!=='__retained__')onChange(subjectValueForSelection(value,e.target.value));}}>
      <option value="">— Pilih Mata Pelajaran —</option>
      {retained&&<option value="__retained__">{value} — nilai saat ini</option>}
      {options.map(s=><option key={s.code} value={s.code}>{s.name}</option>)}
      <option value="__custom__">Mapel khusus / muatan lokal / lainnya…</option>
    </select>
    {compatible&&value!==current!.name&&<p className="text-xs text-slate-500">Nilai tersimpan: {value}</p>}
    {retained&&<p role="status" className="text-xs text-amber-800">{current?'Mapel saat ini tidak tercantum untuk jenjang/kelas ini. Tinjau pilihan sebelum menyimpan; nilainya tetap dipertahankan.':'Mapel khusus atau nama lama tetap dipertahankan. Pilih opsi lainnya untuk mengedit.'}</p>}
    {manual&&<input id={`${id}-custom`} aria-label="Nama mapel khusus / muatan lokal" type="text" required={required} maxLength={160}
      value={value} onChange={e=>onChange(e.target.value)} pattern=".*\S.*" placeholder="Nama mapel khusus / muatan lokal" className={className}/>}
    {context.level==='SMK'&&<p className="text-xs text-slate-500">Daftar umum tersedia; gunakan opsi lainnya untuk mapel kejuruan.</p>}
  </div>;
};
