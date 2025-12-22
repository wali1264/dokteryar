
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

// --- STAGE 5 FINAL UPGRADES (Dentistry, Genetics, Psychology) ---

// 15. DENTISTRY (Expert-Link Upgraded)
export const analyzeDentistry = async (image: File, type: string): Promise<DentistryAnalysis> => {
  const prompt = `You are a Senior Oral and Maxillofacial Surgeon. Analyze this dental image (${type}).
  If OPG/X-Ray: Identify impacted teeth, bone resorption levels, periapical lesions, and root anomalies.
  If Caries: Identify location by ISO tooth numbering system. 
  
  RETURN RAW JSON ONLY (Values in Persian):
  {
    "type": "${type}",
    "findings": ["Precise surgical/radiological findings"],
    "diagnosis": "Diagnostic Impression with clinical grading",
    "severity": "normal" | "concern" | "critical",
    "toothNumbers": ["Affected teeth in ISO system"],
    "confidence": "94%",
    "recommendations": ["Surgical/Medical/Prosthodontic strategy"],
    "nextSteps": ["CBCT needed", "Endodontic referral", "Biopsy suggested"]
  }`;
  const res = await analyzeSpecialized(image, prompt, ['findings', 'toothNumbers', 'recommendations', 'nextSteps']);
  return res as DentistryAnalysis;
};

// 16. GENETICS (Expert-Link Upgraded)
export const analyzeGenetics = async (input: any, type: string): Promise<GeneticsAnalysis> => {
  const prompt = `You are a Senior Medical Geneticist. Analyze this ${type}.
  If report: Interpret karyotype, NGS variants (Pathogenic/VUS), or penetrance.
  If family: Identify inheritance patterns (Autosomal Dominant, X-linked, etc.).
  
  RETURN RAW JSON ONLY (Persian values):
  {
    "type": "${type}",
    "findings": ["Genomic variants/Mutation findings"],
    "diagnosis": "Clinical Genetic Syndrome Impression",
    "severity": "normal" | "concern" | "critical",
    "confidence": "95%",
    "risks": [{ "condition": "Condition Name", "probability": "Percentage/Level" }],
    "inheritancePattern": "Mendelian pattern identified",
    "drugCompatibility": { "drug": "Name", "status": "Safe/Warning", "recommendation": "Dose adjustment" },
    "recommendations": ["Counseling strategy", "Prenatal screening info"],
    "nextSteps": ["WES suggested", "Family member screening", "Validation by Sanger"]
  }`;
  const res = await analyzeSpecialized(input, prompt, ['findings', 'risks', 'recommendations', 'nextSteps']);
  return res as GeneticsAnalysis;
};

// 17. PSYCHOLOGY (Expert-Link Upgraded)
export const analyzePsychologyImage = async (image: File): Promise<PsychologyAnalysis> => {
  const prompt = `You are a Senior Psychoanalyst and Cognitive Scientist. Analyze this psychological drawing (e.g., Clock Test, HTP, or Free Art).
  Identify markers of cognitive decline, defense mechanisms, and personality traits.
  
  RETURN RAW JSON ONLY (Values in Persian):
  {
    "type": "art",
    "findings": ["Visual psychological markers identified"],
    "interpretation": "Psychoanalytic Impression",
    "severity": "normal" | "concern" | "critical",
    "confidence": "88%",
    "moodMetrics": [{ "factor": "Anxiety/Depression/Cognition", "score": "Scale 1-10" }],
    "recommendations": ["Therapeutic approach (CBT/Psychodynamic)"],
    "nextSteps": ["MMSE screening", "Projective testing suggested"]
  }`;
  const res = await analyzeSpecialized(image, prompt, ['findings', 'moodMetrics', 'recommendations', 'nextSteps']);
  return res as PsychologyAnalysis;
};

export const analyzeDream = async (text: string): Promise<PsychologyAnalysis> => {
  const prompt = `You are a Specialist in Dream Interpretation (Merging Jungian Analysis with Traditional Context).
  Analyze this dream: ${text}.
  
  RETURN RAW JSON ONLY (Persian values):
  {
    "type": "dream",
    "findings": ["Symbolic elements identified"],
    "interpretation": "Subconscious integration summary",
    "modernAnalysis": "Jungian/Freudian perspective",
    "traditionalAnalysis": "Traditional/Spiritual perspective",
    "severity": "normal" | "concern" | "critical",
    "recommendations": ["Reflective practices"],
    "nextSteps": ["Dream journaling", "Focusing therapy"]
  }`;
  const res = await analyzeSpecialized(text, prompt, ['findings', 'recommendations']);
  return res as PsychologyAnalysis;
};

