import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
let PDFParseClass: any = null;
try {
  const p = require('pdf-parse');
  PDFParseClass = p.PDFParse || p;
} catch {
  // pdf-parse optional fallback
}

export interface ExtractedConfidence {
  fullName?: number;
  mobileNumber?: number;
  email?: number;
  age?: number;
  dateOfBirth?: number;
  gender?: number;
  bloodGroup?: number;
  emergencyContactName?: number;
  emergencyContactPhone?: number;
  allergies?: number;
  medicalConditions?: number;
  medications?: number;
  diagnoses?: number;
}

export type DocumentType =
  | 'prescription'
  | 'lab_report'
  | 'medical_report'
  | 'discharge_summary'
  | 'health_record'
  | 'other';

export interface MedicalExtractionResult {
  fullName: string;
  mobileNumber: string;
  email: string;
  age: number | null;
  dateOfBirth: string;
  gender: 'Male' | 'Female' | 'Other' | '';
  bloodGroup: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  allergies: string[];
  medicalConditions: string[];
  medications: string[];
  diagnoses: string[];
  documentType: DocumentType;
  confidence: ExtractedConfidence;
  isUnclearOrBlurry?: boolean;
  hasMultiplePatients?: boolean;
  hasConflicts?: boolean;
  conflictNotes?: string;
  documentSummary?: string;
}

// Allowed MIME types
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/pdf',
];

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// Initialize Gemini client with user-agent header
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'AI API Key is not configured on the server. Please set GEMINI_API_KEY or AI_API_KEY.'
    );
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const EXTRACTION_SYSTEM_INSTRUCTION = `You are a clinical document vision and OCR extraction assistant for hospital patient registration at Medi-Queue.
Your ONLY role is strictly extracting factual patient demographic and baseline health information explicitly recorded in the uploaded medical document (such as a doctor's prescription, diagnostic lab report, discharge summary, or health record).

CRITICAL MEDICAL SAFETY & EXTRACTION RULES:
1. NEVER invent, hallucinate, or guess information.
2. If information is not present in the document, return null or empty values.
3. DO NOT GUESS patient's age, gender, blood group, phone number, email, emergency contact, allergy, or medical conditions.
4. Only include an allergy if it is explicitly documented (e.g. "Known Allergies: Penicillin" or "Allergic to Sulfa"). Do NOT mark allergies based on conjecture.
5. Only include a medical condition / pre-existing condition if explicitly documented in the patient's medical history or past history.
6. DO NOT interpret medications as proof that the patient has a particular disease (e.g. Metformin does not guarantee Type 2 Diabetes unless explicitly stated).
7. This feature is ONLY for document data extraction. DO NOT diagnose the patient, DO NOT recommend medicines, DO NOT change medications, and DO NOT generate medical advice.
8. If the document is unclear, handwritten, blurry, cropped, or unreadable, mark "isUnclearOrBlurry": true, and assign low confidence scores (< 0.60) rather than guessing.
9. If multiple patients' information appears in a single document (e.g. family reports or batch records), mark "hasMultiplePatients": true and do not arbitrarily choose one.
10. If conflicting information appears (e.g. two conflicting blood groups or ages), set "hasConflicts": true and describe the conflict in "conflictNotes".

CONFIDENCE SCORING GUIDELINES (Between 0.00 and 1.00):
- High confidence (0.85 - 1.00): Field is clearly legible, explicitly typed/printed, and unambiguously attributed to the patient.
- Medium confidence (0.60 - 0.84): Field is handwritten, slightly faint, or partially obscured, but reasonably decipherable.
- Low confidence (0.00 - 0.59): Field is blurry, highly ambiguous, cut-off, or inferred with low certainty.
- If a field is empty / not found, confidence should be 0.0.

STANDARDIZATION GUIDELINES:
- gender: Only "Male", "Female", or "Other". Empty string if not found.
- bloodGroup: Standard blood groups like "A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-", or empty string if not found.
- allergies: Array of identified allergy strings (e.g., ["Penicillin", "Latex", "Sulfa Drugs", "Aspirin/NSAIDs", "Dust/Pollen", "Contrast Dye"]). Empty array if none mentioned.
- medicalConditions: Array of chronic conditions explicitly noted (e.g., ["Hypertension", "Type 2 Diabetes", "Asthma/COPD", "Thyroid Disorder", "Heart Disease", "Arthritis"]).
- documentType: one of ["prescription", "lab_report", "medical_report", "discharge_summary", "health_record", "other"]

OUTPUT FORMAT:
You MUST respond with STRICT valid JSON matching this schema:
{
  "fullName": string,
  "mobileNumber": string,
  "email": string,
  "age": number | null,
  "dateOfBirth": string,
  "gender": string,
  "bloodGroup": string,
  "emergencyContactName": string,
  "emergencyContactPhone": string,
  "allergies": string[],
  "medicalConditions": string[],
  "medications": string[],
  "diagnoses": string[],
  "documentType": string,
  "confidence": {
    "fullName": number,
    "mobileNumber": number,
    "email": number,
    "age": number,
    "dateOfBirth": number,
    "gender": number,
    "bloodGroup": number,
    "emergencyContactName": number,
    "emergencyContactPhone": number,
    "allergies": number,
    "medicalConditions": number,
    "medications": number,
    "diagnoses": number
  },
  "isUnclearOrBlurry": boolean,
  "hasMultiplePatients": boolean,
  "hasConflicts": boolean,
  "conflictNotes": string,
  "documentSummary": string
}`;

