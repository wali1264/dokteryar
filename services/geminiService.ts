
import { GoogleGenAI, Type } from "@google/genai";
import { Book, Patient, Vitals, SafetyCheckResult, Prescription } from "../types";
import { useStore } from "../store";

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found");
  // Log the interaction
  useStore.getState().logAiInteraction();
  return new GoogleGenAI({ apiKey });
};

// --- AI Librarian & RAG ---

// This function now acts as a "Consultant" finding best books
export const recommendBooks = async (query: string): Promise<Partial<Book>[]> => {
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
    You must output ONLY a valid JSON Array. Do not add conversational text.
    Items structure: 
    { 
      title, 
      author, 
      summary (in Persian), 
      category (in Persian), 
      sourceUrl (URL to download or buy),
      accessType: "FREE" or "PAID"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              author: { type: Type.STRING },
              summary: { type: Type.STRING },
              category: { type: Type.STRING },
              sourceUrl: { type: Type.STRING },
              accessType: { type: Type.STRING, enum: ['FREE', 'PAID'] }
            }
          }
        }
      }
    });
    
    let text = response.text || "[]";
    // Clean markdown formatting if present (common issue with search tools)
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    return JSON.parse(text);
  } catch (error) {
    console.error("Book recommendation failed", error);
    return [];
  }
};

export const analyzeBookContent = async (bookTitle: string): Promise<string> => {
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
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: { tools: [{ googleSearch: {} }] }
    });

    return response.text || "محتوایی یافت نشد.";
};

export const askBookQuestion = async (book: Book, question: string): Promise<string> => {
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

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt
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
  labImagesBase64?: string[]; // Changed from single string to array
  selectedBooks: Book[];
  useWebSearch: boolean;
  pastPrescriptions: Prescription[]; // New: Context Recall
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
    - HR: ${input.vitals.heartRate}
    - Temp: ${input.vitals.temperature}
    - O2: ${input.vitals.oxygenLevel}
    - Weight: ${input.vitals.weight}

    Clinical Symptoms:
    ${input.symptoms}
  `;

  if (input.selectedBooks.length > 0) {
    contextString += `\n\n--- CONSULTED REFERENCE DOCUMENTS (PRIORITY) ---\n`;
    input.selectedBooks.forEach(b => {
      // Only use content if it exists (downloaded/uploaded)
      if (b.content) {
          const contentToUse = b.content.substring(0, 20000);
          contextString += `\n[SOURCE: ${b.title}]\nCONTENT:\n${contentToUse}\n----------------\n`;
      }
    });
    contextString += `\nNOTE: Prioritize the information found in the "CONSULTED REFERENCE DOCUMENTS" above when forming your diagnosis.\n`;
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
    
    STRICT EVIDENCE-BASED MEDICINE RULES:
    1. **Source Filtering**: You MUST use Google Search to verify clinical data. ONLY use high-impact medical sources (PubMed, NIH, Mayo Clinic, Cleveland Clinic, UpToDate, WHO, Merck Manuals).
    2. **Ignore Noise**: Do NOT use blogs, forums, social media, or non-medical wiki pages. If a source is not reputable, discard it.
    3. **Fact-Checking**: If you make a specific medical claim or statistic, it must be grounded in a real source.

    DIAGNOSIS INSTRUCTIONS:
    1. **Safety First**: Explicitly check the patient's history and allergies. 
    2. **Lab Analysis**: If images are provided, extract findings into 'labAnalysis'.
    3. **Diagnosis**: Provide the most likely diagnosis and differential diagnoses based on evidence (and past history).
    4. **Deep Reasoning**: Connect symptoms and lab findings to specific reputable sources.
    5. **Suggestions**: Suggest medications with standard dosages.
    
    OUTPUT LANGUAGE: PERSIAN (FARSI).
    Format the output as JSON.
  `});

  const tools = input.useWebSearch ? [{ googleSearch: {} }] : [];

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: { parts },
      config: {
        tools: tools,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            diagnosis: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
            reasoning: { type: Type.STRING },
            labAnalysis: { type: Type.STRING, description: "Detailed extraction and analysis of uploaded lab reports/images." },
            safetyWarnings: { type: Type.ARRAY, items: { type: Type.STRING }, description: "General patient condition warnings" },
            suggestedMedications: { 
              type: Type.ARRAY, 
              items: { 
                type: Type.OBJECT, 
                properties: {
                  name: { type: Type.STRING },
                  dosage: { type: Type.STRING },
                  reason: { type: Type.STRING }
                }
              }
            },
            dietaryAdvice: {
              type: Type.OBJECT,
              properties: {
                recommended: { type: Type.ARRAY, items: { type: Type.STRING } },
                avoid: { type: Type.ARRAY, items: { type: Type.STRING } }
              }
            }
          }
        }
      }
    });

    const resultJson = JSON.parse(response.text || "{}");

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

export const checkPrescriptionSafety = async (patient: Patient, medications: { name: string; dosage: string }[]): Promise<SafetyCheckResult> => {
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

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
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
