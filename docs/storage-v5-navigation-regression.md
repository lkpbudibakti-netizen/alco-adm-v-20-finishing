# Storage V5 navigation regression — PR #1

Branch: `feat/cp-smp-sma-046-2025`. Baseline commit: `3b42d8b59b44111478ef9285fb93fdcceb3de9b4`.

## Audit dan perubahan

Alur Merdeka di `App.tsx` dan `WorkflowStepper.tsx` adalah:

`01 Profil → 02 Data Pembelajaran → 03 CP → 04 Analisis CP → 05 TP → 06 ATP → 07 Pemetaan → 08 Rencana Tahunan → 09 Semester → 10 Administrasi`.

- ATP meneruskan ke `atp-mapping`. Pemetaan meneruskan melalui `handleEnterAnnualPlanning`, yang memeriksa `resolveATPUnitMappingReadiness` dan mengembalikan pengguna ke pemetaan jika belum siap.
- Rencana Tahunan meneruskan ke semester; tombol kembali mengikuti rantai sebaliknya. Penyelesaian ATP saja tidak cukup untuk membuka semester: rencana tahunan harus lengkap dan tidak stale. Pemilihan semester tidak boleh mengalahkan status blocked dari workflow.
- `testMerdekaV5SemesterNavigation.ts` kini memeriksa keseluruhan daftar langkah/nomor dari AST, callback JSX per komponen, guard pemetaan, navigasi balik dan kombinasi status semester/admin. Ini mencegah callback dari komponen lain membuat tes salah lulus.
- Tes kalender dan alokasi waktu mengikuti `explicitSemesterPlanId`/`effectiveSemesterPlanId`, karena konfigurasi dua semester dilakukan dari Rencana Tahunan sebelum semester administrasi dipilih. Kartu kesiapan kini diperiksa di pemilik sebenarnya, `AnnualPlanningManager`.
- Tes annualisasi ATP mengikuti tabel urutan/fokus/TP tertaut V20, proyeksi server tanpa JP semester, serta fixture canonical `linkedTpIds` dengan CP/Analisis CP yang valid. Duplikasi TP dalam satu langkah tetap ditolak.
- Tes readiness impor pemetaan menggunakan ID canonical sebagai authority. Judul guru tidak digunakan sebagai pengganti lineage; ID TP tidak dikenal tetap ditolak, dan navigasi tetap memerlukan kesiapan serta keberhasilan penyimpanan.
- Pembacaan source dalam tes dinormalisasi LF agar perbedaan CRLF Windows tidak menimbulkan kegagalan semu.

Tidak ada perubahan navigasi produksi, data CP046, storage, profil guru, atau migrasi.

## Hasil validasi lokal

| Pemeriksaan | Hasil |
| --- | --- |
| testMerdekaV5SemesterNavigation | PASS 28/28 |
| testMerdekaCPAnalysisIntegrity | PASS |
| testMerdekaV5CalendarRuntime | PASS 50/50 |
| testAutoSemesterTimeAllocation | PASS |
| testMerdekaATPAnnualizationIntegrity | PASS 16/16 |
| testStep7ImportedReadinessRegression | PASS |
| testP1D4MappingReadinessRegression | PASS |
| testATPUnitMappingActionApplyRegression | PASS |
| testCalendarWorkflowRefactor | PASS |
| testCP046ReviewIntegration | PASS: 84 record / 327 elemen / 30 subelemen dan ZIP restore |
| Seluruh perintah skrip Storage V5 Regression (35 skrip + B13), dengan pengulangan tes yang diperbaiki | 29 PASS, 7 FAIL — lihat rincian di bawah |
| Build produksi | PASS (Vite/PWA/server; warning ukuran chunk) |
| TypeScript penuh | FAIL: 68 diagnostik identik sebelum/sesudah perubahan; termasuk fixture assessment lama dan AdminDocsExport yang merujuk properti projection tidak tersedia |

### Blocker yang tersisa di luar navigasi

1. `testCanonicalPromesProjection`: assertion kesiapan proyeksi pertama gagal; fixture memakai ATP lama tanpa graph CP/TP canonical.
2. `testCanonicalAlokasiWaktuDocument`: proyeksi kosong menyebabkan akses `allocatedJP` pada baris undefined; fixture lama tidak menyediakan graph canonical lengkap.
3. `testCanonicalProtaProjection`: assertion kesiapan proyeksi pertama gagal dengan fixture ATP lama.
4. `testAuditNo8LearningPlanRegression`: dua assertion proyeksi modul ajar gagal (pemilihan plan dan statement TP canonical).
5. `testRecoveryM1ModulAjarPrintPrivacyRegression`: build ID `runtime-unknown` tidak cocok ID lama yang di-hardcode, assertion readiness, dan ekspor fixture modul ajar gagal.
6. `testDevelopmentServerSmoke`: `spawn npm.cmd` menghasilkan EINVAL pada Windows. Ini bukan hasil runner Ubuntu GitHub.
7. `testProductionServerSmoke`: proses server hasil build keluar 1 sebelum health check siap, termasuk setelah build diulang.

Kegagalan tersebut ditemukan saat menjalankan seluruh skrip workflow, tanpa mengubah kode produksi. Perbaikan generator dokumen, fixture assessment lain, dan runtime server tidak dimasukkan ke perubahan navigasi ini. CI keseluruhan tidak dinyatakan hijau.

## File berubah

- scripts/testMerdekaV5SemesterNavigation.ts
- scripts/testMerdekaCPAnalysisIntegrity.ts
- scripts/testMerdekaV5CalendarRuntime.ts
- scripts/testAutoSemesterTimeAllocation.ts
- scripts/testMerdekaATPAnnualizationIntegrity.ts
- scripts/testStep7ImportedReadinessRegression.ts
- docs/storage-v5-navigation-regression.md

Tidak ada merge otomatis. Pengujian ini membuktikan kontrak source dan layanan penyimpanan/readiness; tidak mencakup klik UI browser secara interaktif.
