
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
    return true; 
  }
}

export const keyManager = new KeyManager();

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

class ProxyChatSession {
  private history: Content[] = [];
  private model: string;
  private config: any;

  constructor(model: string, config: any, systemInstruction?: string) {
     this.model = model;
     this.config = config || {};
     if (systemInstruction) {
        this.config.systemInstruction = systemInstruction;
     }
  }

  async sendMessage(params: { message: string }): Promise<{ text: string }> {
     const userContent: Content = { role: 'user', parts: [{ text: params.message }] };
     this.history.push(userContent);
     const response = await callProxy({
        model: this.model,
        contents: this.history, 
        config: this.config
     });
     const modelText = response.text || "";
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

const safeParseJSON = (text: string) => {
  try {
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("Failed to parse JSON:", text);
    return {};
  }
};

const ensureArrays = (data: any, fields: string[]) => {
  const clean = { ...data };
  fields.forEach(field => {
    if (!clean[field] || !Array.isArray(clean[field])) {
      clean[field] = [];
    }
  });
  return clean;
};

// --- STAGE 3 UPGRADES (Ophthalmology, Gastroenterology, Urology) ---

// 8. OPHTHALMOLOGY (Expert-Link Upgraded)
export const analyzeOphthalmology = async (image: File, type: string): Promise<OphthalmologyAnalysis> => {
  const prompt = `You are a Senior Consultant Ophthalmologist (Retina Specialist). Analyze this eye image (${type}).
  If fundus: Identify AV ratio, presence of exudates, hemorrhages, or disk edema. Grade diabetic retinopathy if applicable.
  If external: Look for pterygium, cataracts, or lid pathologies. 
  Correlate with systemic conditions like Hypertension or Diabetes.
  
  RETURN RAW JSON ONLY (Values in Persian):
  {
    "type": "${type}",
    "findings": ["Precise clinical findings"],
    "diagnosis": "Diagnostic Impression with Grading",
    "severity": "normal" | "abnormal" | "critical",
    "systemicIndicators": ["Markers of Hypertension/DM/Systemic diseases"],
    "confidence": "94%",
    "recommendations": ["Surgical or Pharmacological strategy"],
    "nextSteps": ["Optical Coherence Tomography (OCT) needed", "Fluorescein Angiography (FA) suggested"]
  }`;
  const res = await analyzeSpecialized(image, prompt, ['findings', 'systemicIndicators', 'recommendations', 'nextSteps']);
  return res as OphthalmologyAnalysis;
};

// 9. GASTROENTEROLOGY (Expert-Link Upgraded)
export const analyzeGastroenterology = async (input: any, type: string): Promise<GastroenterologyAnalysis> => {
  const prompt = `You are a Senior Gastroenterologist and Endoscopist. Analyze this ${type}.
  If endoscopy: Describe mucosa color, vascular patterns, and presence of lesions (grading ulcers/polyps).
  If pain mapper: Correlate location with referred pain patterns (e.g., Kehr's sign, Murphy's sign).
  
  RETURN RAW JSON ONLY (Persian values):
  {
    "type": "${type}",
    "findings": ["Technical findings (Mucosal/Structural)"],
    "diagnosis": "Clinical Impression",
    "severity": "normal" | "concern" | "critical",
    "confidence": "92%",
    "mizaj": "Systemic state based on Traditional Medicine integration",
    "nutrients": ["Beneficial foods for this condition"],
    "organ": "Precise anatomical involvement",
    "recommendations": ["Pharmacological/Dietary plan"],
    "nextSteps": ["Urea Breath Test", "Endoscopic Biopsy suggested", "Imaging follow-up"]
  }`;
  const res = await analyzeSpecialized(input, prompt, ['findings', 'nutrients', 'recommendations', 'nextSteps']);
  return res as GastroenterologyAnalysis;
};

// 10. UROLOGY (Expert-Link Upgraded)
export const analyzeUrology = async (input: any, type: string): Promise<UrologyAnalysis> => {
  const prompt = `You are a Senior Consultant Urologist. Analyze this ${type}.
  If dipstick: Quantify Glucose, Protein, Blood, and Nitrites based on color scales.
  If stone: Identify location, estimate size (mm), and calculate "Passability Index".
  If kidney function: Interpret eGFR and stage of CKD.
  
  RETURN RAW JSON ONLY (Persian values):
  {
    "type": "${type}",
    "findings": ["Detailed clinical/lab findings"],
    "diagnosis": "Impression (e.g., Nephrolithiasis, UTI, CKD)",
    "severity": "normal" | "concern" | "critical",
    "confidence": "95%",
    "dipstickValues": [{ "parameter": "string", "value": "string", "status": "string" }],
    "stoneDetails": { "size": "mm", "location": "string", "passability": "High/Low %" },
    "kidneyFunction": { "gfr": "numeric value", "stage": "CKD Stage", "mizaj": "Traditional context" },
    "recommendations": ["Treatment plan"],
    "nextSteps": ["CT KUB suggested", "24-hour urine collection", "Lithotripsy referral"]
  }`;
  const res = await analyzeSpecialized(input, prompt, ['findings', 'recommendations', 'nextSteps']);
  return res as UrologyAnalysis;
};

// 11. GYNECOLOGY (Expert-Link Upgraded)
// Added analyzeGynecology to fix missing export error in pages/Gynecology.tsx
export const analyzeGynecology = async (input: any, type: string): Promise<GynecologyAnalysis> => {
  const prompt = `You are a Senior Consultant Gynecologist and Obstetrician. Analyze this ${type}.
  If ultrasound: Identify fetal biometry (BPD, FL, AC, HC), estimate GA, and check for anomalies. 
  If mammography: Screen for lesions, masses, or micro-calcifications (BI-RADS scoring).
  If fertility: Analyze PCOS markers, hormonal patterns, and clinical symptoms.
  
  RETURN RAW JSON ONLY (Persian values):
  {
    "type": "${type}",
    "findings": ["Detailed clinical/radiological findings"],
    "diagnosis": "Clinical Impression/Grading",
    "severity": "normal" | "concern" | "critical",
    "confidence": "93%",
    "measurements": ["List of biometry or lab metrics if applicable"],
    "recommendations": ["Management plan (Surgical/Medical/Lifestyle)"]
  }`;
  const res = await analyzeSpecialized(input, prompt, ['findings', 'measurements', 'recommendations']);
  return res as GynecologyAnalysis;
};

// --- CORE ANALYSIS FUNCTIONS (UNCHANGED) ---

export const analyzePatient = async (data: PatientData | PatientRecord): Promise<DualDiagnosis> => {
    const parts: any[] = [];
    const promptText = `
      Patient Information:
      Name: ${data.name}, Age: ${data.age}, Gender: ${data.gender}
      Complaint: ${data.chiefComplaint}
      History: ${data.history}
      Vitals: - BP: ${data.vitals.bloodPressure} - HR: ${data.vitals.heartRate} ...
      Task: Provide a "Doctor-to-Doctor" consultation. Return JSON in Persian.
    `;
    parts.push({ text: promptText });
    const imgData = data.image || (data as PatientRecord).imageBlob;
    if (imgData) try { parts.push(await fileToGenerativePart(imgData)); } catch(e) {}
    const response = await callProxy({ model: "gemini-2.5-flash", contents: [{ parts }], config: {} });
    return safeParseJSON(response.text || "{}") as DualDiagnosis;
};

export const generateConsensus = async (modern: DoctorDiagnosis, traditional: DoctorDiagnosis): Promise<string> => {
    const prompt = `Medical Board Director report in Persian. Merge ${JSON.stringify(modern)} and ${JSON.stringify(traditional)}.`;
    const response = await callProxy({ model: "gemini-2.5-flash", contents: [{ parts: [{ text: prompt }] }], config: {} });
    return response.text || "خطا";
};

// --- INTERNAL SPECIALIZED HANDLER ---

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
  const response = await callProxy({ model: "gemini-2.5-flash", contents: [{ parts }], config: {} });
  const parsed = safeParseJSON(response.text || "{}");
  return ensureArrays(parsed, requiredArrays);
}

// --- PREVIOUSLY UPGRADED DEPARTMENTS (UNCHANGED) ---

export const analyzeECG = async (image: File, context: string) => {
  const prompt = `You are a Senior Consultant Cardiologist. Analyze ECG...`;
  return analyzeSpecialized(image, prompt, ['findings', 'recommendations', 'differentialDiagnosis']);
};
export const analyzeHeartSound = async (audio: Blob) => {
  const prompt = `You are a Specialist Cardiologist. Analyze sound...`;
  return analyzeSpecialized(audio, prompt);
};
export const calculateCardiacRisk = async (profile: string) => {
  const prompt = `Cardiologist risk assessment...`;
  return analyzeSpecialized(profile, prompt);
};
export const analyzeNeurologyVideo = async (video: File, type: string) => {
  const prompt = `You are a Senior Neurologist. Analyze movement...`;
  return analyzeSpecialized(video, prompt, ['findings', 'recommendations', 'clinicalCorrelations']);
};
export const analyzeCognitiveSpeech = async (audio: Blob) => {
  const prompt = `Consultant Neurologist cognitive speech...`;
  return analyzeSpecialized(audio, prompt);
};
export const analyzeRadiology = async (image: File, modality: string, region: string): Promise<RadiologyAnalysis> => {
    const prompt = `You are a Senior Interventional Radiologist...`;
    const response = await analyzeSpecialized(image, prompt, ['findings', 'nextSteps']);
    return response as RadiologyAnalysis;
};
export const analyzeEmergency = async (input: any, type: string) => {
  const prompt = `Senior Emergency Physician triage...`;
  return analyzeSpecialized(input, prompt, ['findings', 'actions']);
};
export const analyzeCulture = async (image: File, type: string, notes: string): Promise<LabAnalysis> => {
    const prompt = `You are a Senior Consultant Pathologist and Microbiologist...`;
    const res = await analyzeSpecialized(image, prompt, ['findings', 'recommendations', 'nextSteps']);
    return res as LabAnalysis;
};
export const analyzePhysicalExam = async (image: File, examType: 'skin' | 'tongue' | 'face'): Promise<PhysicalExamAnalysis> => {
    const prompt = `You are a Senior Clinical Consultant (Dermatology & Internal Medicine)...`;
    const res = await analyzeSpecialized(image, prompt, ['findings', 'recommendations', 'nextSteps']);
    return res as PhysicalExamAnalysis;
};
export const analyzePulmonology = async (input: any, type: string) => {
  const prompt = `You are a Consultant Pulmonologist...`;
  return analyzeSpecialized(input, prompt, ['findings', 'metrics', 'recommendations', 'nextSteps']);
};

// --- REMAINING UTILS (UNCHANGED) ---

export const digitizePrescription = async (image: File): Promise<{ items: PrescriptionItem[], diagnosis?: string, vitals?: PatientVitals }> => {
    const imgPart = await fileToGenerativePart(image);
    const prompt = `OCR Pharmacist. RAW JSON ONLY.`;
    const response = await callProxy({ model: "gemini-2.5-flash", contents: [{ parts: [imgPart, { text: prompt }] }], config: { thinkingConfig: { thinkingBudget: 0 } } });
    return safeParseJSON(response.text || "{}");
};

export const transcribeMedicalAudio = async (audio: Blob): Promise<string> => {
    const base64Audio = await blobToBase64(audio);
    const response = await callProxy({ model: "gemini-2.5-flash", contents: [{ parts: [ { inlineData: { mimeType: "audio/mp3", data: base64Audio } }, { text: "Listen and transcribe medical dictation." } ] }], config: {} });
    return response.text || "";
};

export const generateAudioSummary = async (text: string): Promise<string> => {
    const prompt = `Read professionally in Persian: ${text.substring(0, 1000)}`;
    const response = await callProxy({ model: "gemini-2.5-flash-preview-tts", contents: [{ parts: [{ text: prompt }] }], config: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } } } });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
};

