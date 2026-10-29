# Final audit PR #1 — CP SMP/SMA BSKAP 046/2025

## Basis audit

- Main yang di-fetch: `7dd4c39f107c184719c6069165a265709f66d6f9`.
- Head PR sebelum finalisasi: `25a9b1a26db570f6cba00283ac2d2c9d4782d1c8`.
- Perbandingan menggunakan checkout main terpisah pada SHA yang sama, dependensi dan runtime lokal sama (Windows, Node v24.20.0).
- Main memiliki 62 master CP historis (17 SMP, 18 SMA, 27 SD). Semua record historis tersebut identik sebagai data dengan entri pada PR; tidak ada penghapusan, penggantian redaksi, promosi verifikasi, atau migrasi proyek.
- Diff PR sebelumnya juga memuat perubahan tes navigasi/kalender/annualisasi dari commit 25a9b1a. Perubahan lama tersebut tidak dibatalkan atau diperluas pada finalisasi ini. Tidak ada perubahan produksi ATP, PROTA, PROMES, modul ajar, atau navigasi terhadap main dalam PR ini.

## Temuan CP dan penutupan

1. **Referensi metadata mutable (baru pada PR, diperbaiki).** `sourceReview.grades/pages` adapter menunjuk objek JSON input; repository mengembalikan `sourceReview` master dengan referensi yang sama. Mutasi hasil pencarian dapat mengubah registry dan sumber dalam memori. Tes sebelum perbaikan gagal dengan `Adapter metadata must not alias original JSON`. Adapter kini menyalin array kelas/rentang halaman dan repository mengembalikan metadata yang di-clone. Tes mutasi dan invariansi registry PASS.
2. **Provenance ID elemen saat COPY (celah integrasi baru, diperbaiki).** ID elemen lokal memang dipetakan ulang oleh mekanisme COPY existing. Menempatkan ID PDF hanya pada `CPElem.id` menyebabkan identitas asli tidak tersedia secara eksplisit setelah penyalinan. `sourceElementKey` kini menyimpan ID PDF pada setiap elemen/subelemen; ID lokal tetap mengikuti mekanisme existing. Tidak ada perubahan pada layanan backup/import atau data guru lama.

## Adapter, pemilihan, dan registry

- Tepat 22 SMP Fase D + 62 SMA Fase E/F, 327 elemen dan 30 subelemen. SHA-256 kedua JSON identik dengan lampiran asli; status JSON tetap REVIEW dan seluruh entri impor UNVERIFIED.
- Nama mapel sumber dikenali melalui kode yang berbeda untuk seluruh varian Prakarya/PKWU, bahasa asing dan Sejarah Tingkat Lanjut. Tidak ada alias katalog yang berbenturan. Sistem pemilihan mengenali semua mapel impor.
- Pencarian memerlukan identitas mapel, fase, jenjang, dan tahun ajaran yang cocok. Matriks 2024/2025, 2025/2026, 2026/2027 tidak menghasilkan ambiguitas tak terjelaskan. Kandidat lain yang sengaja dibuat bertabrakan tetap ditolak sebagai AMBIGUOUS.
- CP baru tidak dipakai untuk 2024/2025. Versi historis tetap tersedia sesuai metadata lama. Sumber agama 046/2025 tidak menggantikan sumber agama 2026. Kekosongan agama SMA F pada 2026/2027 tetap UNRESOLVED, tidak diisi data 2025.
- Metadata regulasi 020/2026 tetap memerlukan review naskah keputusan/masa implementasi. Batas tahun ajaran existing dipertahankan, bukan klaim validasi hukum baru.
- 169 label awal SMA dipisahkan hanya ketika nama cocok persis dan diikuti whitespace. Redaksi asli disimpan; induk dengan subelemen tetap hadir dan kontennya memproyeksikan seluruh subelemen.
- Dua pilihan generik lama (`Seni dan Prakarya`, `Matematika (Wajib/Pilihan)`) kini tidak dipaksakan menjadi satu mapel khusus melalui substring. Nilai tersimpan tidak dimodifikasi; guru dapat memilih nama mapel eksplisit yang sudah ditambahkan. Ini perilaku fail-closed yang disengaja, bukan migrasi.

