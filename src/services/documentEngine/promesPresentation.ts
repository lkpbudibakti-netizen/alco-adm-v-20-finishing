import type { PromesProjection } from './promesProjection';

function formatAllocatedWeeks(allocations: Record<number, number>): string {
  const weeks = Object.entries(allocations)
    .filter(([, jp]) => Number.isFinite(jp) && jp > 0)
    .map(([week]) => Number(week))
    .filter(week => Number.isInteger(week) && week > 0).sort((a, b) => a - b);
  const ranges: string[] = [];
  for (let index = 0; index < weeks.length; index++) {
    const start = weeks[index];
    let end = start;
    while (index + 1 < weeks.length && weeks[index + 1] === end + 1) end = weeks[++index];
    ranges.push(start === end ? String(start) : `${start}–${end}`);
  }
  return ranges.join(', ') || '-';
}

/** Formatting only: all allocation and semester scope come from buildPromesProjection. */
export function buildPromesPresentation(projection: PromesProjection, blank = false) {
  const months = projection.monthHeaders.map(month => month.monthName);
  const sourceRows = [...projection.rows, ...projection.assessmentRows, ...projection.reserveRows];
  const isK13 = projection.curriculumType === 'K13';
  const headers = ['No', ...(isK13 ? ['Kompetensi Dasar (KD)', 'Indikator/Materi'] : ['Unit/Bab', 'TP', 'Materi']), 'Alokasi JP', 'Pekan', ...months];
  const widths = [3, ...(isK13 ? [13, 38] : [13, 25, 13]), 7, 7, ...months.map(() => 32 / months.length)];
  const jpIndex = isK13 ? 3 : 4;
  const alignments = headers.map((_, index): 'left' | 'center' => index === 0 || index >= jpIndex ? 'center' : 'left');
  const rows = blank
    ? Array.from({ length: 15 }, (_, index) => [String(index + 1), ...Array(isK13 ? 2 : 3).fill('........'), '.... JP', '....', ...months.map(() => '-')])
    : sourceRows.map((row, index) => [
        String(index + 1),
        ...(isK13
          ? [row.tpCode || '-', [row.tpStatement, row.materialScope].filter(Boolean).join('\n') || '-']
          : [row.unitTitle || row.unitId || '-', [row.tpCode, row.tpStatement].filter(Boolean).join('\n') || '-', row.materialScope || '-']),
        `${row.allocatedJP} JP`, formatAllocatedWeeks(row.weekAllocations),
        ...months.map(month => row.monthlyJP[month] == null || row.monthlyJP[month] === 0 ? '-' : String(row.monthlyJP[month])),
      ]);
  const totalJP = sourceRows.reduce((sum, row) => sum + row.allocatedJP, 0);
  const monthlyTotals = months.map(month => sourceRows.reduce((sum, row) => sum + (row.monthlyJP[month] ?? 0), 0));
  const remainingJP = projection.availableJP === null ? null : projection.availableJP - totalJP;
  const status = remainingJP === null ? '-' : remainingJP < 0 ? 'OVER_ALLOCATED' : remainingJP > 0 ? 'UNDER_ALLOCATED' : 'BALANCED';
  const summaryRows = [
    ['-', '-', 'TOTAL JP SEMESTER', '-', blank ? '-' : `${totalJP} JP`, '-', ...monthlyTotals.map(total => blank ? '-' : String(total))],
    ['-', '-', 'KAPASITAS JP TERSEDIA', '-', blank || projection.availableJP === null ? '-' : `${projection.availableJP} JP`, '-', ...months.map(() => '-')],
    ['-', '-', 'SISA / DEFISIT JP', '-', blank || remainingJP === null ? '-' : `${remainingJP} JP`, '-', ...months.map(() => '-')],
    ['-', '-', 'STATUS ALOKASI', '-', blank ? '-' : status, '-', ...months.map(() => '-')],
  ].map(row => isK13 ? row.filter((_, index) => index !== 3) : row);
  const notes = [
    `Status Alokasi Waktu: ${blank ? '-' : status}.`,
    'Angka pada kolom bulan menunjukkan Jam Pelajaran (JP) intrakurikuler tatap muka yang telah dijadwalkan guru.',
    'Item tanpa alokasi bulan diberi tanda strip (-) yang berarti belum dijadwalkan pada kalender aktif.',
    'Sisa / defisit bernilai negatif menunjukkan alokasi melebihi kapasitas JP tersedia.',
  ].join('\n');
  return { headers, widths, alignments, rows, summaryRows, notes, totalJP, monthlyTotals, remainingJP, status };
}
