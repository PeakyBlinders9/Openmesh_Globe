export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export interface GeminiConfig {
  temperature: number;
  topK: number;
  topP: number;
}
