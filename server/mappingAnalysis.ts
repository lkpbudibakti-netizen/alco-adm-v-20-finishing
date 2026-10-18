import { analyzeBabFirstMapping } from './mappingBabFirstAnalysis';
import { TPData, ATPData, ATPUnitMappingData } from '../src/types';

export interface MappingAnalysisResult {
  summary: {
    totalAtp: number;
    mappedAtp: number;
    unmappedAtp: number;
    alignedAtp: number;
    reviewAtp: number;
    alignableMaterials: number;
    missingMaterialSuggestions: number;
    manualMaterialReview: number;
  };

  atpFindings: Array<{
    id: string;
    atpItemId: string;
    status: 'ALIGNED' | 'UNMAPPED' | 'REVIEW';

    currentUnitId?: string;
    suggestedUnitId?: string;
    suggestedMaterialId?: string;

    supportingTpIds: string[];

    strength?: 'STRONG' | 'MODERATE' | 'LOW';

    reason: string;

    action?: {
      type: 'ASSIGN_ATP_TO_UNIT';
      atpItemId: string;
      targetUnitId: string;
      linkedTpIds: string[];
      targetMaterialId?: string;
    };
  }>;

  materialFindings: Array<{
    id: string;

    status: 'SUPPORTED' | 'ALIGNABLE' | 'MISSING_MATERIAL' | 'MANUAL_REVIEW';

    unitId: string;
    materialId?: string;

    suggestedTitle?: string;

    supportingTpIds: string[];
    supportingAtpItemIds: string[];

    strength?: 'STRONG' | 'MODERATE' | 'LOW';

    reason: string;

    action?: {
      type: 'ADD_MATERIAL_TO_UNIT';
      targetUnitId: string;
      title: string;
      linkedTpIds: string[];
      linkedAtpItemIds: string[];
    } | {
      type: 'ALIGN_EXISTING_MATERIAL';
      targetUnitId: string;
      targetMaterialId: string;
      linkedAtpItemIds: string[];
      linkedTpIds: string[];
    } | {
      type: 'RECOVER_ATP_LINEAGE';
      targetUnitId: string;
      targetMaterialId?: string;
      removeAtpItemIds: string[];
      linkedAtpItemIds: string[];
      linkedTpIds: string[];
    };
  }>;
}

export interface AnalyzeATPUnitMappingServerParams {
  subject?: string;
  grade?: string;
  phase?: string;
  tpData: TPData;
  atpData: ATPData;
  currentMapping: ATPUnitMappingData;
}

function getCanonicalTpsForAtpItem(atpItem: any): string[] {
  if (!atpItem) return [];
  if (Array.isArray(atpItem.linkedTpIds) && atpItem.linkedTpIds.length > 0) {
    return atpItem.linkedTpIds;
  }
  if (atpItem.tpId) {
    return [atpItem.tpId];
  }
  return [];
}

