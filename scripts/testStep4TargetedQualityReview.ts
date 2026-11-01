import assert from 'node:assert/strict';
import type { CPElem, CPAnalysisItem, CPData } from '../src/types';
import { understandingIssue, validateAnalysisAI, validateStep4Understanding, stemIndonesianWord } from '../src/services/cpAnalysisAIContract';
import { inspectCP4Draft, classifyCP4Issue } from '../src/services/cpAnalysisDraft';

console.log('=== TEST SUITE: STEP 4 AI ENGINE TARGETED QUALITY REVIEW & GROUNDING ===\n');

// 1. Test Indonesian Stemming
console.log('1. Menguji fungsi stemIndonesianWord()...');
assert.equal(stemIndonesianWord('memahami'), 'paham');
assert.equal(stemIndonesianWord('mempelajari'), 'ajar');
assert.equal(stemIndonesianWord('membilang'), 'bilang');
assert.equal(stemIndonesianWord('penjumlahan'), 'jumlah');
assert.equal(stemIndonesianWord('pengurangan'), 'kurang');
assert.equal(stemIndonesianWord('ketaatan'), 'taat');
assert.equal(stemIndonesianWord('ketakwaan'), 'takwa');
assert.equal(stemIndonesianWord('beribadah'), 'ibadah');
console.log('  ✓ Stemming bahasa Indonesia berfungsi akurat.');

// 2. Real Case Test: PAI dan Budi Pekerti, Fase A, Kelas 2 (5 Elemen, 12 Baris)
console.log('\n2. Menguji Kasus Nyata: PAI & Budi Pekerti Fase A (5 Elemen, 12 Baris)...');
const paiElements: CPElem[] = [
  {
    id: 'el-quran',
    name: "Al-Qur'an dan Hadis",
    content: "Peserta didik mampu mengenal huruf hijaiah dan harakatnya, huruf hijaiah bersambung, dan kemampuan membaca surah-surah pendek Al-Qur’an dengan baik."
  },
  {
    id: 'el-akidah',
    name: 'Akidah',
    content: "Peserta didik mampu mengenal rukun iman kepada Allah, para malaikat, dan kitab-kitab Allah sebagai landasan keyakinan."
  },
  {
    id: 'el-akhlak',
    name: 'Akhlak',
    content: "Peserta didik mampu membiasakan diri mengucapkan kalimat tayibah dan menerapkan akhlak terpuji kepada orang tua, guru, dan teman dalam kehidupan sehari-hari."
  },
  {
    id: 'el-fiqih',
    name: 'Fikih',
    content: "Peserta didik mampu mengenal rukun Islam dan melafalkan dua kalimat syahadat serta mempraktikkan tata cara wudu dan salat fardu."
  },
  {
    id: 'el-sejarah',
    name: 'Sejarah Peradaban Islam',
    content: "Peserta didik mampu menceritakan kisah keteladanan Nabi Muhammad saw. pada masa kanak-kanak dan remaja."
  }
];

