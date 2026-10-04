import React, { useState, useRef } from 'react';
import { MedicalExtractionResult } from '../types';
import { ExtractionStatus } from './ExtractionStatus';

interface SmartDocumentUploadProps {
  onExtractionSuccess: (data: MedicalExtractionResult) => void;
  onClearData: () => void;
  onShowToast?: (title: string, desc: string, type?: 'info' | 'success' | 'urgent') => void;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf'];
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/pdf',
];

export const SmartDocumentUpload: React.FC<SmartDocumentUploadProps> = ({
  onExtractionSuccess,
  onClearData,
  onShowToast,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [userConsent, setUserConsent] = useState<boolean>(false);
  const [uploadStatus, setUploadStatus] = useState<
    'idle' | 'analyzing' | 'success' | 'error'
  >('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [extractedData, setExtractedData] =
    useState<MedicalExtractionResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const notify = (
    title: string,
    desc: string,
    type: 'info' | 'success' | 'urgent' = 'info'
  ) => {
    if (onShowToast) {
      onShowToast(title, desc, type);
    }
  };

  const handleValidateAndSetFile = (file: File) => {
    setErrorMessage('');

    // Check size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      setErrorMessage(
        `File is too large (${sizeMb} MB). Maximum allowed size is 10 MB.`
      );
      setUploadStatus('error');
      notify(
        'File Too Large',
        `The file size (${sizeMb} MB) exceeds the 10 MB maximum limit.`,
        'urgent'
      );
      return;
    }

    // Check type
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    const mime = file.type.toLowerCase();
    const isAllowed =
      ALLOWED_MIME_TYPES.includes(mime) || ALLOWED_EXTENSIONS.includes(ext);

    if (!isAllowed) {
      setErrorMessage(
        'Unsupported file format. Please upload a JPG, JPEG, PNG, or PDF file.'
      );
      setUploadStatus('error');
      notify(
        'Invalid Format',
        'Only JPG, JPEG, PNG, and PDF medical documents are supported.',
        'urgent'
      );
      return;
    }

    // Clear previous preview
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    const isDocPdf = mime === 'application/pdf' || ext === '.pdf';
    setIsPdf(isDocPdf);

    if (isDocPdf) {
      setPreviewUrl(null);
    } else {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }

    setUploadStatus('idle');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleValidateAndSetFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleValidateAndSetFile(file);
    }
  };

  const handleRemoveFile = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setIsPdf(false);
    setUploadStatus('idle');
    setErrorMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAnalyzeDocument = async () => {
    if (!selectedFile) {
      setErrorMessage('Please select a prescription or health document first.');
      setUploadStatus('error');
      return;
    }

    if (!userConsent) {
      setErrorMessage(
        'Please check the consent box to authorize processing of this document.'
      );
      setUploadStatus('error');
      notify(
        'Consent Required',
        'Your consent is required to analyze the document.',
        'urgent'
      );
      return;
    }

    setUploadStatus('analyzing');
    setErrorMessage('');

    try {
      const formData = new FormData();
      formData.append('document', selectedFile);
      formData.append('consent', 'true');

      const response = await fetch('/api/ai/extract-medical-document', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result?.error ||
            "We couldn't reliably read this document. Please upload a clearer image or enter your details manually."
        );
      }

      setExtractedData(result.data);
      setUploadStatus('success');
      onExtractionSuccess(result.data);
      notify(
        'Document Processed',
        'Patient information extracted successfully! Please verify the highlighted fields.',
        'success'
      );
    } catch (err: any) {
      console.warn('Document extraction failed:', err);
      let friendly = err?.message || '';
      try {
        const parsed = JSON.parse(friendly);
        if (parsed?.error?.message) {
          friendly = parsed.error.message;
        }
      } catch {}

      if (
        friendly.includes('503') ||
        friendly.includes('high demand') ||
        friendly.includes('UNAVAILABLE')
      ) {
        friendly =
          'The AI document extraction service is temporarily experiencing high hospital demand. Please click "Analyze Document & Auto-Fill" again, or fill in your details manually below.';
      } else if (!friendly) {
        friendly =
          "We couldn't reliably read this document. Please upload a clearer image or enter your details manually.";
      }

      setUploadStatus('error');
      setErrorMessage(friendly);
      notify('Extraction Notice', friendly, 'urgent');
    }
  };

  const handleClearAll = () => {
    handleRemoveFile();
    setExtractedData(null);
    onClearData();
    notify('Extracted Data Cleared', 'Registration form fields have been reset.', 'info');
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="bg-gradient-to-br from-sky-50/70 via-white to-slate-50 border border-sky-200/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
      {/* Header Section */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center shrink-0 border border-sky-500/20">
              <i className="fa-solid fa-wand-magic-sparkles text-sm"></i>
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
                Smart Registration
              </h3>
              <span className="text-[10px] uppercase font-bold tracking-wider text-sky-600 bg-sky-100/70 px-1.5 py-0.5 rounded">
                AI Document Vision
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-600">
            Upload your prescription or health report and we'll help fill your details.
          </p>
        </div>

        {/* Format & Size Badges */}
        <div className="hidden sm:flex flex-col items-end gap-1 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1 font-medium bg-white px-2 py-0.5 rounded-md border border-slate-200">
            <i className="fa-solid fa-file-shield text-sky-500"></i>
            JPG, PNG, PDF
          </span>
          <span className="text-[10px] text-slate-400">Max size: 10 MB</span>
        </div>
      </div>

      {/* Upload Zone / Drop Target */}
      {!selectedFile ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-5 text-center transition cursor-pointer flex flex-col items-center justify-center gap-2.5 ${
            isDragging
              ? 'border-sky-500 bg-sky-50/80 scale-[1.01]'
              : 'border-slate-300 hover:border-sky-400 bg-white/70 hover:bg-white'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.pdf"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="w-11 h-11 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-200 text-lg shadow-2xs">
            <i className="fa-solid fa-cloud-arrow-up"></i>
          </div>

          <div>
            <button
              type="button"
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-xs transition cursor-pointer inline-flex items-center gap-2"
            >
              <i className="fa-solid fa-upload text-xs"></i>
              <span>Upload Prescription / Health Report</span>
            </button>
            <p className="text-xs text-slate-500 mt-2 font-medium">
              or drag & drop your document here
            </p>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-1">
            <span>Prescription</span>
            <span>•</span>
            <span>Lab Report</span>
            <span>•</span>
            <span>Discharge Summary</span>
            <span>•</span>
            <span>Health Record</span>
          </div>
        </div>
      ) : (
        /* Selected File Preview Card */
        <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 space-y-3 shadow-2xs">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {/* Thumbnail or PDF icon */}
              {isPdf ? (
                <div className="w-14 h-14 rounded-lg bg-rose-50 border border-rose-200 flex flex-col items-center justify-center text-rose-600 shrink-0">
                  <i className="fa-solid fa-file-pdf text-2xl"></i>
                  <span className="text-[9px] font-bold mt-0.5 uppercase">PDF</span>
                </div>
              ) : previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Document Preview"
                  className="w-14 h-14 object-cover rounded-lg border border-slate-200 shrink-0 shadow-2xs"
                />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600 shrink-0">
                  <i className="fa-solid fa-file-medical text-2xl"></i>
                </div>
              )}

              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                  {selectedFile.name}
                </p>
                <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                  <span className="font-mono">{formatFileSize(selectedFile.size)}</span>
                  <span>•</span>
                  <span className="text-emerald-600 font-semibold flex items-center gap-1">
                    <i className="fa-solid fa-check text-[10px]"></i>
                    Ready for analysis
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRemoveFile}
              disabled={uploadStatus === 'analyzing'}
              className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              title="Remove document"
            >
              <i className="fa-solid fa-xmark text-sm"></i>
            </button>
          </div>

          {/* Privacy & Consent Notice Checkbox */}
          {uploadStatus !== 'success' && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={userConsent}
                  onChange={(e) => {
                    setUserConsent(e.target.checked);
                    if (errorMessage) setErrorMessage('');
                  }}
                  className="w-4 h-4 rounded text-sky-600 accent-sky-600 mt-0.5 cursor-pointer"
                />
                <span className="font-medium">
                  I consent to processing this document to extract information for my registration.
                </span>
              </label>
              <p className="text-[11px] text-slate-500 pl-6.5">
                <i className="fa-solid fa-shield-halved text-sky-500 mr-1"></i>
                Processed securely in-memory. Documents are not retained or shared.
              </p>
            </div>
          )}

          {/* Action Button: Analyze Document */}
          {uploadStatus !== 'success' && (
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleRemoveFile}
                disabled={uploadStatus === 'analyzing'}
                className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
              >
                Change Document
              </button>

              <button
                type="button"
                onClick={handleAnalyzeDocument}
                disabled={uploadStatus === 'analyzing' || !userConsent}
                className={`px-4 py-2 rounded-lg text-xs font-bold shadow-xs transition flex items-center gap-2 cursor-pointer ${
                  userConsent && uploadStatus !== 'analyzing'
                    ? 'bg-sky-600 hover:bg-sky-700 text-white'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {uploadStatus === 'analyzing' ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin text-xs"></i>
                    <span>Analyzing your document…</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-wand-magic-sparkles text-xs"></i>
                    <span>Analyze Document & Auto-Fill</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Extraction Status & Result Banner */}
      <ExtractionStatus
        status={uploadStatus}
        errorMessage={errorMessage}
        extractedResult={extractedData}
        onClearExtractedData={handleClearAll}
        onVerifyAndContinue={() => {
          const el = document.getElementById('registration-fields');
          if (el) {
            el.scrollIntoView({ behavior: 'smooth' });
          }
        }}
        onRetry={() => {
          setUploadStatus('idle');
          setErrorMessage('');
        }}
      />
    </div>
  );
};
