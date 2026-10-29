# Audit dan integrasi CP SMP V5 / SMA V6 — BSKAP 046/2025

Branch: `feat/cp-smp-sma-046-2025`. Baseline: `7dd4c39f107c184719c6069165a265709f66d6f9`.

## Audit sebelum perubahan

- `subjects.ts`: enam bahasa asing tergabung dalam BAHASA_ASING_LAIN, delapan varian Prakarya/PKWU dan Sejarah Tingkat Lanjut belum memiliki identitas khusus. Fallback substring dapat memilih mapel berbeda. Ditambahkan 15 kode spesifik, alias bahasa dialihkan ke kode masing-masing; nama/alias harus cocok eksplisit. Pilihan generik lama tetap disimpan, tetapi tidak boleh dipaksa menjadi mapel khusus.
- `cp/index.ts`: resolver sebelumnya benar menolak ambiguitas, tetapi registry historis open-ended berpotensi bentrok dengan impor. Entri lama tetap utuh dan diekspor sebagai HISTORICAL_CP_ENTRIES. Entri impor menyatakan supersedesEntryIds untuk mapel/fase yang sama, hanya berlaku ketika kedua kandidat lolos filter konteks/tahun. Tidak ada fallback first-match atau migrasi proyek.
- `CPManager.tsx`: penggantian CP hanya meminta konfirmasi jika deskripsi umum terisi. Kini rincian elemen juga melindungi data guru. Penerapan sumber memperbarui provenance CP; ID CP proyek tetap sama. Kode UI tetap E1/E2, nomor PDF berada di sourceNumber.
- `cpSourceRepository`: ID elemen sebelumnya dibangkitkan ulang dan struktur hanya datar. Adapter menyimpan ID sumber, teks asli, hierarki, nomor asli, metadata versi dan rentang halaman; content induk memproyeksikan subelemen agar analisis/ekspor datar tetap membaca seluruh isinya. Tidak menambah deskripsi umum sintetis. Hanya awalan label persis diikuti whitespace yang dipisahkan; tidak ada perubahan substansi atau JSON asli.

## Batas regulasi agama

Siaran pers resmi 23 Juni 2026 membuktikan adanya Keputusan BKPDM 020/2026 dan bahwa perubahannya khusus agama:
https://www.kemendikdasmen.go.id/download/file/1933

Nama badan pada metadata registry diperbaiki menjadi Badan Kebijakan Pendidikan Dasar dan Menengah. URL tersebut adalah bukti siaran pers, bukan naskah keputusan. Tanggal legal dan ketentuan implementasi TA belum dibuktikan dari naskah lengkap. Pemisahan TA 2026/2027 yang sudah ada dipertahankan dan ditandai REVIEW; data agama 2026 tidak diganti dengan 046/2025. Registry lama menyediakan agama SMP D dan SMA E 2026; agama SMA F 2026/2027 tetap UNRESOLVED karena tidak ada sumber 2026 yang dapat dipakai. Tidak menyalin agama 2025 untuk menutup kekosongan ini.

Semua 84 entri impor UNVERIFIED. JSON tetap REVIEW dan byte-identik dengan lampiran, diverifikasi SHA-256 dalam tes. Tahun 2024/2025 hanya memakai sumber historis jika tersedia; ketiadaan sumber historis tetap UNRESOLVED.

## Pengujian

| Pengujian | Hasil |
| --- | --- |
| testCP046ReviewIntegration | PASS: 22 SMP + 62 SMA, 327 elemen, 30 subelemen; ID, kode mapel unik, pilihan mapel, fase/jenjang, TA 2024/2025–2026/2027, label, kontrak E1, status REVIEW, sumber byte-identik, ambiguitas disengaja ditolak |
| Backup–restore CP impor melalui ZIP proyek aktual | PASS: teks/ID induk dan anak, metadata, profil guru tetap utuh; state sumber tidak berubah |
| testCPSourceSearchRuntimeRegression | PASS |
| testPJOKSDCPResolverRegression | PASS |
| testCPAnalysisSemanticReviewRegression | PASS |
| testP0CAtpSemanticFidelityRegression | PASS |
| testCompleteProjectArchiveRegression | PASS |
| testStorageV5Contract / testStorageV5Persistence | PASS / PASS |
| testCurriculumMaster | FAIL sama pada baseline: assertion CP historis SD PJOK 2024/2025 |
| testWorkflowDependencyRegression | FAIL sama pada baseline: missing CP analysis seharusnya memblokir TP |
| testMerdekaCPAnalysisIntegrity | FAIL sama pada baseline: assertion statis navigation handleSave/onNextStep |
| testAudit2026RegulatoryCompatibility | FAIL sama pada baseline: 84 PASS, 6 FAIL pada heading isi generator modul ajar |
| TypeScript seluruh repository | FAIL: 68 diagnostik identik dengan checkout baseline; termasuk fixture lama dan AdminDocsExport memakai properti projection yang tidak tersedia |

Build produksi PASS (Vite, PWA dan bundel server); terdapat peringatan ukuran chunk >500 kB. Tidak ada merge otomatis, perubahan layanan storage/backup, atau migrasi proyek lama. Pengujian otomatis membuktikan data/proyeksi dan kontrak pemilihan; interaksi browser, tata letak DOCX/PDF hasil impor, serta validasi akhir redaksi terhadap PDF belum diuji secara visual. Integrasi belum dapat disebut seluruh pemeriksaan hijau karena kegagalan baseline dan review regulasi tersebut.

## File berubah

- src/data/curriculum/cp/sources/.gitattributes (menjaga byte sumber terhadap konversi line ending Git)
- package.json
- scripts/testCP046ReviewIntegration.ts
- src/components/CPManager.tsx
- src/data/curriculum/subjects.ts
- src/data/curriculum/regulations.ts
- src/data/curriculum/cp/types.ts
- src/data/curriculum/cp/index.ts
- src/data/curriculum/cp/smp.ts
- src/data/curriculum/cp/sma.ts
- src/data/curriculum/cp/review046Adapter.ts
- src/data/curriculum/cp/sources/cp-smp-bskap-046-2025-v5-review.json
- src/data/curriculum/cp/sources/cp-sma-bskap-046-2025-v6-review.json
- src/data/curriculumDefaults.ts
- src/services/cpSourceRepository.ts
- src/types/index.ts
- docs/cp046-review-integration.md
