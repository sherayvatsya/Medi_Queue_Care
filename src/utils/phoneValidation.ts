/**
 * Universal Phone Number Validation Utility for Medi-Queue
 * 
 * Rules:
 * 1. Only numeric integer digits (0-9). Rejects any string characters, alphabets, or special symbols.
 * 2. Exactly 10 digits required.
 *    - If less than 10 digits: Marks error ("Incomplete: X/10 digits").
 *    - If greater than 10 digits: Marks error ("Exceeded: X/10 digits").
 *    - If string / letters: Marks error ("Strings/letters are not allowed").
 */

export interface PhoneValidationResult {
  value: string;
  digits: string;
  isValid: boolean;
  error: string;
  charCount: number;
  hasStringError: boolean;
  hasLengthError: boolean;
}

export function validatePhoneNumber(raw: string, isRequired: boolean = true): PhoneValidationResult {
  const trimmed = (raw || '').trim();

  if (!trimmed) {
    return {
      value: raw || '',
      digits: '',
      isValid: !isRequired,
      error: isRequired ? 'Phone number is required (10 digits).' : '',
      charCount: 0,
      hasStringError: false,
      hasLengthError: isRequired,
    };
  }

  // Check for any alphabetic/string characters
  const hasLetters = /[a-zA-Z]/.test(raw);
  // Check for any symbols/punctuation (excluding nothing - strictly integer numbers only)
  const hasSymbols = /[^0-9]/.test(raw);

  const digits = raw.replace(/\D/g, '');

  if (hasLetters) {
    return {
      value: raw,
      digits,
      isValid: false,
      error: 'Invalid input: Only integer numbers (0-9) are allowed. Letters and words are rejected.',
      charCount: digits.length,
      hasStringError: true,
      hasLengthError: digits.length !== 10,
    };
  }

  if (hasSymbols) {
    return {
      value: raw,
      digits,
      isValid: false,
      error: 'Invalid input: Special characters and symbols are not allowed. Enter 10 integer digits only.',
      charCount: digits.length,
      hasStringError: true,
      hasLengthError: digits.length !== 10,
    };
  }

  if (digits.length < 10) {
    return {
      value: raw,
      digits,
      isValid: false,
      error: `Phone number is too short (${digits.length}/10 digits). Exactly 10 digits are required.`,
      charCount: digits.length,
      hasStringError: false,
      hasLengthError: true,
    };
  }

  if (digits.length > 10) {
    return {
      value: raw,
      digits,
      isValid: false,
      error: `Phone number cannot exceed 10 digits (${digits.length}/10 digits entered).`,
      charCount: digits.length,
      hasStringError: false,
      hasLengthError: true,
    };
  }

  return {
    value: raw,
    digits,
    isValid: true,
    error: '',
    charCount: 10,
    hasStringError: false,
    hasLengthError: false,
  };
}