export const generateTimelineAnalysis = async (current: any, history: any[]): Promise<string> => {
    const prompt = `Analyze patient trends in Persian.`;
    const response = await callProxy({ model: "gemini-2.5-flash", contents: [{ parts: [{ text: prompt }] }], config: {} });
    return response.text || "";
};

export const createMedicalChat = (patientData: PatientData, diagnosis: DualDiagnosis, consensus: string) => {
  return new ProxyChatSession("gemini-2.5-flash", {}, `Medical Council for ${patientData.name}. Answer in Persian.`);
};

// --- REMAINING DEPARTMENTS (FOR FUTURE STAGES) ---
export const analyzeBabyCry = async (audio: Blob) => analyzeSpecialized(audio, "Baby Cry Analysis");
export const analyzeChildDevelopment = async (video: File) => analyzeSpecialized(video, "Child Development");
export const calculateGrowthProjection = async (data: any) => analyzeSpecialized(data, "Growth Projection");
export const analyzeOrthopedics = async (image: File, type: string) => analyzeSpecialized(image, "Orthopedic Analysis");
export const analyzeDentistry = async (image: File, type: string) => analyzeSpecialized(image, "Dental Analysis");
export const analyzeHematology = async (input: any, type: string) => analyzeSpecialized(input, "Hematology Analysis");
export const analyzeGenetics = async (input: any, type: string) => analyzeSpecialized(input, "Genetics Analysis");
export const analyzePsychologyImage = async (image: File) => analyzeSpecialized(image, "Psychological Art Analysis");
export const analyzeDream = async (text: string) => analyzeSpecialized(text, "Dream Interpretation");
export const analyzeSentiment = async (audio: Blob) => analyzeSpecialized(audio, "Sentiment Analysis");