## Keamanan data dan bukti pengujian

| Pemeriksaan | Hasil |
| --- | --- |
| testCP046ReviewIntegration | PASS — 84/327/30, identitas mapel, fase/jenjang/TA, label dan status sumber |
| testCP046SafetyRegression dengan snapshot main | PASS — 62 record historis utuh, metadata tidak beralias, seluruh 84 CP diuji ZIP RESTORE dan COPY |
| testCPSourceSearchRuntimeRegression | PASS |
| testPJOKSDCPResolverRegression | PASS — perilaku CP SD tidak berubah |
| testCPAnalysisSemanticReviewRegression | PASS |
| testMerdekaV5AnnualCPRuntime | PASS |
| testCompleteProjectArchiveRegression | PASS |
| testStorageV5Persistence / testStorageV5Contract | PASS / PASS |

Pada seluruh 84 uji ZIP: teks asli, hierarki, ID sumber, metadata regulasi/halaman, status UNVERIFIED, profil guru, dan CP asal tetap utuh. ID lokal COPY boleh berbeda. Source state tidak berubah. Tidak ada pemanggilan migrasi atau penulisan ke data guru nyata. Belum ada bukti klik UI browser atau validasi akhir redaksi PDF; hasil ini adalah pengujian data/kontrak dan build.

## Klasifikasi CI dan baseline

[CI main pada SHA 7dd4c39](https://github.com/lkpbudibakti-netizen/alco-adm-v-20-finishing/actions/runs/40671332430) FAIL pada tes navigasi semester lama. [CI PR pada SHA 25a9b1a](https://github.com/lkpbudibakti-netizen/alco-adm-v-20-finishing/actions/runs/40814169068) melewati navigasi, lalu FAIL pada `testCanonicalPromesProjection.ts:202`.

Lima tes berikut dijalankan tanpa perubahan pada main dan PR, dengan hasil/diagnostik kegagalan yang sama:

| Pengujian | Main | PR | Klasifikasi |
| --- | --- | --- | --- |
| testCanonicalPromesProjection | FAIL | FAIL | Baseline main, bukan regresi CP |
| testCanonicalAlokasiWaktuDocument | FAIL | FAIL | Baseline main; baris proyeksi undefined/allocatedJP |
| testCanonicalProtaProjection | FAIL | FAIL | Baseline main; assertion readiness proyeksi |
| testAuditNo8LearningPlanRegression | FAIL (2 assertion) | FAIL (2 assertion) | Baseline main |
| testRecoveryM1ModulAjarPrintPrivacyRegression | FAIL | FAIL | Baseline main; build ID/readiness/export fixture |

Tidak ada perubahan tes/generator tersebut. Pengujian baseline tidak boleh disamakan dengan bukti UI atau provider live. TypeScript final: FAIL pada main dan PR dengan 68 diagnostik yang identik; tidak ada diagnostik baru dari perubahan CP. Build produksi final PR: PASS (Vite, PWA, bundel server), dengan warning ukuran chunk.

## Keputusan

Dua celah khusus CP telah ditutup; tidak ada regresi CP tersisa pada matriks dan batas pengujian di atas. Integrasi CP layak dipakai sebagai data REVIEW/UNVERIFIED. CI keseluruhan tetap merah karena baseline main dan tidak dinyatakan PASS. Branch juga masih memuat perubahan tes non-CP dari pekerjaan sebelumnya; finalisasi ini tidak meninjau atau menyetujui ulang cakupan tersebut. Kelayakan integrasi CP tidak berarti semua perubahan PR atau seluruh CI telah tervalidasi. Tidak ada merge otomatis.

## File finalisasi ini

- src/data/curriculum/cp/review046Adapter.ts
- src/services/cpSourceRepository.ts
- src/types/index.ts
- scripts/testCP046SafetyRegression.ts
- package.json (perintah pengujian CP safety)
- docs/cp046-final-audit.md
