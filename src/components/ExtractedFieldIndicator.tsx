import React from 'react';

interface ExtractedFieldIndicatorProps {
  confidence?: number;
  fieldName: string;
  isExtracted: boolean;
  onClearField?: () => void;
}

export const ExtractedFieldIndicator: React.FC<ExtractedFieldIndicatorProps> = ({
  confidence,
  fieldName,
  isExtracted,
  onClearField,
}) => {
  if (!isExtracted || confidence === undefined) {
    return null;
  }

  const percentage = Math.round(confidence * 100);

  // High confidence: >= 0.85
  if (confidence >= 0.85) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 mt-1">
        <i className="fa-solid fa-circle-check text-emerald-500 text-[10px]"></i>
        <span>Auto-filled ({percentage}% match)</span>
        {onClearField && (
          <button
            type="button"
            onClick={onClearField}
            title={`Clear ${fieldName}`}
            className="ml-1 text-emerald-600 hover:text-emerald-900 cursor-pointer"
          >
            ×
          </button>
        )}
      </div>
    );
  }

  // Medium confidence: 0.60 - 0.84
  if (confidence >= 0.6) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-300 mt-1">
        <i className="fa-solid fa-triangle-exclamation text-amber-500 text-[10px]"></i>
        <span>Please verify ({percentage}% match)</span>
        {onClearField && (
          <button
            type="button"
            onClick={onClearField}
            title={`Clear ${fieldName}`}
            className="ml-1 text-amber-700 hover:text-amber-900 cursor-pointer"
          >
            ×
          </button>
        )}
      </div>
    );
  }

  // Low confidence: < 0.60
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 mt-1">
      <i className="fa-solid fa-circle-question text-slate-400 text-[10px]"></i>
      <span>Could not reliably extract</span>
    </div>
  );
};
