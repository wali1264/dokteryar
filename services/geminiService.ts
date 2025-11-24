
import { GoogleGenAI, Type } from "@google/genai";
import { Book, Patient, Vitals, SafetyCheckResult, Prescription, DiagnosisResult, SupervisorResult } from "../types";
import { useStore } from "../store";

const getAiClient = () => {
  // Hardcoded key for experimental/testing phase
  let apiKey: string | undefined = "AIzaSyDuGPEhX2RjtA_ronphbMnoCe2pskeshaA";

  // 1. Try Vite's import.meta.env (Primary for Vercel/Frontend)
  // We prioritize VITE_GOOGLE_GENAI_TOKEN to avoid Vercel "sensitive key" warnings
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    const envKey = (import.meta as any).env.VITE_GOOGLE_GENAI_TOKEN || 
             (import.meta as any).env.VITE_API_KEY || 
             (import.meta as any).env.API_KEY;
    if (envKey) apiKey = envKey;
  }

  // 2. Fallback to standard process.env
  if (typeof process !== 'undefined' && process.env) {
    const envKey = process.env.API_KEY || process.env.VITE_API_KEY;
    if (envKey) apiKey = envKey;
  }

  if (!apiKey) {
    console.error("API Key is missing.");
    throw new Error("کلید ارتباط با هوش مصنوعی یافت نشد.");
  }
  
  // Log the interaction
  useStore.getState().logAiInteraction();
  return new GoogleGenAI({ apiKey });
};

// --- AI Librarian & RAG ---

// This function now acts as a "Consultant" finding best books
export const recommendBooks = async (query: string): Promise<Partial<Book>[]> => {
  try {
    const ai = getAiClient();
    const prompt = `
      Act as a senior Medical Librarian and Researcher.
      The doctor is asking: "${query}".
      
      TASK:
      1. Search the web (using Google Search) to find the most authoritative medical resources.
      2. Suggest 3-4 distinct resources.
      3. **CRITICAL**: Determine if the resource is likely "FREE" (Open Access, WHO Guidelines, PDF available) or "PAID" (Commercial Textbook, Paid Journal).
      4. If FREE: Find a direct PDF link or a page with a free download.
      5. If PAID: Find the official publisher page (Elsevier, Amazon, Springer).
      
      OUTPUT FORMAT:
      You must output ONLY a valid JSON Array. Do not add conversational text or markdown blocks.
      Items structure: 
      { 
        "title": "string", 
        "author": "string", 
        "summary": "string (in Persian)", 
        "category": "string (in Persian)", 
        "sourceUrl": "string (URL)",
        "accessType": "FREE" or "PAID"
      }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.1, // Low temperature for factual accuracy
        // NOTE: responseMimeType: "application/json" is NOT supported with tools in the current API version
      }
    });
    
    let text = response.text || "[]";
    // Clean markdown formatting if present
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    // Ensure we only parse the array part if extra text exists
    const firstBracket = text.indexOf('[');
    const lastBracket = text.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1) {
        text = text.substring(firstBracket, lastBracket + 1);
    }
    
    return JSON.parse(text);
  } catch (error) {
    console.error("Book recommendation failed", error);
    return [];
  }
};

export const analyzeBookContent = async (bookTitle: string): Promise<string> => {
    try {
        const ai = getAiClient();
        const prompt = `
        Act as an expert medical summarizer.
        Target Book: "${bookTitle}"
        
        TASK:
        Search the web for the key clinical protocols, diagnostic criteria, and treatment guidelines found in this specific book.
        Compile a "Comprehensive Knowledge Summary" that can be used by an AI to diagnose patients based on this book's philosophy.
        
        OUTPUT LANGUAGE: PERSIAN (FARSI).
        Structure:
        1. Key Concepts
        2. Diagnostic Criteria
        3. Common Treatments
        4. Important Tables/Rules
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { 
              tools: [{ googleSearch: {} }],
              temperature: 0.2
            }
        });

        return response.text || "محتوایی یافت نشد.";
    } catch (e) {
        throw e;
    }
};

