
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
      
      Task: Provide a "Doctor-to-Doctor" specialized consultation. You are two colleagues advising a physician:
      1. Senior Clinical Consultant (Modern Medicine):
         - Analyze data, identify trends, suggest differential diagnoses.
         - Provide a confidence score (0-100%).
         - Suggest pharmacological strategy.
      2. Integrative Lifestyle Specialist (Traditional Medicine - Hakim):
         - Focus on "The Six Essential Principles" (Lifestyle).
         - Provide expert dietary advice (Beneficial vs Harmful foods).
         - Suggest supportive herbal supplements that won't interfere with modern treatment.
      
      TONE: Professional, collaborative, colleague-to-colleague.
      
      CRITICAL INSTRUCTION: 
      ALL OUTPUT TEXT MUST BE IN PERSIAN (FARSI).
      The structure must be JSON, but the values inside the JSON strings must be Persian.
      
      RETURN RAW JSON ONLY. NO MARKDOWN.
      {
        "modern": {
          "diagnosis": "عنوان تشخیص اصلی (Persian)",
          "confidence": "90%",
          "reasoning": "استدلال بالینی بر اساس شواهد (Persian)",
          "treatmentPlan": ["پیشنهاد استراتژی دارویی (Persian)"],
          "lifestyle": ["توصیه مراقبتی بالینی (Persian)"],
          "warnings": ["هشدارها و موارد اورژانسی (Persian)"]
        },
        "traditional": {
          "diagnosis": "تحلیل مزاجی و سیستمی (Persian)",
          "reasoning": "استدلال بر اساس مبانی طب سنتی (Persian)",
          "treatmentPlan": ["مکمل‌های گیاهی حمایتی (Persian)"],
          "lifestyle": ["اصلاح سته ضروریه (Persian)"],
          "warnings": ["پرهیزات غذایی جدی و بخور و نخورها (Persian)"]
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
    const response = await callProxy({ model: "gemini-2.5-flash", contents: [{ parts }], config: {} });
    const parsedData = safeParseJSON(response.text || "{}");
    if (!parsedData || !parsedData.modern || !parsedData.traditional) {
        throw new Error("Invalid or incomplete AI response structure.");
    }
    return parsedData as DualDiagnosis;
};

export const checkPrescriptionSafety = async (items: PrescriptionItem[], patientRecord: PatientRecord): Promise<any> => {
  const prompt = `
    Act as a Senior Clinical Pharmacologist and Patient Safety Officer.
    
    PATIENT PROFILE:
    - Name: ${patientRecord.name}, Age: ${patientRecord.age}, Gender: ${patientRecord.gender}
    - Medical History: ${patientRecord.history || 'None reported'}
    - Allergies: ${patientRecord.allergies || 'None reported'}
    - Current Vitals: BP: ${patientRecord.vitals.bloodPressure}, HR: ${patientRecord.vitals.heartRate}, Weight: ${patientRecord.vitals.weight}kg
    
    CURRENT PRESCRIPTION:
    ${items.map((it, i) => `${i+1}. ${it.drug} (${it.dosage}) - ${it.instruction}`).join('\n')}

    TASK: Perform a comprehensive safety audit.
    1. Drug-Drug Interactions: Check if drugs in the current prescription interact.
    2. Drug-History Interactions: Check if drugs are contraindicated given the patient's history (e.g., heart issues, renal state).
    3. Drug-Allergy Check: Ensure no drugs trigger known allergies.
    4. Vitals Correlation: Check if dosages or drugs are risky given current BP/HR.

    OUTPUT FORMAT: Return RAW JSON only in PERSIAN (values).
    Structure:
    {
      "status": "safe" | "warning" | "critical",
      "summary": "Short professional summary in Persian",
      "alerts": [
        {
          "severity": "critical" | "warning",
          "title": "Short title (Persian)",
          "description": "Detailed explanation (Persian)",
          "alternative": "Suggested safer alternative or dose adjustment (Persian)"
        }
      ]
    }
  `;
  const response = await callProxy({ model: "gemini-2.5-flash", contents: [{ parts: [{ text: prompt }] }], config: {} });
  return safeParseJSON(response.text || "{}");
};

export const generateConsensus = async (modern: DoctorDiagnosis, traditional: DoctorDiagnosis): Promise<string> => {
    const prompt = `
      Act as a Medical Board Director providing a final consultation report to the attending physician.
      Review these two consultant opinions:
      Modern Specialist: ${JSON.stringify(modern)}
      Integrative Specialist: ${JSON.stringify(traditional)}

      1. Identify Red Alerts: Check for drug-herb interactions or conflicting advice.
      2. Unified Strategy: Merge the pharmacological plan with dietary and lifestyle modifications into a single cohesive path.
      3. Colleague Brief: A brief professional summary of why this unified plan is best for the patient.
      
      Tone: High-level medical consultation.
      Output structured markdown in Persian.
    `;
    const response = await callProxy({ model: "gemini-2.5-flash", contents: [{ parts: [{ text: prompt }] }], config: {} });
    return response.text || "خطا در جمع‌بندی";
};

// --- SPECIALIZED DEPARTMENTS IMPLEMENTATION ---

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

export const analyzeECG = async (image: File, context: string) => {
  const prompt = `You are a Senior Consultant Cardiologist. Analyze this ECG image.
  Identify PR, QRS, and QT intervals. Look for rhythm abnormalities or ischemic changes.
  
  RETURN RAW JSON ONLY (Persian values):
  {
    "type": "ecg",
    "findings": ["string"],
    "impression": "Official Clinical Impression",
    "severity": "normal" | "abnormal" | "critical",
    "confidence": "95%",
    "metrics": { 
      "rate": "string", 
      "rhythm": "string", 
      "intervals": "string",
      "prInterval": "ms",
      "qrsComplex": "ms",
      "qtInterval": "ms"
    },
    "differentialDiagnosis": ["string"],
    "recommendations": ["Clinical next steps for the attending physician"]
  }`;
  return analyzeSpecialized(image, prompt, ['findings', 'recommendations', 'differentialDiagnosis']);
};

export const analyzeHeartSound = async (audio: Blob) => {
  const prompt = `You are a Specialist Cardiologist. Analyze this Phonocardiogram audio.
  Identify murmurs (S1-S4), gallops, or clicks.
  
  RETURN RAW JSON ONLY (Persian values):
  {
    "type": "sound",
    "findings": ["string"],
    "impression": "Impression",
    "severity": "normal" | "abnormal" | "critical",
    "confidence": "88%",
    "metrics": { "rate": "string", "rhythm": "string" },
    "recommendations": ["Next steps (e.g., Echo needed)"]
  }`;
  return analyzeSpecialized(audio, prompt);
};

export const calculateCardiacRisk = async (profile: string) => {
  const prompt = `You are a Cardiologist providing a risk assessment report.
  Calculate cardiovascular risk based on: ${profile}.
  
  RETURN RAW JSON ONLY (Persian values):
  {
    "type": "risk",
    "findings": ["Risk Factors..."],
    "impression": "Risk Score & Categorization",
    "severity": "normal" | "abnormal" | "critical",
    "confidence": "90%",
    "recommendations": ["Target-oriented clinical goals"]
  }`;
  return analyzeSpecialized(profile, prompt);
};

export const analyzeNeurologyVideo = async (video: File, type: string) => {
  const prompt = `You are a Senior Neurologist. Analyze this video for ${type} (tremor/gait/motion).
  Observe frequency, amplitude, and patterns. Correlate with common neurological disorders.
  
  RETURN RAW JSON ONLY (Persian values):
  {
    "type": "${type}",
    "findings": ["string"],
    "diagnosis": "Clinical Impression",
    "severity": "normal" | "abnormal" | "critical",
    "confidenceScore": "92%",
    "clinicalCorrelations": ["Correlate with PD/MS/etc."],
    "recommendations": ["Diagnostic next steps"]
  }`;
  return analyzeSpecialized(video, prompt, ['findings', 'recommendations', 'clinicalCorrelations']);
};

export const analyzeCognitiveSpeech = async (audio: Blob) => {
  const prompt = `You are a Consultant Neurologist specializing in cognitive disorders. Analyze speech patterns.
  
  RETURN RAW JSON ONLY (Persian values):
  {
    "type": "speech",
    "findings": ["string"],
    "diagnosis": "Impression",
    "severity": "normal" | "abnormal" | "critical",
    "confidenceScore": "85%",
    "recommendations": ["Further testing (e.g. MMSE)"]
  }`;
  return analyzeSpecialized(audio, prompt);
};

export const analyzeRadiology = async (image: File, modality: string, region: string): Promise<RadiologyAnalysis> => {
    const prompt = `You are a Senior Interventional Radiologist. Analyze this ${modality} of ${region}.
    Use standard medical grading where applicable (e.g., BI-RADS, PI-RADS, AO Classification).
    
    RETURN RAW JSON ONLY (Values in Persian):
    {
      "modality": "string",
      "region": "string",
      "findings": ["Technical findings"],
      "impression": "Primary Diagnosis/Impression",
      "severity": "normal" | "abnormal" | "critical",
      "anatomicalLocation": "precise anatomical sector",
      "confidence": "94%",
      "nextSteps": ["Colleague suggestion: further imaging or intervention"]
    }
    Tone: Formal Hospital Report.`;
    const response = await analyzeSpecialized(image, prompt, ['findings', 'nextSteps']);
    return response as RadiologyAnalysis;
};

export const analyzeEmergency = async (input: any, type: string) => {
  const prompt = `You are a Senior Emergency Physician. Analyze this ${type}.
  Perform triage assessment. Identify immediate life threats.
  
  RETURN RAW JSON ONLY (Persian values):
  {
    "type": "${type}",
    "findings": ["Clinical triage findings"],
    "diagnosis": "Working Diagnosis",
    "severity": "normal" | "urgent" | "critical",
    "confidence": "96%",
    "actions": ["Priority 1: Action", "Priority 2: Action"],
    "triageLevel": "ESI Level 1-5 / Color Code",
    "antidote": "Specific treatment if toxicology"
  }`;
  return analyzeSpecialized(input, prompt, ['findings', 'actions']);
};

export const analyzeCulture = async (image: File, type: string, notes: string): Promise<LabAnalysis> => {
    const prompt = `You are a Senior Consultant Pathologist and Microbiologist. Analyze this ${type} culture image.
    Identify colony morphology, presence of hemolysis, and lactose fermentation if applicable.
    Provide precise suspected organism and suggest empiric therapy guidelines.
    
    RETURN RAW JSON ONLY (Values in Persian):
    {
      "sampleType": "string",
      "visualFindings": "Dermatopathology or Microbiology findings in detail",
      "suspectedOrganism": "Probable Organism / Diagnostic Impression",
      "confidence": "91%",
      "recommendations": ["Suggested sensitivity testing (Antibiogram)", "Empiric options based on local resistance"],
      "nextSteps": ["Gram stain correlation", "Biochemical validation steps"],
      "severity": "low" | "medium" | "high"
    }
    Tone: Specialized Pathology Report.`;
    const res = await analyzeSpecialized(image, prompt, ['findings', 'recommendations', 'nextSteps']);
    return res as LabAnalysis;
};

export const analyzePhysicalExam = async (image: File, examType: 'skin' | 'tongue' | 'face'): Promise<PhysicalExamAnalysis> => {
    const prompt = `You are a Senior Clinical Consultant (Dermatology & Internal Medicine). 
    Analyze this physical exam image of the ${examType}.
    For skin: describe morphology (macule, papule, etc.), borders, and symmetry.
    For tongue: analyze coating, color, and systemic reflections.
    For face: assess sclera, skin tone, and distribution of signs.
    
    RETURN RAW JSON ONLY (Values in Persian):
    {
      "examType": "string",
      "findings": ["Precise clinical findings"],
      "diagnosis": "Dermatological or Systemic Clinical Impression",
      "severity": "low" | "medium" | "high",
      "traditionalAnalysis": "Detailed Mizaj correlation & Organic state",
      "confidence": "89%",
      "recommendations": ["Patient lifestyle/care advice"],
      "nextSteps": ["Clinical correlation with Labs", "Specific follow-up exam"]
    }
    Tone: Colleague-to-Colleague specialized consult.`;
    const res = await analyzeSpecialized(image, prompt, ['findings', 'recommendations', 'nextSteps']);
    return res as PhysicalExamAnalysis;
};

export const analyzePulmonology = async (input: any, type: string) => {
  const prompt = `You are a Consultant Pulmonologist. Analyze this ${type}.
  If audio: analyze cough frequency and resonance (Bronchial vs Croupy).
  If video: analyze respiratory rate, accessory muscle use, and chest excursion.
  If image: interpret spirometry volume-flow curves or radiological chest findings.
  
  RETURN RAW JSON ONLY (Persian values):
  {
    "type": "${type}",
    "findings": ["Detailed respiratory mechanics findings"],
    "diagnosis": "Clinical Pulmonary Impression",
    "severity": "normal" | "concern" | "critical",
    "confidence": "93%",
    "metrics": ["Calculated parameters (e.g. FEV1/FVC if spirometry, or RR)"],
    "recommendations": ["Pharmacological pulmonary strategy"],
    "nextSteps": ["Suggest HRCT, PFT, or Bronchoscopy if indicated"]
  }
  Tone: Specialized Lung Clinic Report.`;
  return analyzeSpecialized(input, prompt, ['findings', 'metrics', 'recommendations', 'nextSteps']);
};

export const analyzeOphthalmology = async (image: File, type: string) => {
  const prompt = `You are a Consultant Ophthalmologist. Analyze this eye image (${type}). Include confidence percentage.`;
  return analyzeSpecialized(image, prompt, ['findings', 'systemicIndicators', 'recommendations']);
};

export const analyzeBabyCry = async (audio: Blob) => {
  const prompt = `You are a Pediatrician translating baby cries. Include confidence score.`;
  return analyzeSpecialized(audio, prompt);
};

export const analyzeChildDevelopment = async (video: File) => {
  const prompt = `You are a Developmental Pediatrician. Analyze video. Include confidence.`;
  return analyzeSpecialized(video, prompt);
};

export const calculateGrowthProjection = async (data: any) => {
  const prompt = `You are a Pediatrician calculating growth trends. Include confidence score.`;
  return analyzeSpecialized(data, prompt);
};

export const analyzeOrthopedics = async (image: File, type: string) => {
  const prompt = `You are an Orthopedic Surgeon. Analyze ${type}. Include confidence score.`;
  return analyzeSpecialized(image, prompt, ['findings', 'angles', 'recommendations']);
};

export const analyzeDentistry = async (image: File, type: string) => {
  const prompt = `You are a Consultant Dentist. Analyze ${type}. Include confidence score.`;
  return analyzeSpecialized(image, prompt, ['findings', 'toothNumbers', 'recommendations']);
};

export const analyzeGynecology = async (input: any, type: string) => {
  const prompt = `You are a Consultant Gynecologist. Analyze ${type}. Include confidence score.`;
  return analyzeSpecialized(input, prompt, ['findings', 'measurements', 'recommendations']);
};

export const analyzeGastroenterology = async (input: any, type: string) => {
  const prompt = `You are a Gastroenterology Consultant. Analyze ${type}. Include confidence score.`;
  return analyzeSpecialized(input, prompt, ['findings', 'nutrients', 'recommendations']);
};

export const analyzeUrology = async (input: any, type: string) => {
  const prompt = `You are a Urology Consultant. Analyze ${type}. Include confidence score.`;
  return analyzeSpecialized(input, prompt, ['findings', 'recommendations', 'dipstickValues']);
};

export const analyzeHematology = async (input: any, type: string) => {
  const prompt = `You are a Hematology Specialist. Analyze ${type}. Include confidence score.`;
  return analyzeSpecialized(input, prompt, ['findings', 'cellTypes', 'markersTrend', 'recommendations']);
};

export const analyzeGenetics = async (input: any, type: string) => {
  const prompt = `You are a Clinical Geneticist. Analyze ${type}. Include confidence score.`;
  return analyzeSpecialized(input, prompt, ['findings', 'risks', 'recommendations']);
};

export const analyzePsychologyImage = async (image: File) => {
  const prompt = `You are a Clinical Psychologist. Analyze projective drawing. Include confidence.`;
  return analyzeSpecialized(image, prompt);
};

export const analyzeDream = async (text: string) => {
  const prompt = `Analyze dream from modern and traditional views.`;
  return analyzeSpecialized(text, prompt);
};

export const analyzeSentiment = async (audio: Blob) => {
  const prompt = `Analyze vocal sentiment for clinical markers.`;
  return analyzeSpecialized(audio, prompt);
};

export const digitizePrescription = async (image: File): Promise<{ items: PrescriptionItem[], diagnosis?: string, vitals?: PatientVitals }> => {
    const imgPart = await fileToGenerativePart(image);
    const prompt = `You are an expert OCR Pharmacist designed for ultra-fast, literal transcription.
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
}`;
    const response = await callProxy({ model: "gemini-2.5-flash", contents: [{ parts: [imgPart, { text: prompt }] }], config: { thinkingConfig: { thinkingBudget: 0 } } });
    return safeParseJSON(response.text || "{}");
};

/**
 * processDigitalPadAI
 * NEW INDEPENDENT AI FUNCTION for the Digital Pad feature.
 * Extracts patient identity, CC, and prescription items.
 */
export const processDigitalPadAI = async (image: File): Promise<{ 
  items: PrescriptionItem[], 
  diagnosis?: string, 
  vitals?: PatientVitals,
  patientName?: string,
  patientAge?: string,
  patientWeight?: string,
  patientGender?: 'male' | 'female',
  chiefComplaint?: string
}> => {
    const imgPart = await fileToGenerativePart(image);
    const prompt = `You are an expert AI Medical Scribe and OCR Pharmacist. 
Task: Transcribe this handwritten medical note and extract EVERYTHING in a structured format.

CRITICAL EXTRACTION PROTOCOL:
1. PATIENT IDENTITY: Look for name, age, gender (M/F or آقا/خانم), and weight.
2. CHIEF COMPLAINT: Look for the reason for the visit (CC) or patient's complaints.
3. PRESCRIPTION: Transcribe drugs exactly as written (Literal transcription).
   - DRUG NAMES: Exact literal transcription including strength.
   - INSTRUCTIONS: Literal transcription.
   - DOSAGE/QTY: Extract count (e.g., N=20).
4. DIAGNOSIS: Extract any medical impression or diagnosis written.

OUTPUT FORMAT: Return RAW JSON ONLY. No markdown.

JSON Structure:
{
  "patientName": "string or null",
  "patientAge": "string or null",
  "patientWeight": "string or null",
  "patientGender": "male" | "female" | null,
  "chiefComplaint": "string (Full transcribed complaints)",
  "diagnosis": "string (Transcribed diagnosis)",
  "items": [
    { "drug": "Exact Drug Name", "dosage": "Qty", "instruction": "Exact Instruction" }
  ],
  "vitals": {
    "bloodPressure": "string",
    "heartRate": "string",
    "temperature": "string",
    "spO2": "string",
    "bloodSugar": "string"
  }
}`;
    const response = await callProxy({ 
      model: "gemini-2.5-flash", 
      contents: [{ parts: [imgPart, { text: prompt }] }], 
      config: { thinkingConfig: { thinkingBudget: 0 } } 
    });
    return safeParseJSON(response.text || "{}");
};

export const transcribeMedicalAudio = async (audio: Blob): Promise<string> => {
    const base64Audio = await blobToBase64(audio);
    const response = await callProxy({
      model: "gemini-2.5-flash",
      contents: [{ parts: [ { inlineData: { mimeType: "audio/mp3", data: base64Audio } }, { text: "Listen and transcribe medical dictation exactly in Persian." } ] }],
      config: {}
    });
    return response.text || "";
};

export const processScribeAudio = async (audio: Blob): Promise<{ diagnosis: string, items: PrescriptionItem[] }> => {
    const base64Audio = await blobToBase64(audio);
    const prompt = `Act as an expert AI Medical Scribe for a high-end medical clinic. You will receive audio of a doctor dictating a diagnosis and a multi-item prescription.
    
    CRITICAL PROTOCOLS:
    1. EXTRACT DIAGNOSIS: Separate the medical diagnosis. Keep it in the language it was dictated in (Persian/Pashto/Dari/English).
    
    2. EXTRACT MEDICATIONS (MANDATORY FORMATTING):
       For each drug, fill the following fields:
       
       - DRUG NAME (Field 'drug'): Format exactly as "[Form Prefix] [Drug Name] [Strength/Concentration]".
         * Form Prefixes: Use these standard clinical abbreviations at the VERY BEGINNING: Cap (Capsule), Tab (Tablet), Syr (Syrup), Inj (Ampoule/Vial/Injection), Oint (Ointment), Drop (Drops), Cream, Gel, Spray, Susp (Suspension), Supp (Suppository).
         * Drug Name: Use the EXACT name dictated by the doctor (Brand name if said, Generic name if said).
         * Strength: Convert "milligram" to "mg", "microgram" to "mcg", "unit" to "IU". 
         * Example Output 1: "Cap Amoxicillin 500mg"
         * Example Output 2: "Syr Diphenhydramine"
         * Example Output 3: "Inj Neurobion"
         * Example Output 4: "Tab Aspirin 80mg"
       
       - QUANTITY (Field 'dosage'): MUST be formatted strictly as 'N=XX' where XX is the total count/number of units.
         * Example: "بیست عدد" -> "N=20"
         * Example: "سی تا" -> "N=30"
       
       - INSTRUCTIONS (Field 'instruction'): Keep in the EXACT language spoken (Persian, Pashto, Dari, or English).
         * Example: "هر ۸ ساعت مصرف شود" -> "هر ۸ ساعت مصرف شود"

    3. INTELLIGENT PARSING:
       - SELF-CORRECTION: Handle verbal corrections (e.g. "Amoxicillin 20... no wait, 30 tablets"). Use the FINAL intent.
       - NOISE FILTERING: Ignore background noise (crying, traffic, TV). Focus ONLY on the doctor's voice.
       - MULTI-LINGUAL: Understand Persian, Pashto, Dari, and English.
    
    OUTPUT: Return RAW JSON only.
    Structure:
    {
      "diagnosis": "The extracted diagnosis",
      "items": [
        { "drug": "Formatted Drug Name", "dosage": "N=XX", "instruction": "Spoken language instruction" }
      ]
    }
    `;
    const response = await callProxy({
      model: "gemini-2.5-flash",
      contents: [{ parts: [ { inlineData: { mimeType: "audio/mp3", data: base64Audio } }, { text: prompt } ] }],
      config: {}
    });
    return safeParseJSON(response.text || "{}");
};

export const generateAudioSummary = async (text: string): Promise<string> => {
    const prompt = `Read this summary professionally in Persian: ${text.substring(0, 1000)}`;
    const response = await callProxy({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: prompt }] }],
      config: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } } },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
};

export const generateTimelineAnalysis = async (current: any, history: any[]): Promise<string> => {
    const prompt = `Analyze patient trends between current visit and history records in Persian.`;
    const response = await callProxy({ model: "gemini-2.5-flash", contents: [{ parts: [{ text: prompt }] }], config: {} });
    return response.text || "عدم توانایی در تحلیل روند.";
};

export const createMedicalChat = (patientData: PatientData, diagnosis: DualDiagnosis, consensus: string) => {
  const systemContext = `You are the Medical Council for ${patientData.name}. Answer doctor questions in Persian.`;
  return new ProxyChatSession("gemini-2.5-flash", {}, systemContext);
};
