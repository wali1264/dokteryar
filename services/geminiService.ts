
import type { GenerateContentResponse, Chat, Part, Content } from "@google/genai";
import { DoctorDiagnosis, DualDiagnosis, LabAnalysis, PatientData, RadiologyAnalysis, PhysicalExamAnalysis, PatientRecord, CardiologyAnalysis, NeurologyAnalysis, PsychologyAnalysis, OphthalmologyAnalysis, PediatricsAnalysis, OrthopedicsAnalysis, DentistryAnalysis, GynecologyAnalysis, PulmonologyAnalysis, GastroenterologyAnalysis, UrologyAnalysis, HematologyAnalysis, EmergencyAnalysis, GeneticsAnalysis, PrescriptionItem, PatientVitals, ChatMessage } from "../types";

// --- Client-Side Key Stats Interface (Mocked for Proxy Mode) ---
export interface KeyStats {
  key: string;
  maskedKey: string;
  usageCount: number;
  errorCount: number;
  lastUsed: number;
  status: 'active' | 'cooldown';
}

// --- Key Manager (Proxy Stub) ---
// This class is kept to prevent breaking Layout.tsx which expects keyManager.getStatistics()
class KeyManager {
  public getStatistics(): KeyStats[] {
    return [{
      key: 'proxy',
      maskedKey: 'SERVER-SIDE-PROXY',
      usageCount: 999,
      errorCount: 0,
      lastUsed: Date.now(),
      status: 'active'
    }];
  }
  
  public hasKeys() {
    return true; // Always true as keys are on server
  }
}

export const keyManager = new KeyManager();

