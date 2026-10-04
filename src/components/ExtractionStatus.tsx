import React from 'react';
import { MedicalExtractionResult } from '../types';

interface ExtractionStatusProps {
  status: 'idle' | 'analyzing' | 'success' | 'error';
  errorMessage?: string;
  extractedResult?: MedicalExtractionResult | null;
  onClearExtractedData?: () => void;
  onVerifyAndContinue?: () => void;
  onRetry?: () => void;
}

export const ExtractionStatus: React.FC<ExtractionStatusProps> = ({
  status,
  errorMessage,
  extractedResult,
  onClearExtractedData,
  onVerifyAndContinue,
  onRetry,
}) => {
  if (status === 'idle') {
    return null;
  }

  if (status === 'analyzing') {
    return (
      <div className="p-4 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 space-y-3 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-sky-100 border border-sky-300 flex items-center justify-center shrink-0">
            <i className="fa-solid fa-wand-magic-sparkles text-sky-600 text-sm animate-spin"></i>
          </div>
          <div className="flex-1">
            <h4 className="text-xs sm:text-sm font-bold text-sky-950 flex items-center gap-2">
              <span>Analyzing your document…</span>
              <span className="text-[10px] font-semibold bg-sky-200 text-sky-800 px-2 py-0.5 rounded-full">
                AI Vision + OCR
              </span>
            </h4>
            <p className="text-[11px] text-sky-700 mt-0.5">
              Securely processing patient demographics, medications, and medical history.
            </p>
          </div>
        </div>

        {/* Animated Progress Bar */}
        <div className="w-full bg-sky-200/60 rounded-full h-1.5 overflow-hidden">
          <div className="bg-sky-500 h-1.5 rounded-full animate-indeterminate"></div>
        </div>

        <div className="flex items-center justify-between text-[10px] text-sky-600 font-medium">
          <span className="flex items-center gap-1">
            <i className="fa-solid fa-lock text-[10px]"></i>
            Encrypted & processed in-memory
          </span>
          <span>Strict Clinical OCR Model</span>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-rose-100 border border-rose-300 flex items-center justify-center shrink-0 text-rose-600">
            <i className="fa-solid fa-triangle-exclamation text-sm"></i>
          </div>
          <div className="flex-1">
            <h4 className="text-xs sm:text-sm font-bold text-rose-950">
              Extraction Notice
            </h4>
            <p className="text-xs text-rose-800 mt-1">
              {errorMessage ||
                "We couldn't reliably read this document. Please upload a clearer image or enter your details manually."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-2xs transition cursor-pointer"
            >
              <i className="fa-solid fa-arrow-rotate-right mr-1.5"></i>
              Try Another Document
            </button>
          )}
          <span className="text-[11px] text-rose-700">
            You can always fill the form manually below.
          </span>
        </div>
      </div>
    );
  }

  // Success State
  if (status === 'success' && extractedResult) {
    const docTypeLabels: Record<string, string> = {
      prescription: "Doctor's Prescription",
      lab_report: 'Laboratory Diagnostic Report',
      medical_report: 'Clinical Medical Report',
      discharge_summary: 'Hospital Discharge Summary',
      health_record: 'Electronic Health Record',
      other: 'Health Document',
    };

    const docTypeLabel =
      docTypeLabels[extractedResult.documentType] || 'Medical Document';

    return (
      <div className="p-4 rounded-xl bg-emerald-50/90 border border-emerald-300 text-emerald-950 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center shrink-0 text-emerald-700">
              <i className="fa-solid fa-circle-check text-base"></i>
            </div>
            <div>
              <div className="flex items-center flex-wrap gap-2">
                <h4 className="text-xs sm:text-sm font-bold text-emerald-950">
                  ✓ Information extracted successfully
                </h4>
                <span className="text-[10px] font-bold bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded-md border border-emerald-300">
                  {docTypeLabel}
                </span>
              </div>
              <p className="text-xs text-emerald-800 mt-1 font-medium">
                Information extracted from your document. Please verify all details before continuing.
              </p>
            </div>
          </div>
        </div>

        {/* Alert pills if document had potential flags */}
        {extractedResult.isUnclearOrBlurry && (
          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center gap-2">
            <i className="fa-solid fa-triangle-exclamation text-amber-600 shrink-0"></i>
            <span>
              <strong>Low clarity detected:</strong> Parts of this document were handwritten or faint. Please double-check populated values.
            </span>
          </div>
        )}

        {extractedResult.hasMultiplePatients && (
          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center gap-2">
            <i className="fa-solid fa-users text-amber-600 shrink-0"></i>
            <span>
              <strong>Multiple patients detected:</strong> Please ensure the extracted details belong to the patient currently registering.
            </span>
          </div>
        )}

        {extractedResult.hasConflicts && extractedResult.conflictNotes && (
          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center gap-2">
            <i className="fa-solid fa-code-compare text-amber-600 shrink-0"></i>
            <span>
              <strong>Conflicting info:</strong> {extractedResult.conflictNotes}
            </span>
          </div>
        )}

        {/* Medications or Diagnoses Summary if detected */}
        {((extractedResult.medications && extractedResult.medications.length > 0) ||
          (extractedResult.diagnoses && extractedResult.diagnoses.length > 0)) && (
          <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-200 text-xs space-y-1.5">
            {extractedResult.diagnoses && extractedResult.diagnoses.length > 0 && (
              <div className="text-[11px] text-slate-700">
                <strong className="text-slate-900 font-semibold">Documented Indications/Notes: </strong>
                <span>{extractedResult.diagnoses.join(', ')}</span>
              </div>
            )}
            {extractedResult.medications && extractedResult.medications.length > 0 && (
              <div className="text-[11px] text-slate-700">
                <strong className="text-slate-900 font-semibold">Extracted Active Medications: </strong>
                <span>{extractedResult.medications.join(', ')}</span>
              </div>
            )}
            <div className="text-[10px] text-slate-500 italic pt-0.5">
              * Note: Document medications are noted for clinical record reference only and do not replace formal doctor evaluation.
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-1 gap-2 border-t border-emerald-200">
          <button
            type="button"
            onClick={onClearExtractedData}
            className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
          >
            <i className="fa-solid fa-trash-can text-slate-400 text-xs"></i>
            <span>Clear Extracted Data</span>
          </button>

          <button
            type="button"
            onClick={onVerifyAndContinue}
            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs transition cursor-pointer flex items-center gap-1.5"
          >
            <span>Verify & Continue</span>
            <i className="fa-solid fa-arrow-down text-xs"></i>
          </button>
        </div>
      </div>
    );
  }

  return null;
};