const paiItems: CPAnalysisItem[] = [
  // Quran (3 baris)
  {
    id: 'row-q1',
    elementId: 'el-quran',
    elementName: "Al-Qur'an dan Hadis",
    cpText: paiElements[0].content,
    cpCompetence: 'mengenal dan melafalkan',
    materialScope: 'huruf hijaiah dan harakat',
    meaningfulUnderstanding: 'Pengenalan huruf hijaiah berharakat sebagai dasar membaca Al-Qur’an dengan tartil dan benar.',
    suggestedTp: 'Peserta didik mampu mengenal huruf hijaiah berharakat secara tepat.',
    order: 1
  },
  {
    id: 'row-q2',
    elementId: 'el-quran',
    elementName: "Al-Qur'an dan Hadis",
    cpText: paiElements[0].content,
    cpCompetence: 'mengidentifikasi',
    materialScope: 'huruf hijaiah bersambung',
    meaningfulUnderstanding: 'Keterampilan membaca huruf bersambung mempermudah pelafalan ayat suci Al-Qur’an.',
    suggestedTp: 'Peserta didik mampu membaca huruf hijaiah bersambung dengan lancar.',
    order: 2
  },
  {
    id: 'row-q3',
    elementId: 'el-quran',
    elementName: "Al-Qur'an dan Hadis",
    cpText: paiElements[0].content,
    cpCompetence: 'membaca dan menghafal',
    materialScope: 'surah-surah pendek pilihan',
    meaningfulUnderstanding: 'Pembiasaan melafalkan surah pendek dalam ibadah harian untuk menumbuhkan kecintaan kepada Al-Qur’an.',
    suggestedTp: 'Peserta didik mampu melafalkan surah pendek pilihan dengan fasih.',
    order: 3
  },
  // Akidah (2 baris)
  {
    id: 'row-ak1',
    elementId: 'el-akidah',
    elementName: 'Akidah',
    cpText: paiElements[1].content,
    cpCompetence: 'mengenal dan meyakini',
    materialScope: 'rukun iman kepada Allah dan malaikat',
    meaningfulUnderstanding: 'Menumbuhkan iman dan ketakwaan kepada Allah serta meyakini keberadaan malaikat dalam pengawasan perbuatan.',
    suggestedTp: 'Peserta didik mampu menyebutkan rukun iman dengan penuh keyakinan.',
    order: 4
  },
  {
    id: 'row-ak2',
    elementId: 'el-akidah',
    elementName: 'Akidah',
    cpText: paiElements[1].content,
    cpCompetence: 'memahami',
    materialScope: 'kitab-kitab suci Allah',
    meaningfulUnderstanding: 'Pemahaman bahwa kitab suci Allah menjadi pedoman hidup keselamatan manusia di dunia dan akhirat.',
    suggestedTp: 'Peserta didik mampu mengenal kitab-kitab suci yang diturunkan Allah.',
    order: 5
  },
  // Akhlak (3 baris)
  {
    id: 'row-akh1',
    elementId: 'el-akhlak',
    elementName: 'Akhlak',
    cpText: paiElements[2].content,
    cpCompetence: 'membiasakan',
    materialScope: 'kalimat tayibah',
    meaningfulUnderstanding: 'Membiasakan lisan mengucap pujian kepada Allah dalam merespons kejadian sehari-hari.',
    suggestedTp: 'Peserta didik terbiasa mengucap kalimat tayibah secara santun.',
    order: 6
  },
  {
    id: 'row-akh2',
    elementId: 'el-akhlak',
    elementName: 'Akhlak',
    cpText: paiElements[2].content,
    cpCompetence: 'menunjukkan dan mempraktikkan',
    materialScope: 'akhlak terpuji kepada orang tua dan guru',
    meaningfulUnderstanding: 'Wujud hormat dan ketaatan kepada orang tua dan guru sebagai bentuk akhlak mulia.',
    suggestedTp: 'Peserta didik mampu menunjukkan perilaku hormat kepada orang tua dan guru.',
    order: 7
  },
  {
    id: 'row-akh3',
    elementId: 'el-akhlak',
    elementName: 'Akhlak',
    cpText: paiElements[2].content,
    cpCompetence: 'menerapkan',
    materialScope: 'sikap ramah dan kasih sayang kepada teman',
    meaningfulUnderstanding: 'Menjalin kerukunan dan saling menyayangi sesama teman dalam pergaulan di sekolah dan rumah.',
    suggestedTp: 'Peserta didik mampu bersikap ramah dan tolong-menolong dengan teman.',
    order: 8
  },
  // Fiqih (2 baris)
  {
    id: 'row-f1',
    elementId: 'el-fiqih',
    elementName: 'Fikih',
    cpText: paiElements[3].content,
    cpCompetence: 'mengenal dan melafalkan',
    materialScope: 'rukun Islam dan dua kalimat syahadat',
    meaningfulUnderstanding: 'Pengakuan keesaan Allah dan kerasulan Nabi Muhammad saw. sebagai fondasi utama beragama Islam.',
    suggestedTp: 'Peserta didik mampu melafalkan syahadatain dengan benar.',
    order: 9
  },
  {
    id: 'row-f2',
    elementId: 'el-fiqih',
    elementName: 'Fikih',
    cpText: paiElements[3].content,
    cpCompetence: 'mempraktikkan',
    materialScope: 'tata cara bersuci (wudu) dan salat fardu',
    meaningfulUnderstanding: 'Pelaksanaan wudu dan salat fardu dengan tertib sebagai bentuk ketaatan beribadah kepada Allah.',
    suggestedTp: 'Peserta didik mampu memperagakan gerakan wudu dan salat dengan tertib.',
    order: 10
  },
  // Sejarah (2 baris)
  {
    id: 'row-s1',
    elementId: 'el-sejarah',
    elementName: 'Sejarah Peradaban Islam',
    cpText: paiElements[4].content,
    cpCompetence: 'menceritakan',
    materialScope: 'masa kanak-kanak Nabi Muhammad saw.',
    meaningfulUnderstanding: 'Meneladani sifat jujur dan kesabaran Nabi Muhammad saw. sejak usia dini dalam kehidupan.',
    suggestedTp: 'Peserta didik mampu menceritakan kisah masa kecil Nabi Muhammad saw.',
    order: 11
  },
  {
    id: 'row-s2',
    elementId: 'el-sejarah',
    elementName: 'Sejarah Peradaban Islam',
    cpText: paiElements[4].content,
    cpCompetence: 'meneladani',
    materialScope: 'masa remaja Nabi Muhammad saw. dan gelar Al-Amin',
    meaningfulUnderstanding: 'Menumbuhkan sikap amanah dan tanggung jawab terpercaya sebagaimana gelar Al-Amin Rasulullah.',
    suggestedTp: 'Peserta didik mampu mencontoh kejujuran Nabi Muhammad saw. dalam berinteraksi.',
    order: 12
  }
];