// Helper: Extract text from PDF buffer if available
async function tryExtractPdfText(buffer: Buffer): Promise<string> {
  if (!PDFParseClass) return '';
  try {
    const parser = new PDFParseClass(new Uint8Array(buffer));
    await parser.load();
    const res = await parser.getText();
    return res?.text?.trim() || '';
  } catch {
    return '';
  }
}

// Deterministic local clinical fallback extractor
function localRuleBasedExtraction(text: string, filename: string): MedicalExtractionResult {
  const clean = text.replace(/\r/g, '');

  // 1. Full Legal Name
  let fullName = '';
  const nameMatch =
    clean.match(/(?:Patient\s*(?:Legal\s*)?Name|Pt\s*Name|Name)\s*[:\-]\s*([A-Za-z\s.]+?)(?=\s*(?:\n|Age|Sex|Gender|DOB|UHID|Phone|$))/i) ||
    clean.match(/(?:Patient\s*:\s*)([A-Za-z\s.]+)/i);
  if (nameMatch) {
    fullName = nameMatch[1].replace(/^(?:Shri|Smt|Mr|Mrs|Ms|Dr)\.?\s+/i, '').trim();
  }

  // 2. Age
  let age: number | null = null;
  const ageMatch =
    clean.match(/(?:Age|Aged)\s*[:\-]?\s*(\d{1,3})/i) ||
    clean.match(/(\d{1,3})\s*(?:Years|Yrs|Y\/o|yo)/i);
  if (ageMatch) {
    const parsedAge = parseInt(ageMatch[1], 10);
    if (parsedAge > 0 && parsedAge < 125) {
      age = parsedAge;
    }
  }

  // 3. Gender
  let gender: 'Male' | 'Female' | 'Other' | '' = '';
  if (/\b(?:Gender|Sex)\s*[:\-]?\s*(Female|F\b)/i.test(clean) || /\bFemale\b/i.test(clean)) {
    gender = 'Female';
  } else if (/\b(?:Gender|Sex)\s*[:\-]?\s*(Male|M\b)/i.test(clean) || /\bMale\b/i.test(clean)) {
    gender = 'Male';
  }

  // 4. Blood Group
  let bloodGroup = '';
  const bgMatch =
    clean.match(/(?:Blood\s*Group|Blood\s*Type|BG)\s*[:\-]?\s*([ABO][+-]|AB[+-])/i) ||
    clean.match(/\b([ABO][+-]|AB[+-])\b/);
  if (bgMatch) {
    bloodGroup = bgMatch[1].toUpperCase();
  }

  // 5. Mobile Number
  let mobileNumber = '';
  const phoneMatch = clean.match(
    /(?:Contact\s*(?:Mobile|Phone)?|Mobile|Phone|Tel)\s*[:\-]?\s*(\+?91[\s-]?[6789]\d{4}[\s-]?\d{5}|\+?\d{10,13})/i
  );
  if (phoneMatch) {
    mobileNumber = phoneMatch[1].trim();
  }

  // 6. Email Address
  let email = '';
  const emailMatch = clean.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,6})/);
  if (emailMatch) {
    email = emailMatch[1].trim();
  }

  // 7. Emergency Contact
  let emergencyContactName = '';
  let emergencyContactPhone = '';
  const emMatch = clean.match(/Emergency\s*(?:Contact)?\s*[:\-]?\s*([^\n\r]+)/i);
  if (emMatch) {
    const emLine = emMatch[1];
    const emPhoneMatch = emLine.match(/(\+?91[\s-]?[6789]\d{4}[\s-]?\d{5}|\+?\d{10,13})/);
    if (emPhoneMatch) {
      emergencyContactPhone = emPhoneMatch[1].trim();
    }
    emergencyContactName = emLine
      .replace(/(\+?91[\s-]?[6789]\d{4}[\s-]?\d{5}|\+?\d{10,13})/, '')
      .replace(/[\(\)-]/g, '')
      .trim();
  }

  // 8. Known Allergies
  const allergies: string[] = [];
  if (/(?:Known\s*)?Allergies/i.test(clean)) {
    if (/Penicillin/i.test(clean)) allergies.push('Penicillin');
    if (/Sulfa/i.test(clean)) allergies.push('Sulfa Drugs');
    if (/Aspirin|NSAID/i.test(clean)) allergies.push('Aspirin/NSAIDs');
    if (/Latex/i.test(clean)) allergies.push('Latex');
    if (/Dust|Pollen/i.test(clean)) allergies.push('Dust / Pollen');
    if (/Contrast/i.test(clean)) allergies.push('Contrast Dye');
    if (/No known|NKDA|Nil|None/i.test(clean) && allergies.length === 0) allergies.push('None');
  }

  // 9. Pre-existing Conditions
  const medicalConditions: string[] = [];
  if (/Hypertension|High BP|\bHTN\b/i.test(clean)) medicalConditions.push('Hypertension (High BP)');
  if (/Type 2 Diabetes|\bT2D\b|\bDM2\b|Diabetes Mellitus/i.test(clean))
    medicalConditions.push('Type 2 Diabetes');
  if (/Asthma|COPD|Bronchial/i.test(clean)) medicalConditions.push('Asthma / COPD');
  if (/Thyroid|Hypothyroid|Hyperthyroid/i.test(clean)) medicalConditions.push('Thyroid Disorder');
  if (/Heart Disease|Cardiac|CAD|Angina/i.test(clean)) medicalConditions.push('Heart Disease');
  if (/Arthritis|Osteoarthritis/i.test(clean)) medicalConditions.push('Arthritis');

  // 10. Medications
  const medications: string[] = [];
  const rxLines = clean.match(/(?:Rx|Medications?|Prescriptions?)\s*[:\-]?\s*[\r\n]+([\s\S]*?)(?=\n\s*(?:Consulting|Doctor|Registration|Date|$))/i);
  if (rxLines) {
    const medMatches = rxLines[1].match(/(?:\d+\.|\*|\-)\s*([^\n\r]+)/g);
    if (medMatches) {
      medMatches.forEach((m) => medications.push(m.replace(/^\d+\.|\*|\-/, '').trim()));
    }
  }

  // Determine document type
  let documentType: DocumentType = 'other';
  const lower = (filename + ' ' + clean).toLowerCase();
  if (lower.includes('prescription') || lower.includes('rx')) documentType = 'prescription';
  else if (lower.includes('lab') || lower.includes('pathology') || lower.includes('diagnostic'))
    documentType = 'lab_report';
  else if (lower.includes('discharge')) documentType = 'discharge_summary';
  else if (lower.includes('report') || lower.includes('medical')) documentType = 'medical_report';

  return {
    fullName,
    mobileNumber,
    email,
    age,
    dateOfBirth: '',
    gender,
    bloodGroup,
    emergencyContactName,
    emergencyContactPhone,
    allergies,
    medicalConditions,
    medications,
    diagnoses: [],
    documentType,
    confidence: {
      fullName: fullName ? 0.95 : 0,
      mobileNumber: mobileNumber ? 0.95 : 0,
      email: email ? 0.95 : 0,
      age: age ? 0.95 : 0,
      gender: gender ? 0.95 : 0,
      bloodGroup: bloodGroup ? 0.95 : 0,
      emergencyContactName: emergencyContactName ? 0.9 : 0,
      emergencyContactPhone: emergencyContactPhone ? 0.9 : 0,
      allergies: allergies.length > 0 ? 0.9 : 0,
      medicalConditions: medicalConditions.length > 0 ? 0.9 : 0,
      medications: medications.length > 0 ? 0.9 : 0,
    },
    isUnclearOrBlurry: false,
    hasMultiplePatients: false,
    hasConflicts: false,
    conflictNotes: '',
    documentSummary: `Document processed successfully via clinical document engine (${documentType}).`,
  };
}

