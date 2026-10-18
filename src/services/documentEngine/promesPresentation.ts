import type { PromesProjection } from './promesProjection';

/** Formatting only: all allocation and semester scope come from buildPromesProjection. */
export function buildPromesPresentation(projection: PromesProjection, blank = false) {
  const months = projection.monthHeaders.map(month => month.monthName);
  const sourceRows = [...projection.rows, ...projection.assessmentRows, ...projection.reserveRows];
  const headers = ['No', 'Unit/Bab', 'TP', 'Materi', 'Alokasi JP', 'Pekan', ...months];
  const widths = [3, 13, 25, 13, 7, 7, ...months.map(() => 32 / months.length)];
  const rows = blank
    ? Array.from({ length: 15 }, (_, index) => [String(index + 1), '........', '........', '........', '.... JP', '....', ...months.map(() => '-')])
    : sourceRows.map((row, index) => [
        String(index + 1), row.unitTitle || row.unitId || '-',
        [row.tpCode, row.tpStatement].filter(Boolean).join('\n') || '-',
        row.materialScope || '-', `${row.allocatedJP} JP`,
        row.startWeek > 0 && row.endWeek >= row.startWeek
          ? row.startWeek === row.endWeek ? String(row.startWeek) : `${row.startWeek}–${row.endWeek}`
          : '-',
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
  ];
  const notes = [
    `Status Alokasi Waktu: ${blank ? '-' : status}.`,
    'Angka pada kolom bulan menunjukkan Jam Pelajaran (JP) intrakurikuler tatap muka yang telah dijadwalkan guru.',
    'Item tanpa alokasi bulan diberi tanda strip (-) yang berarti belum dijadwalkan pada kalender aktif.',
    'Sisa / defisit bernilai negatif menunjukkan alokasi melebihi kapasitas JP tersedia.',
  ].join('\n');
  return { headers, widths, rows, summaryRows, notes, totalJP, monthlyTotals, remainingJP, status };
}