// Periksa setiap baris PAI menggunakan understandingIssue
let paiReviewCount = 0;
for (const item of paiItems) {
  const el = paiElements.find(e => e.id === item.elementId)!;
  const issue = understandingIssue(item.meaningfulUnderstanding, el);
  if (issue) {
    console.error(`  FAIL: Row ${item.id} (${item.elementName}) mendapat issue ${issue}: "${item.meaningfulUnderstanding}"`);
    paiReviewCount++;
  }
}
assert.equal(paiReviewCount, 0, `Ditemukan ${paiReviewCount} false positive pada 12 baris PAI Fase A! Seharusnya 0.`);
console.log('  ✓ Seluruh 12 baris PAI Fase A lolos validasi tanpa false positive MU_GROUNDING_REVIEW.');

// 3. Test Matematika Fase A (Parafrasa Konseptual)
console.log('\n3. Menguji Kasus Matematika Fase A (Parafrasa Konseptual)...');
const mathElement: CPElem = {
  id: 'el-math-bilangan',
  name: 'Bilangan',
  content: 'Peserta didik menunjukkan pemahaman dan intuisi bilangan (number sense) pada bilangan cacah sampai 100, mereka dapat membaca, menulis, menentukan nilai tempat, membandingkan, mengurutkan, serta melakukan komposisi dan dekomposisi bilangan.'
};

const validMathUnderstanding = 'Penerapan konsep membilang dan mengelompokkan benda konkret dalam konteks kehidupan sehari-hari di rumah dan sekolah.';
const mathIssue = understandingIssue(validMathUnderstanding, mathElement);
assert.equal(mathIssue, null, `Matematika dengan parafrasa valid seharusnya null, tetapi mendapat ${mathIssue}`);
console.log('  ✓ Parafrasa konseptual Matematika Fase A lolos validasi.');

// 4. Test Kontrol: Materi Asing / Alien TETAP Mendapat MU_GROUNDING_REVIEW
console.log('\n4. Menguji Deteksi Kontrol: Materi Asing / Alien...');
const alienUnderstanding = 'Memahami rotasi orbit planet dan gravitasi galaksi dalam tata surya.';
const alienIssue = understandingIssue(alienUnderstanding, mathElement);
assert.equal(alienIssue, 'MU_GROUNDING_REVIEW', `Materi alien astronomi pada CP Matematika Bilangan harus memicu MU_GROUNDING_REVIEW, tetapi mendapat ${alienIssue}`);
console.log('  ✓ Materi asing yang tidak berdasar pada CP berhasil terdeteksi sebagai MU_GROUNDING_REVIEW.');

// 5. Test Validasi Struktur BLOCKING vs REVIEW
console.log('\n5. Menguji Pemisahan BLOCKING vs REVIEW...');
const blockingDraftItems: CPAnalysisItem[] = [
  {
    id: 'row-empty-mu',
    elementId: 'el-math-bilangan',
    elementName: 'Bilangan',
    cpText: mathElement.content,
    cpCompetence: 'membaca',
    materialScope: 'bilangan cacah',
    meaningfulUnderstanding: '', // KOSONG -> BLOCKING
    suggestedTp: 'Siswa mampu membaca bilangan.',
    order: 1
  },
  {
    id: 'row-invalid-mu',
    elementId: 'el-math-bilangan',
    elementName: 'Bilangan',
    cpText: mathElement.content,
    cpCompetence: 'menulis',
    materialScope: 'bilangan cacah',
    meaningfulUnderstanding: '-', // PLACEHOLDER INVALID -> BLOCKING
    suggestedTp: 'Siswa mampu menulis bilangan.',
    order: 2
  },
  {
    id: 'row-bad-ref',
    elementId: 'el-non-existent', // ID ELEMEN TIDAK ADA -> BLOCKING
    elementName: 'Unknown',
    cpText: '',
    cpCompetence: 'menghitung',
    materialScope: 'bilangan cacah',
    meaningfulUnderstanding: 'Pemahaman bermakna valid tetapi elemen salah.',
    suggestedTp: 'Siswa mampu berhitung.',
    order: 3
  }
];

const step4BlockingIssues = validateStep4Understanding(blockingDraftItems, [mathElement]);
assert.equal(step4BlockingIssues.length, 3);
assert.equal(step4BlockingIssues[0].code, 'MU_EMPTY');
assert.equal(step4BlockingIssues[1].code, 'MU_INVALID');
assert.equal(step4BlockingIssues[2].code, 'CANONICAL_REFERENCE_INVALID');
console.log('  ✓ Data kosong, placeholder invalid, dan ID non-kanonikal terbukti 100% BLOCKING.');

