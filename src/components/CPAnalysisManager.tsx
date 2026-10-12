import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Brain,
  Sparkles,
  Plus,
  Trash2,
  Save,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Target,
  BookOpen,
  Info,
  Lightbulb,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  EyeOff,
  Edit3,
  Check,
  X,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import {
  CPData,
  CPAnalysisData,
  CPAnalysisItem,
  AcademicSetting,
  TeacherProfile,
  ActiveContext,
  normalizeCPVerificationStatus,
} from '../types';
import { validateCPAnalysisDataWorkflow } from '../services/cpWorkflowService';
import { analyzeCPWithAI } from '../services/aiService';
import {
  reviewCPAnalysisSemantic,
  applyFindingToItems,
  undoAppliedFinding,
  type CPAnalysisSemanticReviewResult,
  type CPAnalysisSemanticFinding,
  type AppliedFindingRecord,
} from '../services/cpAnalysisSemanticReviewService';

interface CPAnalysisManagerProps {
  cp: CPData;
  cpAnalysis?: CPAnalysisData;
  context: ActiveContext;
  academicSetting: AcademicSetting;
  profile: TeacherProfile;
  onSaveCPAnalysis: (analysis: CPAnalysisData) => void;
  onNextStep: () => void;
  onBackToCP: () => void;
}

export function getInitialCPAnalysisItems(cpAnalysis?: CPAnalysisData | null): CPAnalysisItem[] {
  if (cpAnalysis?.items && cpAnalysis.items.length > 0) {
    return cpAnalysis.items;
  }
  return [];
}

export function deriveAnalysisItemsFromCP(cp: CPData): CPAnalysisItem[] {
  if (!cp.elements || cp.elements.length === 0) {
    return [];
  }
  return cp.elements.map((el, idx) => ({
    id: `ana-item-${Date.now()}-${idx + 1}`,
    elementId: el.id,
    elementName: el.name,
    scopeCode: '',
    cpText: el.content,
    cpCompetence: '',
    materialScope: el.name,
    meaningfulUnderstanding: '',
    suggestedTp: '',
    order: idx + 1,
  }));
}

