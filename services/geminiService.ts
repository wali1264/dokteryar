
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
    return {};
  }
};

// Helper to ensure critical array fields exist to prevent UI crashes
const ensureArrays = (data: any, fields: string[]) => {
  const clean = { ...data };
  fields.forEach(field => {
    if (!clean[field] || !Array.isArray(clean[field])) {
      clean[field] = [];
    }
  });
  return clean;
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

    const result = safeParseJSON(response.text || "{}");
    return ensureArrays(result, ['recommendations']) as LabAnalysis;
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

    const result = safeParseJSON(response.text || "{}");
    return ensureArrays(result, ['findings']) as RadiologyAnalysis;
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

    const result = safeParseJSON(response.text || "{}");
    return ensureArrays(result, ['findings', 'recommendations']) as PhysicalExamAnalysis;
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

// --- SPECIALIZED DEPARTMENTS IMPLEMENTATION ---

// Generic internal helper for standard image+prompt tasks to ensure JSON safety
async function analyzeSpecialized(
  input: File | Blob | string | object, 
  prompt: string, 
  requiredArrays: string[] = ['findings', 'recommendations']
) {
  const parts: any[] = [];
  
  if (input instanceof File || input instanceof Blob) {
    const mediaPart = await fileToGenerativePart(input);
    parts.push(mediaPart);
  } else if (typeof input === 'object') {
    prompt += `\nData Context: ${JSON.stringify(input)}`;
  } else if (typeof input === 'string') {
    prompt += `\nContext: ${input}`;
  }

  parts.push({ text: prompt });

  const response = await callProxy({
    model: "gemini-2.5-flash",
    contents: [{ parts }],
    config: {}
  });

  const parsed = safeParseJSON(response.text || "{}");
  return ensureArrays(parsed, requiredArrays);
}

// 1. CARDIOLOGY
export const analyzeECG = async (image: File, context: string) => {
  const prompt = `You are a Cardiologist. Analyze this ECG image. Context: ${context}.
  RETURN RAW JSON ONLY (Persian values):
  {
    "type": "ecg",
    "findings": ["string"],
    "impression": "string",
    "severity": "normal" | "abnormal" | "critical",
    "metrics": { "rate": "string", "rhythm": "string", "intervals": "string" },
    "recommendations": ["string"]
  }`;
  return analyzeSpecialized(image, prompt);
};

export const analyzeHeartSound = async (audio: Blob) => {
  const prompt = `You are a Cardiologist. Analyze this Phonocardiogram audio.
  RETURN RAW JSON ONLY (Persian values):
  {
    "type": "sound",
    "findings": ["string"],
    "impression": "string",
    "severity": "normal" | "abnormal" | "critical",
    "metrics": { "rate": "string", "rhythm": "string" },
    "recommendations": ["string"]
  }`;
  return analyzeSpecialized(audio, prompt);
};

export const calculateCardiacRisk = async (profile: string) => {
  const prompt = `You are a Cardiologist. Calculate cardiovascular risk based on: ${profile}.
  RETURN RAW JSON ONLY (Persian values):
  {
    "type": "risk",
    "findings": ["Risk Factors..."],
    "impression": "Score (e.g. 15% 10-year risk)",
    "severity": "normal" | "abnormal" | "critical",
    "recommendations": ["Lifestyle changes...", "Medications..."]
  }`;
  return analyzeSpecialized(profile, prompt);
};

// 2. NEUROLOGY
export const analyzeNeurologyVideo = async (video: File, type: string) => {
  const prompt = `You are a Neurologist. Analyze this video for ${type} (tremor/gait/motion).
  RETURN RAW JSON ONLY (Persian values):
  {
    "type": "${type}",
    "findings": ["string"],
    "diagnosis": "string",
    "severity": "normal" | "abnormal" | "critical",
    "confidenceScore": "e.g. 85%",
    "recommendations": ["string"]
  }`;
  return analyzeSpecialized(video, prompt);
};

export const analyzeCognitiveSpeech = async (audio: Blob) => {
  const prompt = `You are a Neurologist/Psychiatrist. Analyze speech patterns for cognitive decline (Alzheimer's/Aphasia).
  RETURN RAW JSON ONLY (Persian values):
  {
    "type": "speech",
    "findings": ["Fluency...", "Vocabulary..."],
    "diagnosis": "string",
    "severity": "normal" | "abnormal" | "critical",
    "recommendations": ["string"]
  }`;
  return analyzeSpecialized(audio, prompt);
};

// 3. PSYCHOLOGY
export const analyzePsychologyImage = async (image: File) => {
  const prompt = `You are a Psychologist (Art Therapist). Analyze this drawing (e.g., Clock Drawing Test or House-Tree-Person).
  RETURN RAW JSON ONLY (Persian values):
  {
    "type": "art",
    "findings": ["string"],
    "interpretation": "string",
    "severity": "normal" | "concern" | "critical",
    "recommendations": ["string"]
  }`;
  return analyzeSpecialized(image, prompt);
};

export const analyzeDream = async (text: string) => {
  const prompt = `You are a Psychoanalyst and Traditional Dream Interpreter. Analyze this dream: "${text}".
  RETURN RAW JSON ONLY (Persian values):
  {
    "type": "dream",
    "findings": ["Symbolism..."],
    "interpretation": "Summary",
    "modernAnalysis": "Freudian/Jungian view",
    "traditionalAnalysis": "Ibn Sirin view",
    "severity": "normal",
    "recommendations": ["string"]
  }`;
  return analyzeSpecialized(text, prompt);
};

export const analyzeSentiment = async (audio: Blob) => {
  const prompt = `You are a Psychologist. Analyze voice tone and sentiment for mood disorders (Depression/Anxiety).
  RETURN RAW JSON ONLY (Persian values):
  {
    "type": "sentiment",
    "findings": ["Tone...", "Speed..."],
    "interpretation": "Mood assessment",
    "severity": "normal" | "concern" | "critical",
    "recommendations": ["string"]
  }`;
  return analyzeSpecialized(audio, prompt);
};

// 4. OPHTHALMOLOGY
export const analyzeOphthalmology = async (image: File, type: string) => {
  const prompt = `You are an Ophthalmologist. Analyze this eye image (${type}).
  RETURN RAW JSON ONLY (Persian values):
  {
    "type": "${type}",
    "findings": ["string"],
    "diagnosis": "string",
    "severity": "normal" | "abnormal" | "critical",
    "systemicIndicators": ["Signs of Diabetes/BP..."],
    "recommendations": ["string"]
  }`;
  return analyzeSpecialized(image, prompt, ['findings', 'systemicIndicators', 'recommendations']);
};

// 5. PEDIATRICS
export const analyzeBabyCry = async (audio: Blob) => {
  const prompt = `You are a Pediatrician. Analyze this baby cry audio. Identify cause (Hunger, Pain, Tiredness, Colic).
  RETURN RAW JSON ONLY (Persian values):
  {
    "type": "cry",
    "findings": ["Pitch...", "Pattern..."],
    "diagnosis": "Likely cause",
    "severity": "normal" | "concern" | "critical",
    "confidenceScore": "string",
    "recommendations": ["Soothing techniques..."]
  }`;
  return analyzeSpecialized(audio, prompt);
};

export const analyzeChildDevelopment = async (video: File) => {
  const prompt = `You are a Pediatrician. Analyze this video for child developmental milestones (Motor/Social).
  RETURN RAW JSON ONLY (Persian values):
  {
    "type": "development",
    "findings": ["Movement quality..."],
    "diagnosis": "Milestone assessment",
    "severity": "normal" | "concern" | "critical",
    "recommendations": ["string"]
  }`;
  return analyzeSpecialized(video, prompt);
};

export const calculateGrowthProjection = async (data: any) => {
  const prompt = `You are a Pediatrician. Calculate growth projection. Data: ${JSON.stringify(data)}.
  RETURN RAW JSON ONLY (Persian values):
  {
    "type": "growth",
    "findings": ["Percentiles..."],
    "diagnosis": "Growth Trajectory",
    "severity": "normal" | "concern",
    "confidenceScore": "Based on genetic potential",
    "recommendations": ["Nutrition..."]
  }`;
  return analyzeSpecialized(data, prompt);
};

// 6. ORTHOPEDICS
export const analyzeOrthopedics = async (image: File, type: string) => {
  const prompt = `You are an Orthopedist. Analyze this image (${type} - Posture/Joint).
  RETURN RAW JSON ONLY (Persian values):
  {
    "type": "${type}",
    "findings": ["string"],
    "diagnosis": "string",
    "severity": "normal" | "concern" | "critical",
    "angles": ["Cobb angle...", "Q-angle..."],
    "recommendations": ["Exercises...", "Ergonomics..."]
  }`;
  return analyzeSpecialized(image, prompt, ['findings', 'angles', 'recommendations']);
};

// 7. DENTISTRY
export const analyzeDentistry = async (image: File, type: string) => {
  const prompt = `You are a Dentist. Analyze this image (${type}).
  RETURN RAW JSON ONLY (Persian values):
  {
    "type": "${type}",
    "findings": ["Caries...", "Gum health..."],
    "diagnosis": "string",
    "severity": "normal" | "concern" | "critical",
    "toothNumbers": ["18", "24"...],
    "recommendations": ["string"]
  }`;
  return analyzeSpecialized(image, prompt, ['findings', 'toothNumbers', 'recommendations']);
};

// 8. GYNECOLOGY
export const analyzeGynecology = async (input: any, type: string) => {
  const prompt = `You are a Gynecologist. Analyze this ${type}. 
  RETURN RAW JSON ONLY (Persian values):
  {
    "type": "${type}",
    "findings": ["string"],
    "diagnosis": "string",
    "severity": "normal" | "concern" | "critical",
    "measurements": ["Size...", "Volume..."],
    "recommendations": ["string"]
  }`;
  return analyzeSpecialized(input, prompt, ['findings', 'measurements', 'recommendations']);
};

// 9. PULMONOLOGY
export const analyzePulmonology = async (input: any, type: string) => {
  const prompt = `You are a Pulmonologist. Analyze this ${type} (Audio/Video/Image).
  RETURN RAW JSON ONLY (Persian values):
  {
    "type": "${type}",
    "findings": ["string"],
    "diagnosis": "string",
    "severity": "normal" | "concern" | "critical",
    "metrics": ["Rate...", "Flow..."],
    "recommendations": ["string"]
  }`;
  return analyzeSpecialized(input, prompt, ['findings', 'metrics', 'recommendations']);
};

// 10. GASTROENTEROLOGY
export const analyzeGastroenterology = async (input: any, type: string) => {
  const prompt = `You are a Gastroenterologist and Nutritionist (Traditional). Analyze this ${type}.
  RETURN RAW JSON ONLY (Persian values):
  {
    "type": "${type}",
    "findings": ["string"],
    "diagnosis": "string",
    "severity": "normal" | "concern" | "critical",
    "mizaj": "Hot/Cold/Dry/Wet",
    "nutrients": ["Calories...", "Vitamins..."],
    "organ": "Stomach/Liver...",
    "recommendations": ["Diet...", "Herbs..."]
  }`;
  return analyzeSpecialized(input, prompt, ['findings', 'nutrients', 'recommendations']);
};

// 11. UROLOGY
export const analyzeUrology = async (input: any, type: string) => {
  const prompt = `You are a Urologist. Analyze this ${type}.
  RETURN RAW JSON ONLY (Persian values):
  {
    "type": "${type}",
    "findings": ["string"],
    "diagnosis": "string",
    "severity": "normal" | "concern" | "critical",
    "dipstickValues": [{"parameter": "pH", "value": "val", "status": "Normal/Abnormal"}],
    "stoneDetails": {"size": "mm", "location": "loc", "passability": "High/Low"},
    "kidneyFunction": {"gfr": "val", "stage": "stage", "mizaj": "string"},
    "recommendations": ["string"]
  }`;
  return analyzeSpecialized(input, prompt, ['findings', 'recommendations', 'dipstickValues']);
};

// 12. HEMATOLOGY
export const analyzeHematology = async (input: any, type: string) => {
  const prompt = `You are a Hematologist/Pathologist. Analyze this ${type}.
  RETURN RAW JSON ONLY (Persian values):
  {
    "type": "${type}",
    "findings": ["string"],
    "diagnosis": "string",
    "severity": "normal" | "concern" | "critical",
    "cellTypes": [{"name": "Cell", "count": "val", "status": "Normal"}],
    "markersTrend": [{"name": "Marker", "trend": "Up/Down", "significance": "string"}],
    "recommendations": ["string"]
  }`;
  return analyzeSpecialized(input, prompt, ['findings', 'cellTypes', 'markersTrend', 'recommendations']);
};

// 13. EMERGENCY
export const analyzeEmergency = async (input: any, type: string) => {
  const prompt = `You are an Emergency Physician. Analyze this ${type}.
  RETURN RAW JSON ONLY (Persian values):
  {
    "type": "${type}",
    "findings": ["string"],
    "diagnosis": "string",
    "severity": "normal" | "urgent" | "critical",
    "actions": ["Immediate Step 1", "Step 2"],
    "triageLevel": "ESI Level 1-5",
    "antidote": "If toxicology"
  }`;
  return analyzeSpecialized(input, prompt, ['findings', 'actions']);
};

// 14. GENETICS
export const analyzeGenetics = async (input: any, type: string) => {
  const prompt = `You are a Geneticist. Analyze this ${type}.
  RETURN RAW JSON ONLY (Persian values):
  {
    "type": "${type}",
    "findings": ["string"],
    "diagnosis": "string",
    "severity": "normal" | "concern" | "critical",
    "risks": [{"condition": "Name", "probability": "High/Low"}],
    "drugCompatibility": {"drug": "Name", "status": "Safe/Caution", "recommendation": "string"},
    "recommendations": ["string"]
  }`;
  return analyzeSpecialized(input, prompt, ['findings', 'risks', 'recommendations']);
};
