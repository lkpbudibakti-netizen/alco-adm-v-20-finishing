interface Meeting { title: string; materialIds: string[] }
interface Suggestion { unitId: string; meetings: Meeting[] }
interface Unit {
  id: string; title: string; linkedTpIds: string[]; linkedAtpItemIds: string[];
  materials: { id: string; title: string; linkedTpIds: string[]; linkedAtpItemIds: string[] }[];
}

export function inspectMeetingCoverage(units: Unit[], suggestions: Suggestion[], existing: any[] = []) {
  return units.flatMap(unit => {
    const meetings = [...(existing.find(u => u.unitId === unit.id)?.meetings || []),
      ...(suggestions.find(u => u.unitId === unit.id)?.meetings || [])];
    const materials = new Set<string>(meetings.flatMap(m => m.materialIds || []));
    const selected = unit.materials.filter(m => materials.has(m.id));
    const tps = new Set(selected.flatMap(m => m.linkedTpIds || []));
    const atps = new Set(selected.flatMap(m => m.linkedAtpItemIds || []));
    const missing = {
      unitId: unit.id, unitTitle: unit.title,
      materialIds: unit.materials.filter(m => !materials.has(m.id)).map(m => m.id),
      tpIds: unit.linkedTpIds.filter(id => !tps.has(id)),
      atpItemIds: unit.linkedAtpItemIds.filter(id => !atps.has(id)),
    };
    return missing.materialIds.length || missing.tpIds.length || missing.atpItemIds.length ? [missing] : [];
  });
}

// Repairs only generated slots; existing teacher meetings never enter the replacement payload.
export async function repairUnitMeetingCoverage(input: {
  units: Unit[]; suggestions: Suggestion[]; existing?: any[];
  expectedCounts?: Map<string, number>;
  repair: (payload: unknown) => Promise<{ units: Suggestion[] }>;
}) {
  const seen = new Set<string>();
  for (const suggestion of input.suggestions) {
    const unit = input.units.find(u => u.id === suggestion?.unitId);
    if (!unit || seen.has(suggestion.unitId) || !Array.isArray(suggestion.meetings)) {
      throw new Error('Struktur/identitas Bab AI invalid; repair cakupan tidak boleh mengubahnya.');
    }
    seen.add(suggestion.unitId);
    if (input.expectedCounts && suggestion.meetings.length !== input.expectedCounts.get(suggestion.unitId)) {
      throw new Error(`Bab "${unit.title}": jumlah slot awal tidak sesuai target exact.`);
    }
  }
  if (input.expectedCounts && input.units.some(u =>
    (input.expectedCounts!.get(u.id) || 0) > 0 && !seen.has(u.id))) {
    throw new Error('Bab dengan target pertemuan tidak dikembalikan AI.');
  }
  const missing = inspectMeetingCoverage(input.units, input.suggestions, input.existing);
  if (!missing.length) return input.suggestions;
  const describe = () => missing.map(m => `Bab "${m.unitTitle}" (${m.unitId}): TP [${m.tpIds.join(', ')}], ATP [${m.atpItemIds.join(', ')}], materi [${m.materialIds.join(', ')}]`).join('; ');
  const fail = (reason: string): never => { throw new Error(`${describe()}. ${reason}`); };
  const ids = new Set(missing.map(m => m.unitId));
  const targets = input.suggestions.filter(u => ids.has(u.unitId));
  for (const m of missing) {
    const unit = input.units.find(u => u.id === m.unitId)!;
    if (m.tpIds.some(id => !unit.materials.some(mat => mat.linkedTpIds.includes(id)))) {
      fail('TP belum didukung lineage materi canonical; perlu rekonsiliasi sumber sebelum menyusun pertemuan.');
    }
    if (!targets.some(u => u.unitId === m.unitId && u.meetings.length)) fail('Tidak ada slot AI yang dapat diperbaiki.');
  }
  let response: { units: Suggestion[] };
  try {
    response = await input.repair({ missing, canonicalUnits: input.units.filter(u => ids.has(u.id)), generatedUnits: targets });
  } catch (error) { return fail(`Repair AI gagal: ${error instanceof Error ? error.message : String(error)}`); }
  if (!Array.isArray(response?.units) || response.units.length !== targets.length ||
      new Set(response.units.map(u => u.unitId)).size !== targets.length) fail('Repair mengubah daftar Bab.');
  for (const u of response.units) {
    const original = targets.find(t => t.unitId === u.unitId);
    const canonical = input.units.find(t => t.id === u.unitId);
    if (!original || !canonical || !Array.isArray(u.meetings) || u.meetings.length !== original.meetings.length) fail('Repair mengubah jumlah slot/Bab.');
    for (const m of u.meetings) {
      if (!m || typeof m.title !== 'string' || !m.title.trim() || !Array.isArray(m.materialIds) || !m.materialIds.length ||
          new Set(m.materialIds).size !== m.materialIds.length || m.materialIds.some(id => !canonical!.materials.some(mat => mat.id === id)) ||
          Object.keys(m).some(key => !['title', 'materialIds'].includes(key))) fail('Repair memiliki judul, field, atau referensi materi invalid.');
    }
  }
  const next = input.suggestions.map(u => response.units.find(r => r.unitId === u.unitId) || u);
  const remaining = inspectMeetingCoverage(input.units, next, input.existing);
  if (remaining.length) fail(`Repair satu kali belum memenuhi cakupan: ${JSON.stringify(remaining)}.`);
  return next;
}
