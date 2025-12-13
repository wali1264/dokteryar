
import { GoogleGenAI } from '@google/genai';

// --- Server-Side Key Manager ---
class ServerKeyManager {
  constructor() {
    this.keys = [];
    this.stats = new Map();
    this.index = 0;
    this.discoverKeys();
  }

  discoverKeys() {
    const foundKeys = [];
    if (process.env.API_KEY) foundKeys.push(process.env.API_KEY);
    
    // Scan for VITE_GOOGLE_GENAI_TOKEN_* even on server env
    for (const key in process.env) {
      if (key.startsWith('VITE_GOOGLE_GENAI_TOKEN')) {
        foundKeys.push(process.env[key]);
      }
    }
    
    // Remove duplicates
    this.keys = [...new Set(foundKeys)];
    console.log(`[Server Proxy] Loaded ${this.keys.length} API Keys.`);
  }

  getClient() {
    if (this.keys.length === 0) {
        throw new Error("No API Keys configured on server.");
    }
    const key = this.keys[this.index];
    return new GoogleGenAI({ apiKey: key });
  }

  rotate() {
    if (this.keys.length > 1) {
      this.index = (this.index + 1) % this.keys.length;
      console.log(`[Server Proxy] Rotating to Key Index: ${this.index}`);
    }
  }
}

// Global instance to persist across warm invocations
const keyManager = new ServerKeyManager();

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { model, contents, config } = req.body;

  if (!model || !contents) {
    return res.status(400).json({ error: 'Missing model or contents' });
  }

  let attempts = 0;
  const maxAttempts = Math.min(Math.max(2, keyManager.keys.length), 5);

  while (attempts < maxAttempts) {
    try {
      const ai = keyManager.getClient();
      
      // Call Google Gemini API
      const response = await ai.models.generateContent({
        model: model,
        contents: contents,
        config: config || {}
      });

      // Serialize response to send back to client
      // We extract the text/candidates to make it easier for client, 
      // but sending the full object preserves structure.
      // GoogleGenAI response object might have circular refs or be complex, 
      // so we rely on standard JSON serialization.
      
      return res.status(200).json(response);

    } catch (error) {
      attempts++;
      console.error(`[Proxy Error] Attempt ${attempts} failed:`, error.message);

      const isRetryable = error.message?.includes('429') || 
                          error.message?.includes('503') || 
                          error.status === 429 || 
                          error.status === 503 ||
                          error.message?.includes('Quota') ||
                          error.message?.includes('fetch failed');

      if (isRetryable && attempts < maxAttempts) {
        keyManager.rotate();
        await new Promise(r => setTimeout(r, 1000 * attempts)); // Backoff
        continue;
      }

      return res.status(500).json({ 
        error: 'AI Service Error', 
        details: error.message 
      });
    }
  }

  return res.status(503).json({ error: 'Service Unavailable (All keys exhausted)' });
}
