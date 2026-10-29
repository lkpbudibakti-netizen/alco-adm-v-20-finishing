# Finalisasi PR #1 — hanya integrasi CP SMP/SMA

## Basis dan batas perubahan

Main yang di-fetch: `7dd4c39f107c184719c6069165a265709f66d6f9`. Head PR sebelum pemurnian scope: `136577fbeb34147775314ca118861a04e5854c9f`.

Lima tes non-CP dari pekerjaan sebelumnya dikembalikan persis ke versi main:

- scripts/testAutoSemesterTimeAllocation.ts
- scripts/testMerdekaATPAnnualizationIntegrity.ts
- scripts/testMerdekaV5CalendarRuntime.ts
- scripts/testMerdekaV5SemesterNavigation.ts
- scripts/testStep7ImportedReadinessRegression.ts

Laporan khusus navigasi `docs/storage-v5-navigation-regression.md` juga dihapus. Normalisasi akhir baris dalam `testMerdekaCPAnalysisIntegrity.ts` dipertahankan karena merupakan tes CP. Tidak ada perubahan kode produksi ATP, PROTA, PROMES, modul ajar, navigasi, storage, atau layanan backup–restore.

Seluruh kode produksi, package.json dan tes CP tetap identik dengan commit 136577f. Integrasi adapter/registry, kedua JSON sumber, metadata regulasi/PDF, sourceElementKey dan perlindungan referensi metadata tetap dipertahankan. Koreksi scope dilakukan dengan commit baru, tanpa menulis ulang riwayat.

## Integrasi dan keamanan CP

- Tepat 22 SMP Fase D + 62 SMA Fase E/F, 327 elemen dan 30 subelemen. Kedua JSON byte-identik dengan lampiran asli berdasarkan SHA-256; status JSON tetap REVIEW dan seluruh impor tetap UNVERIFIED.
- 62 master CP historis main (17 SMP, 18 SMA, 27 SD) tetap identik sebagai data: tidak ada penghapusan, perubahan redaksi, promosi verifikasi atau migrasi proyek guru.
- Kode mapel terpisah untuk varian Prakarya/PKWU, bahasa asing dan Sejarah Tingkat Lanjut. Pemilihan menguji mapel, fase, jenjang dan TA 2024/2025, 2025/2026, 2026/2027. Ambiguitas disengaja ditolak, bukan first-match.
- 169 label awal SMA dipisahkan hanya bila cocok persis dan diikuti whitespace. Teks asli disimpan. Induk yang memiliki subelemen tetap hadir dan memproyeksikan seluruh isi anak untuk alur existing.
- Agama 046/2025 tidak menimpa agama 2026. Agama SMA F TA 2026/2027 tanpa sumber 2026 tetap UNRESOLVED. Masa implementasi regulasi 020/2026 tetap perlu review naskah keputusan; tidak diklaim sudah divalidasi secara hukum.
- Dua pilihan generik lama (Seni dan Prakarya; Matematika Wajib/Pilihan) tidak dipaksakan menjadi satu mapel khusus melalui substring. Nilai guru tersimpan tidak dimodifikasi; pilihan mapel eksplisit telah ditambahkan.

Dua celah CP telah ditutup pada commit 136577f dan tetap terlindungi tes: metadata hasil pencarian tidak berbagi referensi mutable dengan JSON/registry, dan sourceElementKey menyimpan ID PDF ketika COPY memetakan ulang ID lokal.

## Pengujian setelah pemurnian scope

| Pemeriksaan | Hasil |
| --- | --- |
| testCP046ReviewIntegration | PASS: 84/327/30, identitas, matriks pemilihan, sumber byte-identik, status REVIEW |
| testCP046SafetyRegression dengan snapshot main | PASS: histori utuh, metadata terisolasi, seluruh 84 CP diuji ZIP RESTORE/COPY |
| testCPSourceSearchRuntimeRegression | PASS |
| testPJOKSDCPResolverRegression | PASS |
| testCPAnalysisSemanticReviewRegression | PASS |
| testMerdekaV5AnnualCPRuntime | PASS |
| testMerdekaCPAnalysisIntegrity | PASS |
| testCompleteProjectArchiveRegression | PASS |
| testStorageV5Persistence | PASS |
| testStorageV5Contract | PASS |

Uji seluruh 84 ZIP membuktikan teks, hierarki, ID sumber, metadata, status UNVERIFIED, profil guru, dan CP asal tetap utuh. ID lokal COPY memang berbeda; source state tetap identik. Tidak ada penulisan ke data guru nyata atau migrasi otomatis. Bukti ini berupa tes data/kontrak; tidak mencakup klik UI atau validasi akhir redaksi terhadap PDF.

## Klasifikasi CI versus baseline main

[CI main pada SHA 7dd4c39](https://github.com/lkpbudibakti-netizen/alco-adm-v-20-finishing/actions/runs/40671332430) gagal pada tes navigasi semester lama. Setelah pemurnian scope, tes navigasi PR kembali identik dengan main. Tes navigasi dan PROMES dijalankan ulang pada kedua checkout hanya untuk membandingkan kegagalan; tidak diperbaiki.

| Pemeriksaan | Main | PR | Klasifikasi |
| --- | --- | --- | --- |
| testMerdekaV5SemesterNavigation | FAIL | FAIL | Baseline main: tes lama mengharapkan ATP langsung ke semester |
| testCanonicalPromesProjection | FAIL | FAIL | Baseline main: assertion readiness proyeksi pertama |

Audit sebelumnya pada SHA main yang sama juga mereproduksi kegagalan Alokasi Waktu, PROTA, proyeksi modul ajar dan print privacy pada kedua checkout. Kode dan fixture tersebut tetap tidak diubah. Ini bukan regresi CP.

Build produksi final PASS (Vite/PWA/server), dengan warning ukuran chunk. TypeScript penuh FAIL pada main dan PR dengan 68 diagnostik yang identik; tidak ada diagnostik baru. CI tidak dinyatakan hijau; masalah baseline yang tidak terkait CP tidak diperbaiki dalam PR ini.

## Keputusan

Tidak ada regresi baru pada cakupan CP yang diuji. Integrasi CP layak digabung sebagai data REVIEW/UNVERIFIED, dengan catatan CI keseluruhan masih gagal pada masalah baseline main. Diff PR tidak lagi mencakup lima perubahan tes non-CP dan laporan navigasi di atas. Tidak ada merge otomatis.

## File commit pemurnian scope

Lima tes non-CP dipulihkan ke main, laporan navigasi dihapus, dan laporan CP ini diperbarui: total tujuh file dalam commit pemurnian. Integrasi dan CP safety tidak berubah.