export const CPAnalysisManager: React.FC<CPAnalysisManagerProps> = ({
  cp,
  cpAnalysis,
  context,
  academicSetting,
  profile,
  onSaveCPAnalysis,
  onNextStep,
  onBackToCP,
}) => {
  const [items, setItems] = useState<CPAnalysisItem[]>(() => getInitialCPAnalysisItems(cpAnalysis));
  const [generalSummary, setGeneralSummary] = useState(
    cpAnalysis?.generalSummary || ''
  );
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [semanticReview, setSemanticReview] = useState<CPAnalysisSemanticReviewResult | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isReviewStale, setIsReviewStale] = useState(false);
  const [dismissedFindingIds, setDismissedFindingIds] = useState<Set<string>>(new Set());
  const [appliedRecords, setAppliedRecords] = useState<AppliedFindingRecord[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Modal preview state for Before -> After suggestion application
  const [activePreviewModal, setActivePreviewModal] = useState<{
    finding: CPAnalysisSemanticFinding;
    editedValue: string;
  } | null>(null);

  const [notificationToast, setNotificationToast] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const handleReviewSemantics = () => {
    setIsReviewing(true);
    try {
      const result = reviewCPAnalysisSemantic(items, cp);
      setSemanticReview(result);
      setIsReviewStale(false);
    } finally {
      setIsReviewing(false);
    }
  };

  const handleOpenApplyPreview = (finding: CPAnalysisSemanticFinding) => {
    if (!finding.suggestedChange) return;
    setActivePreviewModal({
      finding,
      editedValue: finding.suggestedChange.suggestedValue,
    });
  };

  const handleConfirmApply = () => {
    if (!activePreviewModal) return;
    const { finding, editedValue } = activePreviewModal;
    const { updatedItems, record } = applyFindingToItems(items, finding, editedValue);
    setItems(updatedItems);
    if (record) {
      setAppliedRecords((prev) => [record, ...prev]);
    }
    setHasUnsavedChanges(true);
    setActivePreviewModal(null);

    // Refresh review with updated items
    const refreshed = reviewCPAnalysisSemantic(updatedItems, cp);
    setSemanticReview(refreshed);
    setIsReviewStale(false);

    setNotificationToast(
      `Saran berhasil diterapkan pada baris ${finding.itemOrder || ''}. Pastikan klik Simpan Analisis.`
    );
    setTimeout(() => setNotificationToast(null), 3500);
  };

  const handleUndoSuggestion = (itemId: string) => {
    const recordIndex = appliedRecords.findIndex((r) => r.itemId === itemId);
    if (recordIndex === -1) return;
    const record = appliedRecords[recordIndex];
    const restoredItems = undoAppliedFinding(items, record);
    setItems(restoredItems);
    setAppliedRecords((prev) => prev.filter((_, idx) => idx !== recordIndex));
    setHasUnsavedChanges(true);

    const refreshed = reviewCPAnalysisSemantic(restoredItems, cp);
    setSemanticReview(refreshed);
    setIsReviewStale(false);

    setNotificationToast(`Perubahan pada baris berhasil diurungkan.`);
    setTimeout(() => setNotificationToast(null), 3000);
  };

  const handleDismissFinding = (findingId: string) => {
    setDismissedFindingIds((prev) => new Set([...prev, findingId]));
  };

  useEffect(() => {
    if (cpAnalysis?.items && cpAnalysis.items.length > 0) {
      setItems(cpAnalysis.items);
      setGeneralSummary(cpAnalysis.generalSummary || '');
    } else {
      setItems([]);
      setGeneralSummary(cpAnalysis?.generalSummary || '');
    }
  }, [cpAnalysis]);

  const handleUpdateItem = (id: string, field: keyof CPAnalysisItem, value: any) => {
    let finalValue = value;
    if (field === 'scopeCode') {
      finalValue = String(value || '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 5);
    }
    setHasUnsavedChanges(true);
    if (semanticReview) {
      setIsReviewStale(true);
    }
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: finalValue } : it))
    );
  };

  const handleAddItem = () => {
    const newItem: CPAnalysisItem = {
      id: `ana-item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      elementId: '',
      elementName: '',
      cpText: '',
      cpCompetence: '',
      materialScope: '',
      meaningfulUnderstanding: '',
      suggestedTp: '',
      order: items.length + 1,
    };
    setHasUnsavedChanges(true);
    if (semanticReview) {
      setIsReviewStale(true);
    }
    setItems([...items, newItem]);
  };

  const handleSelectElement = (itemId: string, selectedElemId: string) => {
    const canonicalElem = (cp.elements || []).find((el) => el.id === selectedElemId);
    setHasUnsavedChanges(true);
    if (semanticReview) {
      setIsReviewStale(true);
    }
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        if (!canonicalElem) {
          return {
            ...it,
            elementId: '',
            elementName: '',
            cpText: '',
          };
        }
        return {
          ...it,
          elementId: canonicalElem.id,
          elementName: canonicalElem.name,
          cpText: canonicalElem.content,
        };
      })
    );
  };

  const handleDeleteItem = (id: string) => {
    setHasUnsavedChanges(true);
    if (semanticReview) {
      setIsReviewStale(true);
    }
    setItems(items.filter((it) => it.id !== id));
  };

  const hasCP =
    (cp.generalDescription && cp.generalDescription.trim().length > 0) ||
    (cp.elements && cp.elements.length > 0);

  const cpVerStatus = cp.source
    ? normalizeCPVerificationStatus(cp.source.verificationStatus)
    : 'UNVERIFIED';

  const isCPOutdated =
    hasCP &&
    items.length > 0 &&
    cpAnalysis?.basedOnCpUpdatedAt &&
    cp.updatedAt &&
    new Date(cp.updatedAt).getTime() > new Date(cpAnalysis.basedOnCpUpdatedAt).getTime() + 1000;

  const needsReview = cpAnalysis?.needsReview || isCPOutdated;

  const validation = validateCPAnalysisDataWorkflow(
    {
      ...cpAnalysis,
      id: cpAnalysis?.id || `cpanalysis-${academicSetting.id}`,
      academicSettingId: academicSetting.id,
      items,
      generalSummary,
    },
    cp
  );

  const handleSave = (): boolean => {
    const nextGeneratedBy =
      cpAnalysis?.generatedBy === 'AI' ? 'AI_EDITED_BY_TEACHER' : cpAnalysis?.generatedBy || 'TEACHER';

    const shouldKeepReview = Boolean(cpAnalysis?.needsReview || isCPOutdated);

    const candidate: CPAnalysisData = {
      id: cpAnalysis?.id || `cpanalysis-${academicSetting.id}`,
      academicSettingId: academicSetting.id,
      cpId: cp.id,
      cpSourceId: cp.source?.id || cp.source?.title,
      cpRegulationIds: cp.source?.regulationIds || cp.regulationIds || [],
      cpVersion: cp.cpVersion ?? cp.source?.versionCode,
      academicYear: context.academicYear,
      subjectCode: context.subject,
      phase: context.phase,
      generalSummary,
      items,
      generatedBy: nextGeneratedBy,
      needsReview: shouldKeepReview,
      reviewReason: shouldKeepReview
        ? cpAnalysis?.reviewReason || (isCPOutdated ? 'Teks CP telah diperbarui sejak analisis ini dibuat. Mohon sesuaikan analisis.' : undefined)
        : undefined,
      basedOnCpUpdatedAt:
        cpAnalysis?.basedOnCpUpdatedAt ||
        cp.updatedAt ||
        new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const candidateValidation = validateCPAnalysisDataWorkflow(candidate, cp);

    const updated: CPAnalysisData = {
      ...candidate,
      workflowStatus: candidateValidation.isSiap ? 'SIAP' : 'PERLU_DILENGKAPI',
    };

    onSaveCPAnalysis(updated);
    setHasUnsavedChanges(false);
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 2500);

    if (!candidateValidation.isSiap) {
      setAnalysisError(
        candidateValidation.issues[0] ||
        'Analisis CP belum siap untuk dilanjutkan.'
      );
      return false;
    }

    setAnalysisError(null);
    return true;
  };

  const executeAIAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const res = await analyzeCPWithAI({
        cpText: cp.generalDescription || '',
        elements: cp.elements || [],
        subject: context.subject,
        grade: context.grade,
        phase: context.phase,
        curriculum: context.curriculum,
      });

      const newItems: CPAnalysisItem[] = (res.items || []).map((it, idx) => {
        const canonicalElement = (cp.elements || []).find((el) => el.id === it.elementId);
        if (!canonicalElement) {
          throw new Error(`Hasil analisis memuat referensi elemen tidak dikenal (ID: ${it.elementId || 'kosong'}).`);
        }
        return {
          id: `ana-item-${Date.now()}-${idx + 1}-${Math.random().toString(36).substring(2, 6)}`,
          elementId: canonicalElement.id,
          elementName: canonicalElement.name,
          scopeCode: it.scopeCode || '',
          cpText: canonicalElement.content || '',
          cpCompetence: it.cpCompetence || '',
          materialScope: it.materialScope || '',
          meaningfulUnderstanding: it.meaningfulUnderstanding || '',
          suggestedTp: it.suggestedTp || '',
          order: idx + 1,
        };
      });

      const nextSummary = res.generalSummary || generalSummary || '';
      setItems(newItems);
      setGeneralSummary(nextSummary);

      const isGemini = res.engine === 'gemini';
      const candidateData: CPAnalysisData = {
        id: cpAnalysis?.id || `cpanalysis-${academicSetting.id}`,
        academicSettingId: academicSetting.id,
        cpId: cp.id,
        cpSourceId: cp.source?.id || cp.source?.title,
        cpRegulationIds: cp.source?.regulationIds || cp.regulationIds || [],
        cpVersion: cp.cpVersion ?? cp.source?.versionCode,
        academicYear: context.academicYear,
        subjectCode: context.subject,
        phase: context.phase,
        generalSummary: nextSummary,
        items: newItems,
        generatedBy: isGemini ? 'AI' : undefined,
        generationEngine: res.engine || (isGemini ? 'gemini' : 'pedagogical_engine'),
        provenance: {
          generatedBy: isGemini ? 'AI' : 'SYSTEM',
          generatedAt: new Date().toISOString(),
          engine: res.engine || (isGemini ? 'gemini' : 'pedagogical_engine'),
        },
        generatedAt: new Date().toISOString(),
        needsReview: false,
        reviewReason: undefined,
        basedOnCpUpdatedAt: cp.updatedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const val = validateCPAnalysisDataWorkflow(candidateData, cp);
      const updated: CPAnalysisData = {
        ...candidateData,
        workflowStatus: val.isSiap ? 'SIAP' : 'PERLU_DILENGKAPI',
      };

      onSaveCPAnalysis(updated);
      setShowSavedToast(true);
      setTimeout(() => setShowSavedToast(false), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menganalisis CP dengan AI';
      setAnalysisError(msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRunAIAnalysis = () => {
    if (!cp.generalDescription && (!cp.elements || cp.elements.length === 0)) {
      setAnalysisError('Capaian Pembelajaran (CP) rujukan belum diisi pada Langkah 03.');
      return;
    }

    if (items.length > 0) {
      setShowConfirmModal(true);
    } else {
      executeAIAnalysis();
    }
  };

  const handleGenerateFromCP = () => {
    if (!cp.elements || cp.elements.length === 0) {
      setAnalysisError('Elemen CP belum tersedia. Silakan isi elemen pada tahap CP terlebih dahulu.');
      return;
    }
    const derived: CPAnalysisItem[] = deriveAnalysisItemsFromCP(cp);
    setItems(derived);
    const updated: CPAnalysisData = {
      id: cpAnalysis?.id || `cpanalysis-${academicSetting.id}`,
      academicSettingId: academicSetting.id,
      cpId: cp.id,
      cpSourceId: cp.source?.id || cp.source?.title,
      cpRegulationIds: cp.source?.regulationIds || cp.regulationIds || [],
      cpVersion: cp.cpVersion ?? cp.source?.versionCode,
      academicYear: context.academicYear,
      subjectCode: context.subject,
      phase: context.phase,
      generalSummary,
      items: derived,
      generatedBy: 'TEACHER',
      generatedAt: new Date().toISOString(),
      workflowStatus: 'PERLU_DILENGKAPI',
      needsReview: false,
      reviewReason: undefined,
      basedOnCpUpdatedAt: cp.updatedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onSaveCPAnalysis(updated);
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 2500);
  };

  return (
    <div className="space-y-6" id="cp-analysis-manager">
      {/* Header card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-1 rounded-md">
              Langkah 04 — Kurikulum Merdeka
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {academicSetting.subject} • {academicSetting.grade} ({academicSetting.phase})
            </span>
            {validation.isSiap ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                SIAP
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                PERLU DILENGKAPI
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-2 flex items-center gap-2">
            <Brain className="w-6 h-6 text-blue-600" />
            Analisis Capaian Pembelajaran (CP)
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Bedah kompetensi (KKO) dan lingkup materi esensial dari setiap elemen CP sebagai jembatan perumusan Tujuan Pembelajaran (TP).
          </p>

          {/* Provenance and verification info */}
          <div className="mt-3 flex items-center gap-2 flex-wrap text-xs">
            <span className="text-slate-500 font-medium">Rujukan CP:</span>
            {cpVerStatus === 'VERIFIED' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                Terverifikasi Resmi: {cp.source?.institution || 'BSKAP'}
              </span>
            ) : cpVerStatus === 'LOCAL_REFERENCE' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-medium">
                <AlertTriangle className="w-3 h-3 text-amber-600" />
                Referensi Lokal
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                Draft Mandiri
              </span>
            )}
            {cp.source?.title && (
              <span className="text-slate-500 truncate max-w-sm" title={cp.source.title}>
                ({cp.source.title})
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleRunAIAnalysis}
            disabled={isAnalyzing}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              isAnalyzing
                ? 'bg-purple-100 text-purple-400 cursor-not-allowed border border-purple-200'
                : 'bg-purple-600 text-white hover:bg-purple-700 shadow-xs'
            }`}
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-purple-600" />
                <span>Menganalisis CP...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-purple-200" />
                <span>Analisis dengan AI</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleGenerateFromCP}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-blue-600" />
            Salin Struktur Elemen CP
          </button>
          <button
            type="button"
            onClick={handleReviewSemantics}
            disabled={isReviewing || items.length === 0}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="Periksa keselarasan kompetensi dan materi terhadap teks CP rujukan"
          >
            <ShieldCheck className="w-4 h-4 text-amber-700" />
            <span>Periksa Keselarasan</span>
          </button>
          {hasUnsavedChanges && (
            <span className="px-2.5 py-1 text-[11px] font-semibold bg-amber-100 text-amber-800 rounded-lg border border-amber-300">
              Perubahan belum disimpan
            </span>
          )}
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            Simpan Analisis
          </button>
        </div>
      </div>

      {notificationToast && (
        <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl flex items-center justify-between text-xs font-medium shadow-xs">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            <span>{notificationToast}</span>
          </div>
          <div className="flex items-center gap-2">
            {appliedRecords.length > 0 && (
              <button
                type="button"
                onClick={() => handleUndoSuggestion(appliedRecords[0].itemId)}
                className="px-2 py-0.5 rounded-md bg-white border border-blue-300 text-blue-800 hover:bg-blue-100 text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition shadow-2xs"
              >
                <RotateCcw className="w-3 h-3 text-blue-600" />
                <span>Urungkan</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setNotificationToast(null)}
              className="text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {analysisError && (
        <div className="p-4 bg-rose-50 border border-rose-300 rounded-2xl flex items-start gap-3 text-xs text-rose-900 shadow-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-rose-950">Gagal Melakukan Analisis AI</span>
            <p className="text-rose-800">{analysisError}</p>
          </div>
        </div>
      )}

      {semanticReview && (() => {
        const visibleFindings = (semanticReview.findings || []).filter(
          (f) => !dismissedFindingIds.has(f.id)
        );

        return (
          <div className="space-y-3">
            <div
              className={`p-4 rounded-2xl border flex items-start justify-between gap-3 text-xs shadow-xs ${
                semanticReview.warningCount > 0
                  ? 'bg-amber-50 border-amber-300 text-amber-950'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-950'
              }`}
            >
              <div className="flex items-start gap-3">
                {semanticReview.warningCount > 0 ? (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">
                      Hasil Pemeriksaan Keselarasan Semantik
                    </span>
                    {semanticReview.warningCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-200 text-amber-900">
                        {semanticReview.warningCount} Catatan
                      </span>
                    )}
                  </div>
                  <p className="text-slate-800 leading-relaxed font-medium">
                    {semanticReview.summaryMessage}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Pemeriksaan ini adalah evaluasi mutu pendamping (non-blocking). Anda dapat menyempurnakan rumusan analisis sebelum melanjutkan ke perumusan TP.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleReviewSemantics}
                  disabled={isReviewing}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 cursor-pointer shadow-2xs"
                >
                  Periksa Ulang
                </button>
                <button
                  type="button"
                  onClick={() => setSemanticReview(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>

            {isReviewStale && (
              <div className="p-3 bg-amber-100/70 border border-amber-300 rounded-xl flex items-center justify-between text-xs text-amber-950 shadow-xs">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>
                    Data analisis telah diubah manual sejak pemeriksaan terakhir. Hasil temuan di bawah mungkin sudah tidak mutakhir.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleReviewSemantics}
                  disabled={isReviewing}
                  className="px-2.5 py-1 text-xs font-semibold bg-white border border-amber-300 hover:bg-amber-50 rounded-lg text-amber-900 cursor-pointer shadow-2xs"
                >
                  Periksa Ulang
                </button>
              </div>
            )}

            {visibleFindings.length > 0 ? (
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-amber-600" />
                    <span>Daftar Temuan Keselarasan Semantik ({visibleFindings.length})</span>
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    Tinjau usulan, terapkan saran, atau abaikan jika rumusan telah sesuai
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {visibleFindings.map((finding) => {
                    const itemOrderDisplay =
                      finding.itemOrder ||
                      items.findIndex((it) => it.id === finding.itemId) + 1;
                    const hasAppliedRecord = appliedRecords.some(
                      (r) => r.itemId === finding.itemId
                    );

                    return (
                      <div
                        key={finding.id}
                        className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-bold">
                              Baris #{itemOrderDisplay > 0 ? itemOrderDisplay : 'Elemen'}
                            </span>
                            {finding.elementName && (
                              <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 text-[11px] font-medium border border-blue-100">
                                {finding.elementName}
                              </span>
                            )}
                            <span
                              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                                finding.severity === 'WARNING'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-blue-100 text-blue-800 border border-blue-200'
                              }`}
                            >
                              {finding.type === 'COMPETENCE_MISMATCH'
                                ? 'Ketidaksesuaian Kompetensi'
                                : finding.type === 'UNSUPPORTED_ADDITION'
                                ? 'Materi Tidak Didukung CP'
                                : finding.type === 'MATERIAL_MISSING'
                                ? 'Materi CP Belum Terwakili'
                                : 'Usulan TP Tidak Selaras'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDismissFinding(finding.id)}
                            className="text-xs text-slate-400 hover:text-slate-700 flex items-center gap-1 transition cursor-pointer"
                            title="Abaikan temuan ini"
                          >
                            <EyeOff className="w-3.5 h-3.5" />
                            <span>Abaikan</span>
                          </button>
                        </div>

                        <div className="space-y-1.5 text-xs">
                          <h5 className="font-bold text-slate-900">{finding.title}</h5>
                          <p className="text-slate-600 leading-relaxed">{finding.reason}</p>
                        </div>

                        {/* Teks Saat Ini */}
                        <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200 text-xs space-y-1">
                          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                            Teks Saat Ini:
                          </div>
                          <div className="text-slate-800 font-mono text-[11px] bg-white p-2 rounded-lg border border-slate-200">
                            {finding.suggestedChange?.currentValue ||
                              finding.evidence.analysisCompetence ||
                              finding.evidence.analysisMaterial ||
                              finding.evidence.suggestedTp ||
                              '(Tidak ada teks spesifik)'}
                          </div>
                        </div>

                        {/* Usulan Perbaikan Konkret */}
                        {finding.suggestedChange ? (
                          <div className="bg-emerald-50/60 rounded-xl p-2.5 border border-emerald-200 text-xs space-y-1">
                            <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider flex items-center justify-between">
                              <span>
                                Usulan Perbaikan ({finding.suggestedChange.fieldLabel}):
                              </span>
                              <span className="text-[10px] text-emerald-700 font-normal">
                                Dapat diedit sebelum disetujui
                              </span>
                            </div>
                            <div className="text-emerald-950 font-medium bg-white p-2 rounded-lg border border-emerald-200">
                              {finding.suggestedChange.suggestedValue}
                            </div>
                            <p className="text-[11px] text-emerald-700 pt-0.5">
                              {finding.suggestion}
                            </p>
                          </div>
                        ) : (
                          <div className="bg-amber-50/50 rounded-xl p-2.5 border border-amber-200 text-xs space-y-1">
                            <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
                              Saran Tindakan:
                            </div>
                            <p className="text-slate-700">{finding.suggestion}</p>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            {finding.canAutoApply && finding.suggestedChange ? (
                              <button
                                type="button"
                                onClick={() => handleOpenApplyPreview(finding)}
                                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Terapkan Saran</span>
                              </button>
                            ) : (
                              <div className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 border border-slate-300 text-slate-700 flex items-center gap-1.5">
                                <Info className="w-3.5 h-3.5 text-slate-500" />
                                <span>Perlu Tinjauan Guru</span>
                              </div>
                            )}

                            {hasAppliedRecord && (
                              <button
                                type="button"
                                onClick={() => handleUndoSuggestion(finding.itemId)}
                                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                                title="Kembalikan perubahan sebelumnya pada baris ini"
                              >
                                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                                <span>Urungkan</span>
                              </button>
                            )}
                          </div>

                          <span className="text-[11px] text-slate-400">
                            ID: {finding.id.split('-').slice(0, 3).join('-')}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : semanticReview.warningCount > 0 ? (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
                Semua catatan temuan pada pemeriksaan ini telah diabaikan atau diterapkan.
              </div>
            ) : null}
          </div>
        );
      })()}

      {needsReview && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-3 text-xs text-amber-900 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-amber-950">Perhatian: Capaian Pembelajaran (CP) Mengalami Perubahan</span>
            <p className="text-amber-800">
              Dokumen Capaian Pembelajaran (CP) rujukan telah diperbarui sejak analisis ini dibuat. Mohon tinjau kembali bedah kompetensi dan simpan ulang untuk memperbarui status keselarasan menuju tahap TP.
            </p>
          </div>
        </div>
      )}

      {showSavedToast && (
        <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-semibold shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          Data Analisis CP berhasil disimpan ke workspace!
        </div>
      )}

      {/* Overview Context Box */}
      <div className="bg-blue-50/60 rounded-2xl p-4 border border-blue-200/70 text-xs text-blue-900 flex items-start gap-3">
        <Lightbulb className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1 flex-1">
          <span className="font-bold">Panduan Analisis CP Kurikulum Merdeka (Berdasarkan Panduan Pembelajaran & Asesmen):</span>
          <p className="text-blue-800">
            Setiap kalimat CP dipecah menjadi dua komponen vital: <strong>Kompetensi</strong> (kemampuan yang harus dicapai siswa melalui Kata Kerja Operasional) dan <strong>Lingkup Materi</strong> (konsep esensial yang dipelajari). Kombinasi keduanya akan menghasilkan butir Tujuan Pembelajaran (TP) pada langkah berikutnya.
          </p>
        </div>
      </div>

      {/* Ringkasan Analisis CP */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-2">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
          Catatan & Ringkasan Analisis CP
        </label>
        <textarea
          rows={2}
          value={generalSummary}
          onChange={(e) => setGeneralSummary(e.target.value)}
          placeholder="Tuliskan catatan umum mengenai pendekatan analisis CP pada mata pelajaran dan fase ini..."
          className="w-full text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-xl p-3 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
        />
      </div>

      {/* Matriks Analisis Item */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">
              Matriks Analisis Elemen CP ({items.length} Komponen)
            </h2>
          </div>
          <button
            type="button"
            onClick={handleAddItem}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 flex items-center gap-1 shadow-2xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Tambah Baris
          </button>
        </div>

        <div className="divide-y divide-slate-200">
          {items.length === 0 ? (
            <div className="p-8 text-center text-slate-500 space-y-3">
              <BookOpen className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-sm font-medium">Belum ada analisis elemen CP.</p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Klik tombol &quot;Tarik dari Elemen CP&quot; di atas untuk menyusun draft analisis berdasarkan elemen CP yang tersedia, atau klik &quot;Tambah Baris&quot; untuk input mandiri.
              </p>
            </div>
          ) : (
            items.map((item, idx) => (
            <div key={item.id} className="p-4 sm:p-5 space-y-3 hover:bg-slate-50/40 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 mr-3">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 text-xs font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <select
                    value={item.elementId || ''}
                    onChange={(e) => handleSelectElement(item.id, e.target.value)}
                    className="font-bold text-sm text-slate-900 bg-white border border-slate-300 rounded-lg px-2.5 py-1 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-hidden max-w-md"
                  >
                    <option value="">-- Pilih Elemen CP Canonical --</option>
                    {(cp.elements || []).map((el, elIdx) => (
                      <option key={el.id || `el-${elIdx}`} value={el.id}>
                        {el.code ? `[${el.code}] ` : ''}{el.name}
                      </option>
                    ))}
                  </select>
                  {!item.elementId && (
                    <span className="text-[11px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                      Pilih Elemen CP
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteItem(item.id)}
                  className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                  title="Hapus baris analisis"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* CP Text reference */}
              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                  Kutipan Capaian Pembelajaran (CP) Elemen Canonical:
                </label>
                <div className="w-full text-xs text-slate-700 bg-slate-50/80 border border-slate-200 rounded-lg p-2.5 min-h-[42px] leading-relaxed">
                  {item.cpText || (
                    <span className="text-slate-400 italic">
                      Pilih elemen CP di atas untuk menampilkan kutipan resmi capaian pembelajaran.
                    </span>
                  )}
                </div>
              </div>

              {/* Grid: Kompetensi & Lingkup Materi */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-blue-900 block">
                    1. Kompetensi / Kata Kerja Operasional (KKO):
                  </label>
                  <input
                    type="text"
                    value={item.cpCompetence}
                    onChange={(e) => handleUpdateItem(item.id, 'cpCompetence', e.target.value)}
                    placeholder="Contoh: Menunjukkan, mempraktikkan, memahami"
                    className="w-full text-xs text-slate-800 bg-white border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-indigo-900 block">
                      2. Lingkup Materi Inti / Konten:
                    </label>
                    <label className="text-[11px] font-semibold text-purple-900 block">
                      Kode Lingkup:
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={item.materialScope}
                      onChange={(e) => handleUpdateItem(item.id, 'materialScope', e.target.value)}
                      placeholder="Contoh: Pola gerak dasar lokomotor dan manipulatif"
                      className="flex-1 text-xs text-slate-800 bg-white border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
                    />
                    <input
                      type="text"
                      value={item.scopeCode || ''}
                      onChange={(e) => handleUpdateItem(item.id, 'scopeCode', e.target.value.toUpperCase())}
                      placeholder="PGD"
                      className="w-20 text-xs text-center font-bold text-purple-900 bg-purple-50/50 border border-purple-200 rounded-lg p-2.5 focus:ring-2 focus:ring-purple-500 focus:outline-hidden uppercase"
                      title="Kode Lingkup"
                    />
                  </div>
                </div>
              </div>

              {/* Grid: Pemahaman Bermakna & Rumusan Awal TP */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 block">
                    3. Pemahaman Bermakna / Konteks / Variasi:
                  </label>
                  <input
                    type="text"
                    value={item.meaningfulUnderstanding || ''}
                    onChange={(e) => handleUpdateItem(item.id, 'meaningfulUnderstanding', e.target.value)}
                    placeholder="Contoh: Penerapan dalam permainan beregu dan gaya hidup sehat"
                    className="w-full text-xs text-slate-800 bg-white border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-emerald-900 block">
                    4. Rumusan Awal Tujuan Pembelajaran (Draft TP):
                  </label>
                  <input
                    type="text"
                    value={item.suggestedTp || ''}
                    onChange={(e) => handleUpdateItem(item.id, 'suggestedTp', e.target.value)}
                    placeholder="Contoh: Peserta didik mampu mempraktikkan pola gerak dasar secara tepat."
                    className="w-full text-xs text-emerald-950 bg-emerald-50/50 border border-emerald-200 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium"
                  />
                </div>
              </div>
            </div>
          )))}
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={onBackToCP}
          className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke CP (03)
        </button>

        <button
          type="button"
          onClick={() => {
            const ready = handleSave();
            if (ready) {
              onNextStep();
            }
          }}
          className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-blue-900 text-white hover:bg-blue-800 flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
        >
          <span>Lanjut ke Penyusunan TP (05)</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Confirmation Modal for AI re-analysis */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center gap-3 text-purple-700">
              <Sparkles className="w-6 h-6 shrink-0 text-purple-600" />
              <h3 className="text-base font-bold text-slate-900">Konfirmasi Analisis AI</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Analisis CP sudah berisi data. Menjalankan analisis AI baru akan memperbarui daftar kompetensi, lingkup materi, dan usulan TP secara otomatis berdasarkan CP rujukan. Apakah Anda ingin melanjutkan?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirmModal(false);
                  executeAIAnalysis();
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition cursor-pointer"
              >
                Lanjutkan Analisis AI
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Preview Sebelum -> Sesudah untuk Terapkan Saran */}
      {activePreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Pratinjau & Konfirmasi Terapkan Saran
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Baris #{activePreviewModal.finding.itemOrder || 'Elemen'} • {activePreviewModal.finding.elementName || 'Analisis CP'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActivePreviewModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Finding summary */}
            <div className="p-3 bg-amber-50/60 border border-amber-200/70 rounded-xl text-xs space-y-1">
              <span className="font-bold text-amber-900">{activePreviewModal.finding.title}</span>
              <p className="text-slate-600 leading-relaxed text-[11px]">{activePreviewModal.finding.reason}</p>
            </div>

            {/* Kolom yang diperbarui */}
            <div className="text-xs space-y-3">
              <div className="flex items-center justify-between text-slate-500 font-semibold text-[11px]">
                <span>KOLOM YANG DIPERBARUI:</span>
                <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                  {activePreviewModal.finding.suggestedChange?.fieldLabel || 'Kolom Analisis'}
                </span>
              </div>

              {/* Perbandingan Sebelum vs Sesudah */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Sebelum */}
                <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                    <span>Sebelum</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-slate-700 font-mono text-xs break-words min-h-[60px]">
                    {activePreviewModal.finding.suggestedChange?.currentValue || '(Kosong)'}
                  </div>
                </div>

                {/* Sesudah (Dapat Diedit Guru) */}
                <div className="space-y-1.5 p-3 rounded-xl bg-emerald-50/50 border border-emerald-200">
                  <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>Sesudah (Dapat Diedit)</span>
                    </div>
                    <Edit3 className="w-3 h-3 text-emerald-600" />
                  </div>
                  <textarea
                    value={activePreviewModal.editedValue}
                    onChange={(e) =>
                      setActivePreviewModal((prev) =>
                        prev ? { ...prev, editedValue: e.target.value } : null
                      )
                    }
                    rows={3}
                    className="w-full p-2.5 bg-white rounded-lg border border-emerald-300 text-emerald-950 font-medium text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                    placeholder="Ketik rumusan saran yang disesuaikan..."
                  />
                </div>
              </div>

              <div className="text-[11px] text-slate-500 flex items-center gap-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Hanya kolom tersebut pada baris ini yang akan diperbarui. Teks CP rujukan, ID elemen, dan baris lainnya tetap utuh.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActivePreviewModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmApply}
                disabled={!activePreviewModal.editedValue.trim()}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Konfirmasi & Terapkan Perubahan</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