export async function extractMedicalDocument(
  fileBuffer: Buffer,
  mimeType: string,
  originalFilename: string
): Promise<MedicalExtractionResult> {
  const cleanMime = mimeType.toLowerCase();
  if (!ALLOWED_MIME_TYPES.includes(cleanMime)) {
    throw new Error(
      `Unsupported file type "${mimeType}". Allowed formats: JPG, JPEG, PNG, and PDF.`
    );
  }

  if (!fileBuffer || fileBuffer.length === 0) {
    throw new Error('Uploaded file is empty or corrupted.');
  }

  if (fileBuffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error('File exceeds the 10 MB maximum allowed size.');
  }

  const ai = getGeminiClient();
  const base64Data = fileBuffer.toString('base64');
  const isPdf = cleanMime === 'application/pdf' || originalFilename.toLowerCase().endsWith('.pdf');

  // If PDF, extract embedded text stream for fast, robust processing and fallback
  let extractedPdfText = '';
  if (isPdf) {
    try {
      extractedPdfText = await tryExtractPdfText(fileBuffer);
    } catch {
      // Ignore text extraction failure and proceed with vision
    }
  }

  const candidateModels = ['gemini-3.7-flash', 'gemini-3.8-flash'];
  let lastError: any = null;
  let rawJsonText = '';

  // STRATEGY 1: If PDF has text, use fast text extraction with Gemini (uses ~1/100 compute, virtually immune to 503 vision spikes)
  if (extractedPdfText && extractedPdfText.length > 30) {
    for (const modelName of candidateModels) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const textPrompt = `Extract patient registration information from the text of this medical document (${originalFilename}):\n\n${extractedPdfText}\n\nApply strict clinical extraction rules and confidence scoring. Respond ONLY in valid JSON matching schema.`;
          const response = await ai.models.generateContent({
            model: modelName,
            contents: textPrompt,
            config: {
              systemInstruction: EXTRACTION_SYSTEM_INSTRUCTION,
              responseMimeType: 'application/json',
              temperature: 0.1,
            },
          });
          rawJsonText = response.text || '';
          if (rawJsonText) break;
        } catch (err: any) {
          lastError = err;
          const msg = err?.message || '';
          if (msg.includes('503') || msg.includes('429')) {
            await new Promise((r) => setTimeout(r, 1000 * attempt));
            continue;
          }
          break;
        }
      }
      if (rawJsonText) break;
    }
  }

  // STRATEGY 2: Multimodal vision extraction (for images or PDFs without raw text, or if text prompt was bypassed)
  if (!rawJsonText) {
    for (const modelName of candidateModels) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: [
              {
                inlineData: {
                  mimeType: cleanMime === 'image/jpg' ? 'image/jpeg' : cleanMime,
                  data: base64Data,
                },
              },
              {
                text: `Extract patient registration information from this uploaded medical document (${originalFilename}). Apply strict clinical extraction rules and confidence scoring. Respond ONLY in valid JSON.`,
              },
            ],
            config: {
              systemInstruction: EXTRACTION_SYSTEM_INSTRUCTION,
              responseMimeType: 'application/json',
              temperature: 0.1,
            },
          });

          rawJsonText = response.text || '';
          if (rawJsonText) break;
        } catch (err: any) {
          lastError = err;
          const msg = err?.message || '';
          if (msg.includes('503') || msg.includes('429')) {
            await new Promise((r) => setTimeout(r, 1200 * attempt));
            continue;
          }
          break;
        }
      }
      if (rawJsonText) break;
    }
  }

  // STRATEGY 3: Local clinical entity extractor fallback (if Gemini API is 503 or unreachable)
  if (!rawJsonText) {
    if (extractedPdfText && extractedPdfText.length > 20) {
      const localResult = localRuleBasedExtraction(extractedPdfText, originalFilename);
      if (localResult.fullName || localResult.mobileNumber || localResult.age) {
        return localResult;
      }
    }

    // Sanitize any raw JSON error string into a clear user-friendly message
    const rawMsg = lastError?.message || '';
    if (rawMsg.includes('503') || rawMsg.includes('high demand') || rawMsg.includes('UNAVAILABLE')) {
      throw new Error(
        'The AI document vision service is temporarily experiencing high hospital demand. Please try clicking "Analyze Document & Auto-Fill" again, or enter your details manually below.'
      );
    }
    if (rawMsg.includes('429') || rawMsg.includes('RESOURCE_EXHAUSTED')) {
      throw new Error(
        'AI rate limit reached. Please wait a moment and try again, or enter your details manually.'
      );
    }

    throw new Error(
      "We couldn't reliably read this document. Please upload a clearer image or enter your details manually."
    );
  }

  // Parse and validate strictly against schema
  let parsed: any;
  try {
    const cleaned = rawJsonText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    parsed = JSON.parse(cleaned);
  } catch {
    if (extractedPdfText && extractedPdfText.length > 20) {
      return localRuleBasedExtraction(extractedPdfText, originalFilename);
    }
    throw new Error(
      'The AI extraction engine returned an unreadable response format. Please try again or fill in the details manually.'
    );
  }

  return validateAndSanitizeResult(parsed);
}

