import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';

export const URGENT_KEYWORDS = [
  'chest pain',
  'सीने में दर्द',
  'seene me dard',
  'seene mein dard',
  'saans',
  'सांस',
  'breath',
  'behosh',
  'बेहोश',
  'unconscious',
  'bleeding',
  'खून',
];

export interface StructuredIntakeResult {
  name: string | null;
  age: number | null;
  symptoms: string[];
  duration: string | null;
  notes: string | null;
  urgent: boolean;
}

/**
 * Red-flag detection using plain keyword rule on the transcript (NOT by the LLM).
 * Lowercases the text and checks against URGENT_KEYWORDS.
 */
export function detectUrgency(transcript: string): boolean {
  if (!transcript || typeof transcript !== 'string') return false;
  const lower = transcript.toLowerCase();
  return URGENT_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const INTAKE_SYSTEM_PROMPT =
  "You are an OPD registration assistant. Extract only the following JSON from the patient's spoken text: {name: string|null, age: number|null, symptoms: string[], duration: string|null, notes: string|null}. Extract only what the patient actually said. Do not diagnose, do not suggest medicines, do not guess. If information is missing, use null (or an empty array for symptoms). Return only valid JSON, no extra text.";

// High-speed, responsive model tiering (gemini-3.5-flash delivers 4.5s response times)
const FAST_MODELS = ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-flash-lite-latest'];

/**
 * Execute a promise with a hard timeout
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operationName: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

/**
 * Call LLM to structure patient spoken transcript into standard fields.
 * Includes tiered fast models, strict timeout, and transparent error handling.
 * Does NOT save to database.
 */
export async function structureSpokenTranscript(
  transcript: string
): Promise<{ success: boolean; data?: StructuredIntakeResult; error?: string; status?: number }> {
  // Step 1: Urgency detection via keyword matching (strictly non-LLM)
  const urgent = detectUrgency(transcript);

  // Step 2: Call Gemini LLM with system prompt across prioritized fast models
  let lastError: any = null;

  for (const modelName of FAST_MODELS) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model: modelName,
          contents: transcript,
          config: {
            systemInstruction: INTAKE_SYSTEM_PROMPT,
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        }),
        15000,
        `Gemini call (${modelName})`
      );

      const rawText = (response.text || '').trim();
      const cleaned = rawText
        .replace(/^```(json)?/i, '')
        .replace(/```$/i, '')
        .trim();

      let parsed: any;
      try {
        parsed = JSON.parse(cleaned);
      } catch (parseErr) {
        console.error(`Failed to parse LLM JSON output from ${modelName}:`, rawText);
        lastError = parseErr;
        continue;
      }

      if (!parsed || typeof parsed !== 'object') {
        lastError = new Error('Invalid JSON structure returned by model');
        continue;
      }

      // Coerce and sanitize types
      const name = typeof parsed.name === 'string' && parsed.name.trim().length > 0 ? parsed.name.trim() : null;

      let age: number | null = null;
      if (typeof parsed.age === 'number' && !isNaN(parsed.age) && parsed.age > 0 && parsed.age < 130) {
        age = Math.round(parsed.age);
      } else if (typeof parsed.age === 'string') {
        const match = parsed.age.match(/\d+/);
        if (match) {
          const parsedNum = parseInt(match[0], 10);
          if (!isNaN(parsedNum) && parsedNum > 0 && parsedNum < 130) {
            age = parsedNum;
          }
        }
      }

      const symptoms: string[] = Array.isArray(parsed.symptoms)
        ? parsed.symptoms
            .filter((s: any) => typeof s === 'string' && s.trim().length > 0)
            .map((s: string) => s.trim())
        : [];

      const duration =
        typeof parsed.duration === 'string' && parsed.duration.trim().length > 0 ? parsed.duration.trim() : null;

      const notes =
        typeof parsed.notes === 'string' && parsed.notes.trim().length > 0 ? parsed.notes.trim() : null;

      const structuredResult: StructuredIntakeResult = {
        name,
        age,
        symptoms,
        duration,
        notes,
        urgent,
      };

      return {
        success: true,
        data: structuredResult,
      };
    } catch (err: any) {
      console.warn(`Model ${modelName} failed or timed out:`, err?.message || err);
      lastError = err;
      // Continue to next fallback model
    }
  }

  console.error('All Gemini model fallbacks exhausted for transcript structuring:', lastError);
  const isTimeout = lastError?.message && lastError.message.includes('timed out');
  return {
    success: false,
    error: isTimeout
      ? 'Gemini AI clinical analysis timed out. Please retry or enter details manually.'
      : 'Gemini AI clinical service is temporarily unavailable. Please retry in a moment.',
    status: isTimeout ? 504 : 502,
  };
}