export function buildMappingAnalysisPrompt(params: AnalyzeATPUnitMappingServerParams): string {
  const { subject, grade, phase, tpData, atpData, currentMapping } = params;

  // Build TP Map
  const tpMap = new Map<string, any>();
  (tpData.items || []).forEach((t) => {
    tpMap.set(t.id, t);
  });

  // Prepare ATP context using canonical linkedTpIds
  const atpContext = (atpData.items || []).map((item, idx) => {
    const rawLinked = getCanonicalTpsForAtpItem(item);

    const linkedTps = rawLinked.map((id) => {
      const t = tpMap.get(id);
      return {
        tpId: id,
        code: t?.code || 'TP',
        statement: t?.statement || '',
        contentScope: t?.contentScope || '',
        competence: t?.competence || '',
      };
    });

    return {
      atpItemId: item.id,
      stepNumber: item.stepNumber,
      focus: item.focus || '',
      linkedTps,
    };
  });

  // Prepare Teacher's Manual Units & Materials
  const unitsContext = (currentMapping.units || []).map((u, idx) => {
    return {
      unitId: u.id,
      order: u.order,
      title: u.title,
      assignedAtpItemIds: u.linkedAtpItemIds || [],
      assignedTpIds: u.linkedTpIds || [],
      missingMaterialCoverage: {
        tpIds: (u.linkedTpIds || []).filter(id => !(u.materials || []).some(m => (m.linkedTpIds || []).includes(id))),
        atpItemIds: (u.linkedAtpItemIds || []).filter(id => !(u.materials || []).some(m => (m.linkedAtpItemIds || []).includes(id))),
      },
      materials: (u.materials || []).map((m, mIdx) => ({
        materialId: m.id,
        order: m.order,
        title: m.title || '',
        linkedAtpItemIds: m.linkedAtpItemIds || [],
        linkedTpIds: m.linkedTpIds || [],
      })),
    };
  });

  return `Anda adalah Asisten Pedagogis Ahli Kurikulum Merdeka.
TUGAS ANDA ADALAH MELAKUKAN ANALISIS PEMETAAN (READ-ONLY ANALYSIS) antara Bab & Lingkup Materi manual yang telah disusun oleh guru dengan Capaian TP & Alur Tujuan Pembelajaran (ATP).

=== PRINSIP UTAMA & BATASAN KETAT ===
1. STRUKTUR BAB & LINGKUP MATERI GURU ADALAH AUTHORITY UTAMA (berasal dari arahan sekolah/Korwil/guru).
2. ANDA TIDAK BOLEH mengubah jumlah, ID, judul dan unit.order Bab atau ATP stepNumber, focus dan linkedTpIds. Jangan menghasilkan pembalikan progresi pedagogis yang seluruhnya menempatkan ATP akhir sebelum ATP awal tanpa overlap. ANDA TIDAK BOLEH:
   - Menghapus Bab
   - Mengubah judul Bab
   - Menghapus Lingkup Materi
   - Mengubah judul Lingkup Materi manual
   - Membuat Bab baru (ID Bab fiktif dilarang)
   - Membuat TP fiktif atau ATP fiktif
   - Mengubah urutan langkah ATP
3. ARAH ANALISIS WAJIB: Bab/Materi → pilih subset TP relevan → ATP induk diturunkan deterministik oleh server. Urutan unit.order adalah penyajian Bab; stepNumber adalah progresi ATP, bukan nomor Bab. Jangan menormalisasi Bab mengikuti ATP. ATP yang sudah berada di satu atau lebih Bab tetap boleh direkomendasikan ke Bab lain jika evidence semantic kuat. Jangan memindahkan ATP. ASSIGN_ATP_TO_UNIT wajib membawa linkedTpIds berupa subset TP canonical yang relevan terhadap target Bab. Jika subset tidak dapat ditentukan dengan yakin, REVIEW tanpa action.
   Format action ASSIGN_ATP_TO_UNIT:
   {
     "type": "ASSIGN_ATP_TO_UNIT",
     "atpItemId": "string",
     "targetUnitId": "string",
     "linkedTpIds": ["string"],
     "targetMaterialId": "string (opsional)"
   }
4. ANALISIS SEMANTIK KONSERVATIF:
   - Jangan menyarankan Bab tanpa bukti keselarasan yang kuat/jelas.
   - Jika subset TP pada materi ambigu, atau tidak ada bukti materi yang cukup, beri status "REVIEW" tanpa action otomatis.
   - Jangan otomatis menandai ATP existing sebagai "ALIGNED" jika tidak ada keselarasan yang cukup jelas.

=== KETENTUAN KHUSUS UNTUK LINGKUP MATERI MANUAL (ALIGN_EXISTING_MATERIAL) ===
AUDIT CAKUPAN PER BAB: seluruh assignedTpIds dan assignedAtpItemIds Bab harus terwakili oleh gabungan lineage Lingkup Materi setelah semua rekomendasi diterapkan. Satu ATP dapat memiliki beberapa TP; jangan hanya memilih TP pertama. Rekomendasikan seluruh subset TP yang relevan secara pedagogis pada materi existing. Pertahankan ID, judul, jumlah dan urutan Bab guru. Jika tidak ada materi yang relevan untuk TP/ATP tertentu, nyatakan ID yang belum tercakup dan alasan MANUAL_REVIEW; jangan menempelkan ID atau mengklaim lengkap.
WAJIB (C1):
- materialFindings harus memuat TEPAT SATU finding untuk SETIAP existing Material.
- Gunakan materialId dan unitId persis dari CURRENT LOCAL DRAFT.
- Jangan melewatkan Material.
- Jangan membuat dua finding untuk Material yang sama.
- unitId pada finding HARUS parent Unit asli dari materialId tersebut.

Untuk setiap Lingkup Materi manual yang ada pada Bab:
- Jika materi sudah selaras secara lengkap dan benar dengan TP/ATP (silsilah lengkap dan valid terhadap Bab induk): status = "SUPPORTED".
- Jika materi manual memiliki silsilah (lineage) kosong atau belum lengkap, tetapi ada keselarasan semantik yang kuat dengan TP/ATP canonical tertentu:
  * Cari TP canonical yang relevan dari substansi materi pada Bab ini, termasuk TP yang belum tertaut pada Bab. Server menurunkan ATP induk secara deterministic dan memvalidasi seluruh bundle Bab + Materi + TP + ATP. Jika materi MANUAL_REVIEW, jangan usulkan action ATP otomatis yang bergantung padanya.
  * Berikan status "ALIGNABLE".
  * Berikan action type "ALIGN_EXISTING_MATERIAL".
  * Material harus memilih SUBSET TP yang benar-benar relevan dengan Lingkup Materi tersebut. JANGAN otomatis memasukkan semua TP dari ATP jika ada TP yang tidak relevan.
  * Format action:
    {
      "type": "ALIGN_EXISTING_MATERIAL",
      "targetUnitId": "id bab tempat materi berada",
      "targetMaterialId": "id materi manual tersebut",
      "linkedAtpItemIds": ["id ATP canonical"],
      "linkedTpIds": ["subset id TP canonical yang relevan"]
    }
- Jika keselarasan ambigu, lemah, atau tidak ditemukan: status = "MANUAL_REVIEW" tanpa memberikan action.

=== DATA PEMBELAJARAN ===
Mata Pelajaran: ${subject || 'Mata Pelajaran'}
Kelas / Fase: ${grade || ''} (${phase || ''})

=== STRUKTUR BAB & MATERI MANUAL GURU (CURRENT LOCAL DRAFT) ===
${JSON.stringify(unitsContext, null, 2)}

=== DAFTAR ALUR TUJUAN PEMBELAJARAN (CANONICAL ATP & TP) ===
${JSON.stringify(atpContext, null, 2)}

=== INSTRUKSI ANALISIS ===
1. BAB/MATERI TERLEBIH DAHULU (materialFindings):
   - Iterasi setiap Bab guru dalam unit.order, lalu semua Lingkup Materinya.
   - Pilih subset ID TP canonical yang benar-benar relevan dengan substansi materi. Jangan mulai dari ATP untuk membentuk Bab.
   - Bab dengan materi existing: hanya usulkan ALIGN_EXISTING_MATERIAL untuk ID materi dan Bab induk asli; pertahankan judul dan urutannya.
   - Bab tanpa materi: hanya usulkan ADD_MATERIAL_TO_UNIT jika substansi judul Bab mendukung TP yang dipilih. Judul materi harus spesifik dan relevan; jangan membuat materi dari fokus ATP semata.
   - Bila bukti kurang atau subset TP ambigu, MANUAL_REVIEW tanpa action. Jangan tutup gap dengan menempelkan seluruh TP ATP.
   - linkedAtpItemIds bukan authority dari AI: server menghitung ulang induk ATP dari TP canonical pilihan.
2. AUDIT CAKUPAN ATP (atpFindings), SETELAH analisis Bab/Materi:
   - Tinjau gabungan seluruh Bab terhadap seluruh ATP/TP canonical; laporkan ALIGNED/UNMAPPED/REVIEW.
   - Satu ATP boleh muncul pada banyak Bab dengan subset TP berbeda. Jangan membatasi satu target Bab per ATP.
   - ASSIGN_ATP_TO_UNIT otomatis hanya dibentuk server dari bukti materi; action materi pasangan wajib ada dalam bundle yang sama jika materi pendukung belum lengkap.
   - Jangan klaim action ATP safe bila materi pendukung masih MANUAL_REVIEW.
   - unit.order dan ATP stepNumber tidak harus sama. Jangan usulkan pembalikan progresi yang menempatkan seluruh ATP tahap akhir sebelum tahap awal tanpa overlap pedagogis.
   - Seluruh bundle Bab + Materi + TP + ATP divalidasi atomic. Saran yang tidak lengkap tetap tinjauan manual dan tidak diterapkan parsial.

Kembalikan respon DALAM FORMAT JSON VALID yang mematuhi skema berikut:
{
  "summary": {
    "totalAtp": number,
    "mappedAtp": number,
    "unmappedAtp": number,
    "alignedAtp": number,
    "reviewAtp": number,
    "missingMaterialSuggestions": number,
    "manualMaterialReview": number
  },
  "atpFindings": [
    {
      "id": "finding-atp-1",
      "atpItemId": "string",
      "status": "ALIGNED" | "UNMAPPED" | "REVIEW",
      "currentUnitId": "string (opsional)",
      "suggestedUnitId": "string (opsional)",
      "suggestedMaterialId": "string (opsional)",
      "supportingTpIds": ["string"],
      "strength": "STRONG" | "MODERATE" | "LOW",
      "reason": "string",
      "action": {
        "type": "ASSIGN_ATP_TO_UNIT",
        "atpItemId": "string",
        "targetUnitId": "string",
        "linkedTpIds": ["string"],
        "targetMaterialId": "string (opsional)"
      }
    }
  ],
  "materialFindings": [
    {
      "id": "finding-mat-1",
      "status": "SUPPORTED" | "ALIGNABLE" | "MISSING_MATERIAL" | "MANUAL_REVIEW",
      "unitId": "string",
      "materialId": "string (opsional)",
      "suggestedTitle": "string (opsional)",
      "supportingTpIds": ["string"],
      "supportingAtpItemIds": ["string"],
      "strength": "STRONG" | "MODERATE" | "LOW",
      "reason": "string",
      "action": {
        "type": "ADD_MATERIAL_TO_UNIT",
        "targetUnitId": "string",
        "title": "string",
        "linkedTpIds": ["string"],
        "linkedAtpItemIds": ["string"]
      } | {
        "type": "ALIGN_EXISTING_MATERIAL",
        "targetUnitId": "string",
        "targetMaterialId": "string",
        "linkedAtpItemIds": ["string"],
        "linkedTpIds": ["string"]
      }
    }
  ]
}`;
}

export function sanitizeMappingAnalysisResult(rawResult: any, params: AnalyzeATPUnitMappingServerParams): MappingAnalysisResult {
  return analyzeBabFirstMapping(rawResult, params);
}

export function fallbackAnalyzeMapping(params: AnalyzeATPUnitMappingServerParams): MappingAnalysisResult {
  return analyzeBabFirstMapping({}, params);
}