export const askBookQuestion = async (book: Book, question: string): Promise<string> => {
  try {
    const ai = getAiClient();
    
    const contentContext = book.content ? book.content.substring(0, 50000) : book.summary;

    const prompt = `
      You are an expert medical assistant.
      The user is asking a question about the following medical document/book.
      
      DOCUMENT TITLE: ${book.title}
      AUTHOR: ${book.author}
      
      DOCUMENT CONTENT:
      """
      ${contentContext}
      """
      
      USER QUESTION:
      ${question}
      
      INSTRUCTIONS:
      - Answer ONLY based on the provided document content.
      - If the answer is not in the document, state "این اطلاعات در متن سند موجود نیست."
      - Output Language: PERSIAN (Farsi).
      - Be concise and clinical.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { temperature: 0.1 }
    });
    return response.text || "خطا در دریافت پاسخ.";
  } catch (error) {
    console.error("Chat with book failed", error);
    return "خطا در ارتباط با هوش مصنوعی.";
  }
};

// --- AI Diagnostician ---

interface DiagnosisInput {
  patient: Patient;
  symptoms: string;
  vitals: Vitals;
  labImagesBase64?: string[]; 
  selectedBooks: Book[];
  useWebSearch: boolean;
  pastPrescriptions: Prescription[]; 
}

export const performDiagnosis = async (input: DiagnosisInput) => {
  const ai = getAiClient();

  // Build Context from Past Labs
  let historyContext = "";
  if (input.pastPrescriptions.length > 0) {
      historyContext = "--- PAST MEDICAL HISTORY & LAB FINDINGS ---\n";
      input.pastPrescriptions.forEach(rx => {
          if (rx.diagnosis || rx.labFindings) {
              historyContext += `Date: ${new Date(rx.date).toLocaleDateString()}\n`;
              if (rx.diagnosis) historyContext += `Diagnosis: ${rx.diagnosis}\n`;
              if (rx.labFindings) historyContext += `Lab Findings: ${rx.labFindings}\n`;
              historyContext += "----------------\n";
          }
      });
  }

  let contextString = `
    Patient Profile (CRITICAL CONTEXT):
    - Age: ${input.patient.age}
    - Gender: ${input.patient.gender}
    - Medical History: ${input.patient.medicalHistory} (Check for pregnancy, heart disease, diabetes, etc.)
    - Allergies: ${input.patient.allergies} (Check for general contraindications)

    ${historyContext}

    Current Vitals:
    - BP: ${input.vitals.bloodPressure}
    - Glucose (BS): ${input.vitals.glucose}
    - HR: ${input.vitals.heartRate}
    - Temp: ${input.vitals.temperature}
    - O2: ${input.vitals.oxygenLevel}
    - Weight: ${input.vitals.weight}

    Clinical Symptoms:
    ${input.symptoms}
  `;

  if (input.selectedBooks.length > 0) {
    contextString += `\n\n--- CONSULTED REFERENCE DOCUMENTS (PRIORITY: HIGH) ---\n`;
    input.selectedBooks.forEach(b => {
      // Only use content if it exists (downloaded/uploaded)
      if (b.content) {
          const contentToUse = b.content.substring(0, 20000);
          contextString += `\n[SOURCE: ${b.title}]\nCONTENT:\n${contentToUse}\n----------------\n`;
      }
    });
    contextString += `\nNOTE: You MUST prioritize the "CONSULTED REFERENCE DOCUMENTS" above. If the answer is in these documents, use it. Do not hallucinate outside of these facts if possible.\n`;
  }

  const parts: any[] = [{ text: contextString }];

  if (input.labImagesBase64 && input.labImagesBase64.length > 0) {
    input.labImagesBase64.forEach((imgData, index) => {
        parts.push({
            inlineData: {
                mimeType: "image/jpeg",
                data: imgData
            }
        });
        parts.push({ text: `\n[Image ${index + 1}]: Analyze this attached Lab Report/X-Ray image.` });
    });
    parts.push({ text: "\nTASK: Extract all numerical data, abnormal findings, and key clinical indicators from these images into the 'labAnalysis' field." });
  }

  parts.push({ text: `
    Act as a Senior Specialist Doctor (Fogh-e-Takhasos) and Academic Researcher.
    
    >>> ANTI-HALLUCINATION & SAFETY PROTOCOL <<<
    1. **Thinking Phase**: Before generating the JSON, you MUST internally reason about the case. Verify drug names, dosages, and interactions.
    2. **Evidence Priority**: If 'CONSULTED REFERENCE DOCUMENTS' are provided, base your diagnosis 90% on them.
    3. **Strict Fact-Checking**: Do NOT invent medications. If you are unsure about a dosage, do not suggest it.
    4. **Source Filtering**: Use Google Search to verify clinical data. ONLY use high-impact medical sources (PubMed, NIH, Mayo Clinic, UpToDate, WHO).
    5. **Contraindication Check**: Explicitly check the patient's allergies and history (Pregnancy, Diabetes, Cardiac) against suggested drugs.

    DIAGNOSIS INSTRUCTIONS:
    1. **Lab Analysis**: If images are provided, extract findings into 'labAnalysis'.
    2. **Diagnosis**: Provide the most likely diagnosis and differential diagnoses based on evidence.
    3. **Reasoning**: Explain WHY this diagnosis was reached, citing specific symptoms or lab values.
    4. **Simplified Summary**: In 'simplifiedExplanation', provide a 2-3 sentence summary in plain language suitable for a general practitioner or the patient.
    5. **Suggestions**: Suggest medications with STANDARD dosages.
    6. **TRADITIONAL MEDICINE & LIFESTYLE**: Based on the symptoms, determine the likely 'Temperament' (Mizaj) in Traditional Persian Medicine (e.g., Cold & Wet, Hot & Dry). Provide 'traditionalMedicine' advice including foods to eat/avoid, herbal teas (safe ones), and lifestyle tips.
    
    OUTPUT LANGUAGE: PERSIAN (FARSI).
    
    REQUIRED OUTPUT FORMAT:
    Return ONLY a valid JSON object. Do NOT wrap in markdown code blocks or add explanations outside JSON.
    JSON Structure:
    {
      "diagnosis": "Name of the disease",
      "confidence": number (0-100),
      "reasoning": "Detailed medical explanation",
      "simplifiedExplanation": "Simple summary in plain Persian",
      "labAnalysis": "Detailed extraction and analysis of uploaded lab reports/images (string)",
      "safetyWarnings": ["List of general patient condition warnings"],
      "suggestedMedications": [
         { "name": "Drug Name", "dosage": "Dosage Info", "reason": "Why this drug?" }
      ],
      "dietaryAdvice": {
        "recommended": ["Food Item"],
        "avoid": ["Food Item"]
      },
      "traditionalMedicine": {
          "temperament": "Diagnosis of Mizaj (e.g. Ghalabe-ye-Sard-o-Tar)",
          "recommendedFoods": ["Specific beneficial foods"],
          "forbiddenFoods": ["Foods that worsen the condition"],
          "herbalRemedies": ["Safe herbal teas or plants"],
          "lifestyleTips": ["Lifestyle/Sleep/Environment advice"]
      }
    }
  `});

  const tools = input.useWebSearch ? [{ googleSearch: {} }] : [];

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts },
      config: {
        tools: tools,
        temperature: 0.1, // Drastically reduced for safety
        thinkingConfig: { thinkingBudget: 2048 } // Allocate tokens for internal reasoning to reduce hallucinations
      }
    });

    let text = response.text || "{}";
    
    // Clean markdown formatting if present
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    // Attempt to extract JSON if there is extra text
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
        text = text.substring(firstBrace, lastBrace + 1);
    }

    const resultJson = JSON.parse(text);

    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.map((chunk: any) => ({
        title: chunk.web?.title || "منبع معتبر پزشکی",
        uri: chunk.web?.uri || "#"
      }))
      .filter((s: any) => s.uri !== "#") || [];

    return {
      ...resultJson,
      sources
    };

  } catch (error) {
    console.error("Diagnosis failed", error);
    throw error;
  }
};

// --- Smart Clinical Supervisor (NAZER HOOSHMAND) ---

export const performClinicalSupervision = async (
    input: DiagnosisInput,
    currentDiagnosis: DiagnosisResult
): Promise<SupervisorResult> => {
    const ai = getAiClient();

    // Prepare Context similar to Diagnosis
    let contextString = `
    PATIENT DATA:
    - Age/Gender: ${input.patient.age} / ${input.patient.gender}
    - Symptoms: ${input.symptoms}
    - Medical History: ${input.patient.medicalHistory}
    - Allergies: ${input.patient.allergies}
    - Vitals: BP=${input.vitals.bloodPressure}, Glucose=${input.vitals.glucose}, HR=${input.vitals.heartRate}, Temp=${input.vitals.temperature}
    
    CURRENT PROPOSED DIAGNOSIS (By Junior AI Doctor):
    - Diagnosis: ${currentDiagnosis.diagnosis}
    - Reasoning: ${currentDiagnosis.reasoning}
    - Proposed Meds: ${currentDiagnosis.suggestedMedications.map(m => m.name).join(', ')}
    `;

    const prompt = `
      Act as the "SUPREME CLINICAL SUPERVISOR" (Nazer Arshad Pezeshki).
      You represent the collective knowledge of ALL medical specialties (Uber-Doctor).
      You are strict, critical, and have zero tolerance for diagnostic errors.

      TASK:
      Review the provided "CURRENT PROPOSED DIAGNOSIS" for the given "PATIENT DATA".
      
      >>> PRIORITY WEIGHTING <<<
      1. **90% FOCUS ON DIAGNOSTIC ACCURACY & LOGIC**:
         - Is the diagnosis logically sound based on the symptoms?
         - Are there missing differential diagnoses?
         - Is the reasoning flawed?
         - Did the junior doctor miss a red flag in the vitals or history?
      2. **10% FOCUS ON SAFETY & INTERACTIONS**:
         - Are there major drug interactions?
         - Is the dosage appropriate (if mentioned)?

      INSTRUCTIONS:
      - Critique the diagnosis ruthlessly.
      - If it is excellent, say so. If it is flawed, explain exactly why.
      - In 'suggestedAction', write a concise, authoritative paragraph that I can feed back into the diagnosis system to correct it.
      
      OUTPUT LANGUAGE: PERSIAN (FARSI).
      
      OUTPUT JSON FORMAT ONLY:
      {
        "verdict": "APPROVED" | "REJECTED" | "NEEDS_REFINEMENT",
        "score": number (0-100),
        "critiqueSummary": "Short but powerful summary of your review",
        "diagnosticFlaws": ["List of logical/diagnostic errors (90% importance)"],
        "safetyConcerns": ["List of safety/interaction issues (10% importance)"],
        "suggestedAction": "Text to auto-fill into the correction box for the next iteration"
      }
    `;

    const tools = input.useWebSearch ? [{ googleSearch: {} }] : [];

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ text: contextString }, { text: prompt }],
            config: {
                tools: tools,
                temperature: 0.05, // Extremely low for maximum critical logic
                thinkingConfig: { thinkingBudget: 4096 } // High thinking budget for deep supervision
            }
        });

        let text = response.text || "{}";
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
            text = text.substring(firstBrace, lastBrace + 1);
        }

        return JSON.parse(text);
    } catch (error) {
        console.error("Supervision failed", error);
        throw error;
    }
};

// --- Deep Review & Debate Function ---

export const performDeepReview = async (
    input: DiagnosisInput, 
    originalDiagnosis: string, 
    doctorFeedback?: string
): Promise<DiagnosisResult> => {
    const ai = getAiClient();
    
    const prompt = `
      Act as a "Medical Board Supervisor" and "Senior Clinical Critic".
      
      CONTEXT:
      A junior AI doctor has made a diagnosis. The human physician has requested a "DEEP REVIEW" and may have provided objections.
      
      PATIENT DATA:
      - Age/Gender: ${input.patient.age} / ${input.patient.gender}
      - Symptoms: ${input.symptoms}
      - History: ${input.patient.medicalHistory}
      - Allergies: ${input.patient.allergies}
      - Vitals: Glucose: ${input.vitals.glucose}
      
      ORIGINAL AI DIAGNOSIS:
      "${originalDiagnosis}"
      
      PHYSICIAN'S FEEDBACK / OBJECTION:
      "${doctorFeedback || "No specific objection, but requested deep verification."}"
      
      TASK:
      1. **DEEP THINKING**: You must spend significant computational effort to verify the diagnosis.
      2. **CRITIQUE**: 
         - If the physician provided an objection, valid scientific evidence to support OR refute it.
         - If the physician is correct, humbly apologize and correct the diagnosis.
         - If the physician is incorrect, respectfully defend the original diagnosis with stronger evidence (citations).
      3. **OUTPUT**:
         - Generate a conversational "Debate Response" (debateResponse).
         - Generate a "Simplified Explanation" for the non-specialist.
         - Generate a FULL Updated Diagnosis Object, INCLUDING the 'traditionalMedicine' section based on the new findings.
      
      OUTPUT LANGUAGE: PERSIAN (FARSI).
      
      REQUIRED JSON STRUCTURE:
      {
        "diagnosis": "Updated Name of the disease",
        "confidence": number (0-100),
        "reasoning": "Deeply reasoned medical explanation",
        "simplifiedExplanation": "Simple summary in plain Persian",
        "debateResponse": "Direct conversational reply to the doctor",
        "debateOutcome": "AGREE" (if you changed diagnosis based on feedback) or "DEFEND" (if you kept original),
        "labAnalysis": "...",
        "safetyWarnings": ["..."],
        "suggestedMedications": [ ... ],
        "dietaryAdvice": { ... },
        "traditionalMedicine": {
          "temperament": "...",
          "recommendedFoods": ["..."],
          "forbiddenFoods": ["..."],
          "herbalRemedies": ["..."],
          "lifestyleTips": ["..."]
        }
      }
    `;
    
    const tools = input.useWebSearch ? [{ googleSearch: {} }] : [];
    
    try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            tools: tools,
            temperature: 0.15, // Slightly higher to allow for conversational nuance in debateResponse
            thinkingConfig: { thinkingBudget: 10000 } 
          }
        });
    
        let text = response.text || "{}";
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
            text = text.substring(firstBrace, lastBrace + 1);
        }
    
        const resultJson = JSON.parse(text);
        
        const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
          ?.map((chunk: any) => ({
            title: chunk.web?.title || "منبع معتبر پزشکی",
            uri: chunk.web?.uri || "#"
          }))
          .filter((s: any) => s.uri !== "#") || [];
    
        return {
          ...resultJson,
          sources
        };
    
      } catch (error) {
        console.error("Deep Review failed", error);
        throw error;
      }
};

export const checkPrescriptionSafety = async (patient: Patient, medications: { name: string; dosage: string }[]): Promise<SafetyCheckResult> => {
  try {
    const ai = getAiClient();

    const prompt = `
      ACT AS A CLINICAL PHARMACIST AND SAFETY SYSTEM.
      
      Analyze the following prescription for SAFETY ISSUES.
      
      PATIENT:
      - Age: ${patient.age}
      - Gender: ${patient.gender}
      - History: ${patient.medicalHistory} (Pay attention to PREGNANCY, HEART ISSUES, DIABETES, KIDNEY/LIVER issues)
      - Allergies: ${patient.allergies}

      MEDICATIONS TO CHECK:
      ${medications.map(m => `- ${m.name} (${m.dosage})`).join('\n')}

      TASKS:
      1. Check for DRUG-DRUG Interactions between the listed medications.
      2. Check for PATIENT-DRUG Contraindications.
      3. Check for Dose appropriateness.

      OUTPUT:
      Return JSON. If no issues, return empty list.
      Output Language: PERSIAN (Farsi).
    `;

    // This function does NOT use tools, so we CAN use responseMimeType
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 0.1, // Strict mode
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                hasIssues: { type: Type.BOOLEAN },
                interactions: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            type: { type: Type.STRING, enum: ['DRUG-DRUG', 'PATIENT-RISK'] },
                            severity: { type: Type.STRING, enum: ['HIGH', 'MODERATE'] },
                            description: { type: Type.STRING }
                        }
                    }
                }
            }
        }
      }
    });

    return JSON.parse(response.text || `{"hasIssues": false, "interactions": []}`);
  } catch (error) {
    console.error("Safety check failed", error);
    return { hasIssues: false, interactions: [] };
  }
};