// --- PROXY CALLER FUNCTION ---
// This replaces the direct ai.models.generateContent call
async function callProxy(payload: { model: string; contents: any[]; config?: any }): Promise<any> {
  try {
    const response = await fetch('/api/proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Proxy Error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    
    // Add a helper getter for .text to mimic SDK behavior
    // The raw JSON won't have the getter method, so we inject the property if missing
    if (data && data.candidates && !data.text) {
        const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || "";
        data.text = text;
    }
    
    return data;
  } catch (error) {
    console.error("AI Proxy Call Failed:", error);
    throw error;
  }
}

// --- Helper: Chat Session Shim ---
// Since we can't use the SDK's chat object on client without a key, we mock it via proxy
class ProxyChatSession {
  private history: Content[] = [];
  private model: string;
  private config: any;

  constructor(model: string, config: any, systemInstruction?: string) {
     this.model = model;
     this.config = config || {};
     // If system instruction exists, we should conceptually treat it as context, 
     // but the API supports it in config.
     if (systemInstruction) {
        this.config.systemInstruction = systemInstruction;
     }
  }

  async sendMessage(params: { message: string }): Promise<{ text: string }> {
     // 1. Add user message
     const userContent: Content = { role: 'user', parts: [{ text: params.message }] };
     this.history.push(userContent);

     // 2. Call proxy with full history
     const response = await callProxy({
        model: this.model,
        contents: this.history, // Send full history
        config: this.config
     });

     // 3. Extract text
     const modelText = response.text || "";

     // 4. Add model response to history
     const modelContent: Content = { role: 'model', parts: [{ text: modelText }] };
     this.history.push(modelContent);

     return { text: modelText };
  }
}

const fileToGenerativePart = async (file: File | Blob) => {
  return new Promise<{ inlineData: { data: string; mimeType: string } }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
          const base64String = reader.result.split(',')[1];
          resolve({
            inlineData: {
              data: base64String,
              mimeType: file.type || 'image/jpeg',
            },
          });
      } else {
          reject(new Error("Failed to read file as base64 string"));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64String = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Safe JSON parser
const safeParseJSON = (text: string) => {
  try {
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("Failed to parse JSON:", text);
    // Return a dummy object structure to prevent UI crashes (undefined errors)
    return {
       findings: [],
       recommendations: [],
       actions: [],
       treatmentPlan: []
    };
  }
};

// --- CORE ANALYSIS FUNCTIONS ---

export const analyzePatient = async (data: PatientData | PatientRecord): Promise<DualDiagnosis> => {
    const parts: any[] = [];
    const promptText = `
      Patient Information:
      Name: ${data.name}, Age: ${data.age}, Gender: ${data.gender}
      Complaint: ${data.chiefComplaint}
      History: ${data.history}
      
      Vitals:
      - BP: ${data.vitals.bloodPressure}
      - HR: ${data.vitals.heartRate}
      - Temp: ${data.vitals.temperature}
      - RR: ${data.vitals.respiratoryRate}
      - SpO2: ${data.vitals.spO2}
      - Glucose: ${data.vitals.bloodSugar}
      - Weight: ${data.vitals.weight}kg
      
      Task: You are two expert doctors analyzing this patient simultaneously.
      1. A Modern Medical Specialist (Internal Medicine).
      2. A Master of Iranian Traditional Medicine (Hakim).
      
      CRITICAL INSTRUCTION: 
      ALL OUTPUT TEXT MUST BE IN PERSIAN (FARSI).
      The structure must be JSON, but the values inside the JSON strings must be Persian.
      
      RETURN RAW JSON ONLY. NO MARKDOWN.
      {
        "modern": {
          "diagnosis": "تشخیص (Persian)",
          "reasoning": "استدلال (Persian)",
          "treatmentPlan": ["طرح درمان (Persian)"],
          "lifestyle": ["سبک زندگی (Persian)"],
          "warnings": ["هشدارها (Persian)"]
        },
        "traditional": {
          "diagnosis": "تشخیص مزاج/اخلاط (Persian)",
          "reasoning": "استدلال (Persian)",
          "treatmentPlan": ["تدابیر گیاهی (Persian)"],
          "lifestyle": ["سته ضروریه (Persian)"],
          "warnings": ["پرهیزات (Persian)"]
        }
      }
    `;

    parts.push({ text: promptText });

    const imgData = data.image || (data as PatientRecord).imageBlob;
    if (imgData) {
      try {
        const imgPart = await fileToGenerativePart(imgData);
        parts.push(imgPart);
        parts.push({ text: "Also analyze the attached image of the patient for visual signs." });
      } catch(e) { console.warn("Failed to process image", e); }
    }

    const labData = data.labReport || (data as PatientRecord).labReportBlob;
    if (labData) {
      try {
        const labPart = await fileToGenerativePart(labData);
        parts.push(labPart);
        parts.push({ text: "Review the attached lab report." });
      } catch(e) { console.warn("Failed to process lab report", e); }
    }

    const response = await callProxy({
      model: "gemini-2.5-flash", 
      contents: [{ parts }], 
      config: {}
    });

    const parsedData = safeParseJSON(response.text || "{}");

    if (!parsedData || !parsedData.modern || !parsedData.traditional) {
        throw new Error("Invalid or incomplete AI response structure.");
    }

    return parsedData as DualDiagnosis;
};

export const generateConsensus = async (modern: DoctorDiagnosis, traditional: DoctorDiagnosis): Promise<string> => {
    const prompt = `
      Act as a Medical Board Director. Review these two opinions:
      Modern: ${JSON.stringify(modern)}
      Traditional: ${JSON.stringify(traditional)}

      1. Identify conflicts (e.g., drug-herb interactions).
      2. Create a unified, safe plan.
      3. Simulate a brief dialogue between the two doctors where they agree on the final path.
      
      Output structured markdown in Persian.
    `;

    const response = await callProxy({
      model: "gemini-2.5-flash",
      contents: [{ parts: [{ text: prompt }] }],
      config: {}
    });

    return response.text || "خطا در جمع‌بندی";
};

export const generateAudioSummary = async (text: string): Promise<string> => {
    const prompt = `Read this medical summary in a professional, reassuring Persian (Farsi) voice: ${text.substring(0, 1000)}`;

    const response = await callProxy({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio || "";
};

export const createMedicalChat = (patientData: PatientData, diagnosis: DualDiagnosis, consensus: string) => {
  const systemContext = `
    You are the "Smart Physician Medical Council". 
    You have analyzed patient: ${patientData.name}.
    
    Current Diagnosis Context:
    Modern View: ${diagnosis.modern.diagnosis}
    Traditional View: ${diagnosis.traditional.diagnosis}
    Consensus: ${consensus}

    Your goal is to answer the doctor's follow-up questions in Persian.
    Maintain a professional, collaborative tone.
  `;

  // Return local proxy chat instance
  // @ts-ignore - Mimics Chat interface partially
  return new ProxyChatSession("gemini-2.5-flash", {}, systemContext);
};

export const analyzeCulture = async (image: File, type: string, notes: string): Promise<LabAnalysis> => {
    const imgPart = await fileToGenerativePart(image);
    const prompt = `
      You are an expert Microbiologist. Analyze this image of a ${type} culture.
      Notes: ${notes}
      Identify colony morphology, hemolysis, lactose fermentation, and likely organism.
      
      RETURN RAW JSON ONLY (Values in Persian):
      {
        "sampleType": "string",
        "visualFindings": "string",
        "suspectedOrganism": "string",
        "recommendations": ["string"],
        "severity": "low" | "medium" | "high"
      }
    `;

    const response = await callProxy({
      model: "gemini-2.5-flash",
      contents: [{ parts: [imgPart, { text: prompt }] }],
      config: {}
    });

    return safeParseJSON(response.text || "{}") as LabAnalysis;
};

export const analyzeRadiology = async (image: File, modality: string, region: string): Promise<RadiologyAnalysis> => {
    const imgPart = await fileToGenerativePart(image);
    const prompt = `
      You are an expert Radiologist. Analyze this ${modality} of ${region}.
      Provide findings, impression, severity, and anatomical location.
      
      RETURN RAW JSON ONLY (Values in Persian):
      {
        "modality": "string",
        "region": "string",
        "findings": ["string"],
        "impression": "string",
        "severity": "normal" | "abnormal" | "critical",
        "anatomicalLocation": "string"
      }
    `;

    const response = await callProxy({
      model: "gemini-2.5-flash",
      contents: [{ parts: [imgPart, { text: prompt }] }],
      config: {}
    });

    return safeParseJSON(response.text || "{}") as RadiologyAnalysis;
};

export const analyzePhysicalExam = async (image: File, examType: 'skin' | 'tongue' | 'face'): Promise<PhysicalExamAnalysis> => {
    const imgPart = await fileToGenerativePart(image);
    const prompt = `
      Analyze this physical exam image. Type: ${examType}. 
      Return findings, diagnosis, severity, traditional analysis.
      
      RETURN RAW JSON ONLY (Values in Persian):
      {
        "examType": "string",
        "findings": ["string"],
        "diagnosis": "string",
        "severity": "low" | "medium" | "high",
        "traditionalAnalysis": "string",
        "recommendations": ["string"]
      }
    `;

    const response = await callProxy({
      model: "gemini-2.5-flash",
      contents: [{ parts: [imgPart, { text: prompt }] }],
      config: {}
    });

    return safeParseJSON(response.text || "{}") as PhysicalExamAnalysis;
};

export const digitizePrescription = async (image: File): Promise<{ items: PrescriptionItem[], diagnosis?: string, vitals?: PatientVitals }> => {
    const imgPart = await fileToGenerativePart(image);
    const prompt = `
      You are an expert OCR Pharmacist designed for ultra-fast, literal transcription.
      Task: Transcribe this prescription image EXACTLY as written.

      CRITICAL INSTRUCTIONS (NO DEVIATION):
      1. DRUG NAMES: Transcribe exactly as seen.
         - If Brand name is written, write Brand name.
         - If Generic name is written, write Generic name.
         - Do NOT normalize, correct, or translate drug names.
         - Include strength/concentration if visible.
      
      2. INSTRUCTIONS (SIG): Transcribe exactly as seen.
         - Do NOT translate to Persian.
         - Do NOT expand abbreviations.
         - Example: If text is "1x3", output "1x3". If "BID", output "BID".
         - Keep mathematical symbols like "X", "*", "#" exactly as is.

      3. DOSAGE: Extract the quantity/count (e.g., "N=20" -> "20", "#30" -> "30").

      4. OUTPUT: Return RAW JSON ONLY. No markdown formatting.
      
      JSON Structure:
      {
        "items": [
          { "drug": "Exact Drug Name", "dosage": "Qty", "instruction": "Exact Instruction" }
        ],
        "diagnosis": "string (if visible)",
        "vitals": {
          "bloodPressure": "string",
          "heartRate": "string",
          "temperature": "string",
          "spO2": "string",
          "weight": "string",
          "height": "string",
          "respiratoryRate": "string",
          "bloodSugar": "string"
        }
      }
    `;

    const response = await callProxy({
      model: "gemini-2.5-flash",
      contents: [{ parts: [imgPart, { text: prompt }] }],
      config: {
        thinkingConfig: { thinkingBudget: 0 } // Disable thinking for maximum speed
      }
    });

    return safeParseJSON(response.text || "{}");
};

export const transcribeMedicalAudio = async (audio: Blob): Promise<string> => {
    const base64Audio = await blobToBase64(audio);
    const response = await callProxy({
      model: "gemini-2.5-flash",
      contents: [{ parts: [
          { inlineData: { mimeType: "audio/mp3", data: base64Audio } },
          { text: "Listen to this medical dictation (Persian/Farsi). Transcribe it exactly in Persian." }
        ]
      }],
      config: {}
    });
    return response.text || "";
};

export const generateTimelineAnalysis = async (current: any, history: any[]): Promise<string> => {
    const prompt = `
      Analyze the patient's history to identify trends.
      Current Visit: ${JSON.stringify(current)}
      Past History: ${JSON.stringify(history)}
      Output a brief Persian report.
    `;
    const response = await callProxy({
        model: "gemini-2.5-flash",
        contents: [{ parts: [{ text: prompt }] }],
        config: {}
    });
    return response.text || "عدم توانایی در تحلیل روند.";
};

// --- SPECIALIZED IMPLEMENTATIONS ---

export const analyzeECG = async (image: File, context: string): Promise<CardiologyAnalysis> => {
  const imgPart = await fileToGenerativePart(image);
  const prompt = `Analyze this ECG image. Context: ${context}. Return RAW JSON (Persian values): { "type": "ecg", "findings": ["string"], "impression": "string", "severity": "normal"|"abnormal"|"critical", "metrics": { "rate": "string", "rhythm": "string", "intervals": "string" }, "recommendations": ["string"] }`;
  const response = await callProxy({ model: "gemini-2.5-flash", contents: [{ parts: [imgPart, { text: prompt }] }] });
  return safeParseJSON(response.text || "{}");
};

export const analyzeHeartSound = async (audio: Blob): Promise<CardiologyAnalysis> => {
  const audioPart = await fileToGenerativePart(audio);
  const prompt = `Analyze this heart sound (Phonocardiogram). Return RAW JSON (Persian): { "type": "sound", "findings": ["string"], "impression": "string", "severity": "normal"|"abnormal"|"critical", "recommendations": ["string"] }`;
  const response = await callProxy({ model: "gemini-2.5-flash", contents: [{ parts: [audioPart, { text: prompt }] }] });
  return safeParseJSON(response.text || "{}");
};

export const calculateCardiacRisk = async (profile: string): Promise<CardiologyAnalysis> => {
  const prompt = `Calculate 10-year ASCVD Risk based on: ${profile}. Return RAW JSON (Persian): { "type": "risk", "findings": ["string"], "impression": "string", "severity": "normal"|"abnormal"|"critical", "recommendations": ["string"] }`;
  const response = await callProxy({ model: "gemini-2.5-flash", contents: [{ parts: [{ text: prompt }] }] });
  return safeParseJSON(response.text || "{}");
};

export const analyzeNeurologyVideo = async (video: File, type: string): Promise<NeurologyAnalysis> => {
  const vidPart = await fileToGenerativePart(video);
  const prompt = `Analyze this neurology video for ${type} (tremor/gait). Return RAW JSON (Persian): { "type": "${type}", "findings": ["string"], "diagnosis": "string", "severity": "normal"|"abnormal"|"critical", "confidenceScore": "string", "recommendations": ["string"] }`;
  const response = await callProxy({ model: "gemini-2.5-flash", contents: [{ parts: [vidPart, { text: prompt }] }] });
  return safeParseJSON(response.text || "{}");
};

export const analyzeCognitiveSpeech = async (audio: Blob): Promise<NeurologyAnalysis> => {
  const audioPart = await fileToGenerativePart(audio);
  const prompt = `Analyze speech patterns for cognitive decline/aphasia. Return RAW JSON (Persian): { "type": "speech", "findings": ["string"], "diagnosis": "string", "severity": "normal"|"abnormal"|"critical", "recommendations": ["string"] }`;
  const response = await callProxy({ model: "gemini-2.5-flash", contents: [{ parts: [audioPart, { text: prompt }] }] });
  return safeParseJSON(response.text || "{}");
};

export const analyzePsychologyImage = async (image: File): Promise<PsychologyAnalysis> => {
  const imgPart = await fileToGenerativePart(image);
  const prompt = `Analyze this drawing (Art Therapy/CDT/HTP). Return RAW JSON (Persian): { "type": "art", "findings": ["string"], "interpretation": "string", "severity": "normal"|"concern"|"critical", "recommendations": ["string"] }`;
  const response = await callProxy({ model: "gemini-2.5-flash", contents: [{ parts: [imgPart, { text: prompt }] }] });
  return safeParseJSON(response.text || "{}");
};

export const analyzeDream = async (text: string): Promise<PsychologyAnalysis> => {
  const prompt = `Interpret this dream: "${text}". Provide Modern (Psychoanalytic) and Traditional (Spiritual) analysis. Return RAW JSON (Persian): { "type": "dream", "findings": ["string"], "interpretation": "string", "modernAnalysis": "string", "traditionalAnalysis": "string", "recommendations": ["string"] }`;
  const response = await callProxy({ model: "gemini-2.5-flash", contents: [{ parts: [{ text: prompt }] }] });
  return safeParseJSON(response.text || "{}");
};

export const analyzeSentiment = async (audio: Blob): Promise<PsychologyAnalysis> => {
  const audioPart = await fileToGenerativePart(audio);
  const prompt = `Analyze emotional tone/sentiment. Return RAW JSON (Persian): { "type": "sentiment", "findings": ["string"], "interpretation": "string", "severity": "normal"|"concern"|"critical", "recommendations": ["string"] }`;
  const response = await callProxy({ model: "gemini-2.5-flash", contents: [{ parts: [audioPart, { text: prompt }] }] });
  return safeParseJSON(response.text || "{}");
};

export const analyzeOphthalmology = async (image: File, type: string): Promise<OphthalmologyAnalysis> => {
  const imgPart = await fileToGenerativePart(image);
  const prompt = `Analyze this eye image (${type}). Return RAW JSON (Persian): { "type": "${type}", "findings": ["string"], "diagnosis": "string", "severity": "normal"|"abnormal"|"critical", "systemicIndicators": ["string"], "recommendations": ["string"] }`;
  const response = await callProxy({ model: "gemini-2.5-flash", contents: [{ parts: [imgPart, { text: prompt }] }] });
  return safeParseJSON(response.text || "{}");
};

export const analyzeBabyCry = async (audio: Blob): Promise<PediatricsAnalysis> => {
  const audioPart = await fileToGenerativePart(audio);
  const prompt = `Translate this baby cry. Return RAW JSON (Persian): { "type": "cry", "findings": ["string"], "diagnosis": "string", "severity": "normal"|"concern"|"critical", "confidenceScore": "string", "recommendations": ["string"] }`;
  const response = await callProxy({ model: "gemini-2.5-flash", contents: [{ parts: [audioPart, { text: prompt }] }] });
  return safeParseJSON(response.text || "{}");
};

export const analyzeChildDevelopment = async (video: File): Promise<PediatricsAnalysis> => {
  const vidPart = await fileToGenerativePart(video);
  const prompt = `Analyze child movement/behavior. Return RAW JSON (Persian): { "type": "development", "findings": ["string"], "diagnosis": "string", "severity": "normal"|"concern"|"critical", "recommendations": ["string"] }`;
  const response = await callProxy({ model: "gemini-2.5-flash", contents: [{ parts: [vidPart, { text: prompt }] }] });
  return safeParseJSON(response.text || "{}");
};

export const calculateGrowthProjection = async (data: any): Promise<PediatricsAnalysis> => {
  const prompt = `Calculate growth projection based on: ${JSON.stringify(data)}. Return RAW JSON (Persian): { "type": "growth", "findings": ["string"], "diagnosis": "string", "severity": "normal"|"concern"|"critical", "recommendations": ["string"] }`;
  const response = await callProxy({ model: "gemini-2.5-flash", contents: [{ parts: [{ text: prompt }] }] });
  return safeParseJSON(response.text || "{}");
};

export const analyzeOrthopedics = async (image: File, type: string): Promise<OrthopedicsAnalysis> => {
  const imgPart = await fileToGenerativePart(image);
  const prompt = `Analyze this orthopedic image (${type}). Return RAW JSON (Persian): { "type": "${type}", "findings": ["string"], "diagnosis": "string", "severity": "normal"|"concern"|"critical", "angles": ["string"], "recommendations": ["string"] }`;
  const response = await callProxy({ model: "gemini-2.5-flash", contents: [{ parts: [imgPart, { text: prompt }] }] });
  return safeParseJSON(response.text || "{}");
};

export const analyzeDentistry = async (image: File, type: string): Promise<DentistryAnalysis> => {
  const imgPart = await fileToGenerativePart(image);
  const prompt = `Analyze this dental image (${type}). Return RAW JSON (Persian): { "type": "${type}", "findings": ["string"], "diagnosis": "string", "severity": "normal"|"concern"|"critical", "toothNumbers": ["string"], "recommendations": ["string"] }`;
  const response = await callProxy({ model: "gemini-2.5-flash", contents: [{ parts: [imgPart, { text: prompt }] }] });
  return safeParseJSON(response.text || "{}");
};

export const analyzeGynecology = async (input: File | any, type: string): Promise<GynecologyAnalysis> => {
  const parts: any[] = [];
  let prompt = "";
  if (type === 'fertility') {
     prompt = `Analyze fertility/PCOS based on: ${JSON.stringify(input)}. Return RAW JSON (Persian): { "type": "fertility", "findings": ["string"], "diagnosis": "string", "severity": "normal"|"concern"|"critical", "recommendations": ["string"] }`;
  } else {
     const imgPart = await fileToGenerativePart(input as File);
     parts.push(imgPart);
     prompt = `Analyze this ${type} image. Return RAW JSON (Persian): { "type": "${type}", "findings": ["string"], "diagnosis": "string", "severity": "normal"|"concern"|"critical", "measurements": ["string"], "recommendations": ["string"] }`;
  }
  parts.push({ text: prompt });
  const response = await callProxy({ model: "gemini-2.5-flash", contents: [{ parts }] });
  return safeParseJSON(response.text || "{}");
};

export const analyzePulmonology = async (input: Blob | File, type: string): Promise<PulmonologyAnalysis> => {
  const part = await fileToGenerativePart(input);
  const prompt = `Analyze this pulmonary input (${type}). Return RAW JSON (Persian): { "type": "${type}", "findings": ["string"], "diagnosis": "string", "severity": "normal"|"concern"|"critical", "metrics": ["string"], "recommendations": ["string"] }`;
  const response = await callProxy({ model: "gemini-2.5-flash", contents: [{ parts: [part, { text: prompt }] }] });
  return safeParseJSON(response.text || "{}");
};

export const analyzeGastroenterology = async (input: File | string, type: string): Promise<GastroenterologyAnalysis> => {
  const parts: any[] = [];
  let prompt = "";
  if (typeof input === 'string') {
     prompt = `Analyze abdominal pain: ${input}. Return RAW JSON (Persian): { "type": "pain", "findings": ["string"], "diagnosis": "string", "severity": "normal"|"concern"|"critical", "organ": "string", "recommendations": ["string"] }`;
  } else {
     const imgPart = await fileToGenerativePart(input as File);
     parts.push(imgPart);
     prompt = `Analyze this GI image (${type}). Return RAW JSON (Persian): { "type": "${type}", "findings": ["string"], "diagnosis": "string", "severity": "normal"|"concern"|"critical", "mizaj": "string", "nutrients": ["string"], "recommendations": ["string"] }`;
  }
  parts.push({ text: prompt });
  const response = await callProxy({ model: "gemini-2.5-flash", contents: [{ parts }] });
  return safeParseJSON(response.text || "{}");
};

export const analyzeUrology = async (input: File | any, type: string): Promise<UrologyAnalysis> => {
  const parts: any[] = [];
  let prompt = "";
  if (type === 'function') {
     prompt = `Calculate Kidney Function/GFR: ${JSON.stringify(input)}. Return RAW JSON (Persian): { "type": "function", "findings": ["string"], "diagnosis": "string", "severity": "normal"|"concern"|"critical", "kidneyFunction": {"gfr": "string", "stage": "string", "mizaj": "string"}, "recommendations": ["string"] }`;
  } else {
     const imgPart = await fileToGenerativePart(input as File);
     parts.push(imgPart);
     prompt = `Analyze this urology image (${type}). Return RAW JSON (Persian): { "type": "${type}", "findings": ["string"], "diagnosis": "string", "severity": "normal"|"concern"|"critical", "dipstickValues": [{"parameter": "string", "value": "string", "status": "string"}], "stoneDetails": {"size": "string", "location": "string", "passability": "string"}, "recommendations": ["string"] }`;
  }
  parts.push({ text: prompt });
  const response = await callProxy({ model: "gemini-2.5-flash", contents: [{ parts }] });
  return safeParseJSON(response.text || "{}");
};

export const analyzeHematology = async (input: File | any, type: string): Promise<HematologyAnalysis> => {
  const parts: any[] = [];
  let prompt = "";
  if (type === 'markers') {
     prompt = `Analyze Tumor Markers: ${JSON.stringify(input)}. Return RAW JSON (Persian): { "type": "markers", "findings": ["string"], "diagnosis": "string", "severity": "normal"|"concern"|"critical", "markersTrend": [{"name": "string", "trend": "string", "significance": "string"}], "recommendations": ["string"] }`;
  } else {
     const imgPart = await fileToGenerativePart(input as File);
     parts.push(imgPart);
     prompt = `Analyze this blood/pathology image (${type}). Return RAW JSON (Persian): { "type": "${type}", "findings": ["string"], "diagnosis": "string", "severity": "normal"|"concern"|"critical", "cellTypes": [{"name": "string", "count": "string", "status": "string"}], "recommendations": ["string"] }`;
  }
  parts.push({ text: prompt });
  const response = await callProxy({ model: "gemini-2.5-flash", contents: [{ parts }] });
  return safeParseJSON(response.text || "{}");
};

export const analyzeEmergency = async (input: File | any, type: string): Promise<EmergencyAnalysis> => {
  const parts: any[] = [];
  let prompt = "";
  if (type === 'triage') {
     prompt = `Perform ESI Triage for: ${JSON.stringify(input)}. Return RAW JSON (Persian): { "type": "triage", "findings": ["string"], "diagnosis": "string", "severity": "normal"|"urgent"|"critical", "triageLevel": "string", "actions": ["string"] }`;
  } else {
     const imgPart = await fileToGenerativePart(input as File);
     parts.push(imgPart);
     prompt = `Analyze this emergency image (${type}). Return RAW JSON (Persian): { "type": "${type}", "findings": ["string"], "diagnosis": "string", "severity": "normal"|"urgent"|"critical", "antidote": "string", "actions": ["string"] }`;
  }
  parts.push({ text: prompt });
  const response = await callProxy({ model: "gemini-2.5-flash", contents: [{ parts }] });
  return safeParseJSON(response.text || "{}");
};

export const analyzeGenetics = async (input: File | any, type: string): Promise<GeneticsAnalysis> => {
  const parts: any[] = [];
  let prompt = "";
  if (type === 'report') {
     const imgPart = await fileToGenerativePart(input as File);
     parts.push(imgPart);
     prompt = `Analyze Genetics Report. Return RAW JSON (Persian): { "type": "report", "findings": ["string"], "diagnosis": "string", "severity": "normal"|"concern"|"critical", "risks": [{"condition": "string", "probability": "string"}], "recommendations": ["string"] }`;
  } else if (type === 'pharma') {
     prompt = `Analyze Pharmacogenetics for: ${JSON.stringify(input)}. Return RAW JSON (Persian): { "type": "pharma", "findings": ["string"], "diagnosis": "string", "severity": "normal"|"concern"|"critical", "drugCompatibility": {"drug": "string", "status": "string", "recommendation": "string"}, "recommendations": ["string"] }`;
  } else {
     prompt = `Analyze Family History: ${input}. Return RAW JSON (Persian): { "type": "family", "findings": ["string"], "diagnosis": "string", "severity": "normal"|"concern"|"critical", "risks": [{"condition": "string", "probability": "string"}], "recommendations": ["string"] }`;
  }
  parts.push({ text: prompt });
  const response = await callProxy({ model: "gemini-2.5-flash", contents: [{ parts }] });
  return safeParseJSON(response.text || "{}");
};
