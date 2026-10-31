import React from 'react';
import { validatePhoneNumber } from '../utils/phoneValidation';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface PhoneInputProps {
  id?: string;
  name?: string;
  label?: string;
  value: string;
  onChange: (value: string, isValid: boolean) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  helperText?: string;
  showCountryPrefix?: boolean;
}

export const PhoneInput: React.FC<PhoneInputProps> = ({
  id,
  name,
  label,
  value,
  onChange,
  placeholder = '10-digit number e.g. 9820012345',
  required = false,
  disabled = false,
  className = '',
  inputClassName = '',
  helperText,
  showCountryPrefix = false,
}) => {
  const validation = validatePhoneNumber(value, required);
  const isDirty = value.length > 0;
  const showError = isDirty ? !validation.isValid : required ? false : false;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const res = validatePhoneNumber(val, required);
    onChange(val, res.isValid);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    const res = validatePhoneNumber(pasted, required);
    onChange(pasted, res.isValid);
  };

  // Determine border and background colors
  let stateBorderClass = 'border-[#DCE7F0] dark:border-[#334155] focus-within:border-[#0B9FE3] focus-within:ring-2 focus-within:ring-[#0B9FE3]/20';
  let badgeColor = 'text-slate-400';

  if (isDirty) {
    if (!validation.isValid) {
      stateBorderClass = 'border-rose-400 dark:border-rose-500 bg-rose-50/30 dark:bg-rose-950/20 focus-within:ring-2 focus-within:ring-rose-400/30';
      badgeColor = 'text-rose-500 font-bold';
    } else {
      stateBorderClass = 'border-emerald-500 dark:border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 focus-within:ring-2 focus-within:ring-emerald-400/30';
      badgeColor = 'text-emerald-600 font-bold';
    }
  }

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label htmlFor={id} className="block text-xs font-bold text-[#10244A] dark:text-[#F1F5F9]">
          {label} {required && <span className="text-[#EF4444]">*</span>}
        </label>
      )}

      <div className={`relative flex items-center rounded-xl border transition ${stateBorderClass} bg-white dark:bg-[#1A263C] overflow-hidden`}>
        {showCountryPrefix && (
          <div className="px-3 py-2.5 bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 border-r border-[#DCE7F0] dark:border-[#334155] flex items-center gap-1 shrink-0 select-none">
            <span>🇮🇳</span>
            <span>+91</span>
          </div>
        )}

        <input
          id={id}
          name={name}
          type="text"
          inputMode="numeric"
          autoComplete="tel"
          disabled={disabled}
          value={value}
          onChange={handleChange}
          onPaste={handlePaste}
          placeholder={placeholder}
          maxLength={15}
          className={`flex-1 h-11 sm:h-12 px-3.5 pr-14 text-xs sm:text-sm font-mono tracking-wider text-[#10244A] dark:text-white bg-transparent focus:outline-hidden disabled:opacity-50 ${inputClassName}`}
        />

        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none select-none">
          {isDirty && validation.isValid && (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          )}
          {isDirty && !validation.isValid && (
            <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
          )}
          <span className={`text-[11px] tabular-nums ${badgeColor}`}>
            {value.length}/10
          </span>
        </div>
      </div>

      {/* Error Message Display */}
      {showError && validation.error && (
        <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5 mt-1 animate-in fade-in duration-150">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{validation.error}</span>
        </p>
      )}

      {!showError && helperText && (
        <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-0.5">
          {helperText}
        </p>
      )}
    </div>
  );
};