// 6. Test Konfirmasi Spesifik Per Baris & Invalidasi Otomatis
console.log('\n6. Menguji Alur Konfirmasi Spesifik Per Baris & Invalidasi Otomatis...');
const itemWithAlien1: CPAnalysisItem = {
  id: 'item-alien-1',
  elementId: 'el-math-bilangan',
  elementName: 'Bilangan',
  cpText: mathElement.content,
  cpCompetence: 'menghitung',
  materialScope: 'bilangan cacah',
  meaningfulUnderstanding: 'Pengenalan bilangan lewat penghitungan orbit satelit luar angkasa.',
  suggestedTp: 'Siswa mampu menghitung satelit.',
  order: 1
};

const itemWithAlien2: CPAnalysisItem = {
  id: 'item-alien-2',
  elementId: 'el-math-bilangan',
  elementName: 'Bilangan',
  cpText: mathElement.content,
  cpCompetence: 'membandingkan',
  materialScope: 'bilangan cacah',
  meaningfulUnderstanding: 'Perbandingan kecepatan roket antariksa dan pesawat supersonik.',
  suggestedTp: 'Siswa mampu membandingkan kecepatan.',
  order: 2
};

// Sebelum konfirmasi: keduanya mendapat MU_GROUNDING_REVIEW
assert.equal(understandingIssue(itemWithAlien1.meaningfulUnderstanding, mathElement), 'MU_GROUNDING_REVIEW');
assert.equal(understandingIssue(itemWithAlien2.meaningfulUnderstanding, mathElement), 'MU_GROUNDING_REVIEW');

// Guru mengonfirmasi HANYA item-alien-1
itemWithAlien1.reviewConfirmed = true;
itemWithAlien1.reviewedText = itemWithAlien1.meaningfulUnderstanding.trim();
itemWithAlien1.reviewedCpText = mathElement.content.trim();

// Evaluasi ulang:
const issue1Confirmed = understandingIssue(itemWithAlien1.meaningfulUnderstanding, mathElement, {
  reviewConfirmed: itemWithAlien1.reviewConfirmed,
  reviewedText: itemWithAlien1.reviewedText,
  reviewedCpText: itemWithAlien1.reviewedCpText
});
const issue2Unconfirmed = understandingIssue(itemWithAlien2.meaningfulUnderstanding, mathElement, {
  reviewConfirmed: itemWithAlien2.reviewConfirmed,
  reviewedText: itemWithAlien2.reviewedText,
  reviewedCpText: itemWithAlien2.reviewedCpText
});

assert.equal(issue1Confirmed, null, 'Baris yang sudah dikonfirmasi guru harus menghasilkan null issue (selesai)');
assert.equal(issue2Unconfirmed, 'MU_GROUNDING_REVIEW', 'Baris yang belum dikonfirmasi tetap harus memicu MU_GROUNDING_REVIEW (tidak global)');
console.log('  ✓ Konfirmasi baris spesifik per-ID terbukti dan tidak mempengaruhi baris lain.');

// Uji pembatalan konfirmasi saat teks diubah
console.log('\n7. Menguji Pembatalan Otomatis Konfirmasi Saat Guru Mengedit Teks...');
itemWithAlien1.meaningfulUnderstanding = 'Teks diubah menjadi deskripsi roket baru yang berbeda.';
const issue1AfterEdit = understandingIssue(itemWithAlien1.meaningfulUnderstanding, mathElement, {
  reviewConfirmed: itemWithAlien1.reviewConfirmed,
  reviewedText: itemWithAlien1.reviewedText, // Nilai lama
  reviewedCpText: itemWithAlien1.reviewedCpText
});
assert.equal(issue1AfterEdit, 'MU_GROUNDING_REVIEW', 'Perubahan teks harus otomatis membatalkan konfirmasi guru dan mengembalikan issue');
console.log('  ✓ Modifikasi substansi otomatis membatalkan konfirmasi sebelumnya.');

// 8. Test inspectCP4Draft dengan Metadata Konfirmasi
console.log('\n8. Menguji inspectCP4Draft()...');
const draftIssues = inspectCP4Draft([itemWithAlien1, itemWithAlien2], [mathElement]);
assert.ok(draftIssues.some(i => i.itemId === 'item-alien-1' && i.code === 'MU_GROUNDING_REVIEW'));
assert.ok(draftIssues.some(i => i.itemId === 'item-alien-2' && i.code === 'MU_GROUNDING_REVIEW'));
console.log('  ✓ inspectCP4Draft mendeteksi temuan kualitas sesuai klasifikasi.');

console.log('\n=== SELURUH PENGUJIAN TARGETED QUALITY REVIEW PASS 100% ===');
