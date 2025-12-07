import { GoogleGenAI } from "@google/genai";
import { ChatMessage } from '../types';

let genAI: GoogleGenAI | null = null;

const getGenAI = (): GoogleGenAI => {
  if (!genAI) {
    if (!process.env.API_KEY) {
      console.error("API_KEY is missing from environment variables.");
      throw new Error("API Key not found");
    }
    genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return genAI;
};

export const sendMessageToGemini = async (
  history: ChatMessage[],
  newMessage: string
): Promise<string> => {
  try {
    const ai = getGenAI();
    
    // Convert our internal history format to what Gemini expects if needed,
    // but for simple single-turn or short context, we can just concat or use chat session.
    // Here we use a fresh generateContent for simplicity with system instruction context.
    
    const systemInstruction = `
      You are "Gaia", a planetary intelligence system visualizing Earth's data.
      The user is looking at a 3D globe with neon blue lights representing landmass and population centers.
      The aesthetic is dark, cyberpunk, and futuristic.
      Keep responses concise, analytical, and consistent with a high-tech AI persona.
      If asked about the map, describe the "Data Aurora" covering the continents.
    `;

    // Construct a prompt that includes recent context
    const conversationContext = history.slice(-5).map(m => `${m.role}: ${m.text}`).join('\n');
    const fullPrompt = `${conversationContext}\nuser: ${newMessage}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: fullPrompt,
      config: {
        systemInstruction: systemInstruction,
        thinkingConfig: { thinkingBudget: 0 } // Speed over deep thought for UI chat
      }
    });

    return response.text || "I am unable to process that data stream.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Connection to planetary uplink failed. Please check your API key.";
  }
};