/**
 * Direct server-side audio transcription & structuring via Gemini Multimodal.
 * Provides a resilient fallback whenever browser speech recognition faces network blocks.
 */
export async function transcribeAndStructureAudio(
  audioBuffer: Buffer,
  mimeType: string,
  preferredLanguage: string = 'hi-IN'
): Promise<{ success: boolean; data?: StructuredIntakeResult & { transcript: string }; error?: string }> {
  const base64Audio = audioBuffer.toString('base64');
  const langName =
    preferredLanguage === 'hi-IN' ? 'Hindi or Hinglish' : preferredLanguage.startsWith('pa') ? 'Punjabi' : 'Indian English';

  const prompt = `You are an expert bilingual Indian hospital OPD registration assistant.
Listen carefully to the patient speaking in ${langName}.
1. Transcribe what the patient spoke into a clear transcript string (preserve spoken Hindi/Punjabi/English words).
2. Extract the structured OPD intake fields:
- name: string or null
- age: number or null
- symptoms: array of string symptom names
- duration: string duration or null
- notes: additional clinical context or null

Return ONLY valid JSON with this exact shape:
{
  "transcript": "Exact transcription of spoken text",
  "name": "Patient Name or null",
  "age": 45,
  "symptoms": ["symptom1", "symptom2"],
  "duration": "duration or null",
  "notes": "notes or null"
}`;

  let lastError: any = null;

  for (const modelName of FAST_MODELS) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model: modelName,
          contents: [
            {
              inlineData: {
                mimeType: mimeType || 'audio/webm',
                data: base64Audio,
              },
            },
            prompt,
          ],
          config: {
            responseMimeType: 'application/json',
          },
        }),
        12000,
        `Gemini audio (${modelName})`
      );

      const raw = (response.text || '').trim();
      const cleaned = raw.replace(/^```(json)?/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(cleaned);

      const transcript = typeof parsed.transcript === 'string' ? parsed.transcript : '';
      const urgent = detectUrgency(transcript);

      let age: number | null = null;
      if (typeof parsed.age === 'number' && !isNaN(parsed.age) && parsed.age > 0 && parsed.age < 130) {
        age = Math.round(parsed.age);
      } else if (typeof parsed.age === 'string') {
        const match = parsed.age.match(/\d+/);
        if (match) age = parseInt(match[0], 10);
      }

      const symptoms: string[] = Array.isArray(parsed.symptoms)
        ? parsed.symptoms.filter((s: any) => typeof s === 'string' && s.trim().length > 0)
        : [];

      return {
        success: true,
        data: {
          transcript,
          name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : null,
          age,
          symptoms,
          duration: typeof parsed.duration === 'string' && parsed.duration.trim() ? parsed.duration.trim() : null,
          notes: typeof parsed.notes === 'string' && parsed.notes.trim() ? parsed.notes.trim() : null,
          urgent,
        },
      };
    } catch (err: any) {
      console.warn(`Audio model ${modelName} failed or timed out:`, err?.message || err);
      lastError = err;
    }
  }

  console.error('All Gemini audio model fallbacks exhausted:', lastError);
  return {
    success: false,
    error: 'Gemini audio transcription service is temporarily unavailable. Please retry or type your symptoms manually.',
  };
}