export const analyzeSentiment = async (audio: Blob): Promise<PsychologyAnalysis> => {
  const prompt = `You are a Senior Consultant in Affective Neuroscience. Analyze this patient's speech for sentiment and mood.
  Identify prosody, word choice patterns, and underlying emotional states.
  
  RETURN RAW JSON ONLY (Persian values):
  {
    "type": "sentiment",
    "findings": ["Acoustic/Linguistic markers"],
    "interpretation": "Mood State Summary (e.g., Euthymic, Dysthymic, Manic)",
    "severity": "normal" | "concern" | "critical",
    "confidence": "91%",
    "moodMetrics": [{ "factor": "Factor Name", "score": "0-100" }],
    "recommendations": ["Immediate intervention if needed", "Therapy suggestion"]
  }`;
  const res = await analyzeSpecialized(audio, prompt, ['findings', 'moodMetrics', 'recommendations']);
  return res as PsychologyAnalysis;
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
export const analyzeOphthalmology = async (image: File, type: string): Promise<OphthalmologyAnalysis> => {
  const prompt = `You are a Senior Consultant Ophthalmologist (Retina Specialist)...`;
  const res = await analyzeSpecialized(image, prompt, ['findings', 'systemicIndicators', 'recommendations', 'nextSteps']);
  return res as OphthalmologyAnalysis;
};
export const analyzeGastroenterology = async (input: any, type: string): Promise<GastroenterologyAnalysis> => {
  const prompt = `You are a Senior Gastroenterologist and Endoscopist...`;
  const res = await analyzeSpecialized(input, prompt, ['findings', 'nutrients', 'recommendations', 'nextSteps']);
  return res as GastroenterologyAnalysis;
};
export const analyzeUrology = async (input: any, type: string): Promise<UrologyAnalysis> => {
  const prompt = `You are a Senior Consultant Urologist...`;
  const res = await analyzeSpecialized(input, prompt, ['findings', 'recommendations', 'nextSteps']);
  return res as UrologyAnalysis;
};
export const analyzeGynecology = async (input: any, type: string): Promise<GynecologyAnalysis> => {
  const prompt = `You are a Senior Consultant Gynecologist and Obstetrician...`;
  const res = await analyzeSpecialized(input, prompt, ['findings', 'measurements', 'recommendations']);
  return res as GynecologyAnalysis;
};
export const analyzeBabyCry = async (audio: Blob): Promise<PediatricsAnalysis> => {
  const prompt = `You are a Senior Consultant Pediatrician. Analyze this baby cry sound...`;
  const res = await analyzeSpecialized(audio, prompt, ['findings', 'recommendations', 'nextSteps']);
  return res as PediatricsAnalysis;
};
export const analyzeChildDevelopment = async (video: File): Promise<PediatricsAnalysis> => {
  const prompt = `You are a Specialist in Developmental Pediatrics. Analyze this video...`;
  const res = await analyzeSpecialized(video, prompt, ['findings', 'recommendations', 'nextSteps']);
  return res as PediatricsAnalysis;
};
export const calculateGrowthProjection = async (data: any): Promise<PediatricsAnalysis> => {
  const prompt = `You are a Pediatric Endocrinologist. Analyze this growth data...`;
  const res = await analyzeSpecialized(data, prompt, ['findings', 'recommendations', 'nextSteps']);
  return res as PediatricsAnalysis;
};
export const analyzeHematology = async (input: any, type: string): Promise<HematologyAnalysis> => {
  const prompt = `You are a Senior Consultant Hematologist and Oncologist. Analyze this ${type}...`;
  const res = await analyzeSpecialized(input, prompt, ['findings', 'recommendations', 'nextSteps', 'cellTypes', 'markersTrend']);
  return res as HematologyAnalysis;
};
export const analyzeOrthopedics = async (image: File, type: string): Promise<OrthopedicsAnalysis> => {
  const prompt = `You are a Senior Orthopedic Surgeon. Analyze this ${type}...`;
  const res = await analyzeSpecialized(image, prompt, ['findings', 'recommendations', 'nextSteps', 'angles']);
  return res as OrthopedicsAnalysis;
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
