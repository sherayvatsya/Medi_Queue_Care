import { GoogleGenAI } from '@google/genai';
import { Router, Request, Response } from 'express';

export const apiRouter = Router();

// Initialize server-side Gemini client with user-agent header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Maps Grounding endpoint for Real-Time Hospital Surroundings, Emergency Routes & Nearby Pharmacies
apiRouter.post('/maps/grounding', async (req: Request, res: Response) => {
  try {
    const { query, latitude, longitude } = req.body;

    const userLat = typeof latitude === 'number' ? latitude : 28.5672;
    const userLng = typeof longitude === 'number' ? longitude : 77.2100;

    const searchQuery =
      query ||
      'What are the 24/7 pharmacies, emergency ambulance access points, metro stations, and parking zones around St. Jude Medical Center / AIIMS Delhi campus?';

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: searchQuery,
      config: {
        systemInstruction:
          'You are the official Hospital Maps & Live Grounding Assistant for St. Jude Medical Center / AIIMS Delhi. Provide clear, accurate hospital campus navigation, emergency gate access, nearby 24/7 pharmacies, blood banks, parking bay info, and metro transit links. Be concise, structured, and helpful.',
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude: userLat,
              longitude: userLng,
            },
          },
        },
      },
    });

    const text = response.text || '';
    const groundingChunks =
      response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    res.json({
      success: true,
      text,
      groundingChunks,
    });
  } catch (error: any) {
    console.error('Gemini Maps Grounding API error:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to retrieve Maps Grounding data.',
      text: 'Currently unable to fetch live Google Maps Grounding data. Please refer to the interactive hospital campus map.',
      groundingChunks: [],
    });
  }
});

// Pre-Triage AI Assistant
apiRouter.post('/triage/analyze', async (req: Request, res: Response) => {
  try {
    const { symptoms, department, patientAge, gender } = req.body;

    const prompt = `Patient: ${patientAge || 35}yo ${gender || 'Unknown'}. Department: ${department}. Symptoms: ${JSON.stringify(
      symptoms || []
    )}. Provide clinical pre-triage category (standard, priority, urgent_er, fast_track_lab), urgency justification, and 2 ICMR-compliant pre-consultation lab tests in 3 concise bullet points.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
    });

    res.json({
      success: true,
      analysis: response.text || 'Standard priority triage assigned.',
    });
  } catch (error: any) {
    console.error('Triage AI error:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to generate triage analysis.',
    });
  }
});