function validateAndSanitizeResult(data: any): MedicalExtractionResult {
  const result: MedicalExtractionResult = {
    fullName: typeof data?.fullName === 'string' ? data.fullName.trim() : '',
    mobileNumber: typeof data?.mobileNumber === 'string' ? data.mobileNumber.trim() : '',
    email: typeof data?.email === 'string' ? data.email.trim() : '',
    age:
      typeof data?.age === 'number' && !isNaN(data.age) && data.age > 0 && data.age < 130
        ? Math.round(data.age)
        : null,
    dateOfBirth: typeof data?.dateOfBirth === 'string' ? data.dateOfBirth.trim() : '',
    gender: ['Male', 'Female', 'Other'].includes(data?.gender) ? data.gender : '',
    bloodGroup: typeof data?.bloodGroup === 'string' ? data.bloodGroup.trim() : '',
    emergencyContactName:
      typeof data?.emergencyContactName === 'string' ? data.emergencyContactName.trim() : '',
    emergencyContactPhone:
      typeof data?.emergencyContactPhone === 'string' ? data.emergencyContactPhone.trim() : '',
    allergies: Array.isArray(data?.allergies)
      ? data.allergies.filter((a: any) => typeof a === 'string' && a.trim().length > 0)
      : [],
    medicalConditions: Array.isArray(data?.medicalConditions)
      ? data.medicalConditions.filter((c: any) => typeof c === 'string' && c.trim().length > 0)
      : [],
    medications: Array.isArray(data?.medications)
      ? data.medications.filter((m: any) => typeof m === 'string' && m.trim().length > 0)
      : [],
    diagnoses: Array.isArray(data?.diagnoses)
      ? data.diagnoses.filter((d: any) => typeof d === 'string' && d.trim().length > 0)
      : [],
    documentType: [
      'prescription',
      'lab_report',
      'medical_report',
      'discharge_summary',
      'health_record',
      'other',
    ].includes(data?.documentType)
      ? data.documentType
      : 'other',
    confidence: sanitizeConfidence(data?.confidence),
    isUnclearOrBlurry: Boolean(data?.isUnclearOrBlurry),
    hasMultiplePatients: Boolean(data?.hasMultiplePatients),
    hasConflicts: Boolean(data?.hasConflicts),
    conflictNotes: typeof data?.conflictNotes === 'string' ? data.conflictNotes.trim() : '',
    documentSummary: typeof data?.documentSummary === 'string' ? data.documentSummary.trim() : '',
  };

  return result;
}

function sanitizeConfidence(conf: any): ExtractedConfidence {
  if (!conf || typeof conf !== 'object') {
    return {};
  }

  const cleanNum = (val: any): number | undefined => {
    if (typeof val === 'number' && !isNaN(val)) {
      return Math.min(1, Math.max(0, parseFloat(val.toFixed(2))));
    }
    return undefined;
  };

  return {
    fullName: cleanNum(conf.fullName),
    mobileNumber: cleanNum(conf.mobileNumber),
    email: cleanNum(conf.email),
    age: cleanNum(conf.age),
    dateOfBirth: cleanNum(conf.dateOfBirth),
    gender: cleanNum(conf.gender),
    bloodGroup: cleanNum(conf.bloodGroup),
    emergencyContactName: cleanNum(conf.emergencyContactName),
    emergencyContactPhone: cleanNum(conf.emergencyContactPhone),
    allergies: cleanNum(conf.allergies),
    medicalConditions: cleanNum(conf.medicalConditions),
    medications: cleanNum(conf.medications),
    diagnoses: cleanNum(conf.diagnoses),
  };
}
