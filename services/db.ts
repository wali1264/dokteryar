
import { PatientRecord, PrescriptionTemplate, PrescriptionSettings, DoctorProfile, Drug, DrugUsage } from '../types';
import { supabase } from './supabase';

const DB_NAME = 'TabibHooshmandDB';
const STORE_NAME = 'patients';
const TEMPLATE_STORE = 'rx_templates';
const COMPLAINT_TEMPLATE_STORE = 'complaint_templates';
const SETTINGS_STORE = 'settings';
const PROFILE_STORE = 'doctor_profile';
const DRUG_STORE = 'drugs';
const USAGE_STORE = 'drug_usage';
const AUTH_STORE = 'auth_metadata'; 
const VERSION = 8; 

// Synchronous Security Lock Keys
const SYNC_LOCK_KEY = 'tabib_auth_hard_lock';
const SESSION_BIRTH_KEY = 'tabib_session_birth_ts';
const LAST_BACKUP_KEY = 'tabib_last_backup_ts';
const PENDING_BACKUP_KEY = 'tabib_pending_cloud_sync';

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = (event.target as IDBOpenDBRequest).transaction!;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      
      const patientStore = transaction.objectStore(STORE_NAME);
      if (!patientStore.indexNames.contains('name')) {
        patientStore.createIndex('name', 'name', { unique: false });
      }
      if (!patientStore.indexNames.contains('displayId')) {
        patientStore.createIndex('displayId', 'displayId', { unique: false });
      }
      if (!patientStore.indexNames.contains('visitDate')) {
        patientStore.createIndex('visitDate', 'visitDate', { unique: false });
      }

      if (!db.objectStoreNames.contains(TEMPLATE_STORE)) {
        db.createObjectStore(TEMPLATE_STORE, { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains(COMPLAINT_TEMPLATE_STORE)) {
        db.createObjectStore(COMPLAINT_TEMPLATE_STORE, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(PROFILE_STORE)) {
        db.createObjectStore(PROFILE_STORE, { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains(DRUG_STORE)) {
        db.createObjectStore(DRUG_STORE, { keyPath: 'id' });
      }
      const drugStore = transaction.objectStore(DRUG_STORE);
      if (!drugStore.indexNames.contains('name')) {
        drugStore.createIndex('name', 'name', { unique: false });
      }

      if (!db.objectStoreNames.contains(USAGE_STORE)) {
        db.createObjectStore(USAGE_STORE, { keyPath: 'drugName' });
      }

      if (!db.objectStoreNames.contains(AUTH_STORE)) {
        db.createObjectStore(AUTH_STORE, { keyPath: 'key' });
      }
    };

    request.onsuccess = async () => {
      const db = request.result;
      await seedMegaDrugBank(db);
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  });
};

// --- BACKUP & SYNC HELPERS ---

export const isDatabaseEmpty = async (): Promise<boolean> => {
  const db = await initDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.count();
    request.onsuccess = () => resolve(request.result === 0);
    request.onerror = () => resolve(true);
  });
};

export const updateLastBackupTime = () => {
  localStorage.setItem(LAST_BACKUP_KEY, Date.now().toString());
};

export const getLastBackupTime = (): number => {
  const ts = localStorage.getItem(LAST_BACKUP_KEY);
  return ts ? parseInt(ts) : 0;
};

// Hybrid Sync Queue Logic
export const savePendingBackup = (json: string) => {
  localStorage.setItem(PENDING_BACKUP_KEY, json);
};

export const getPendingBackup = (): string | null => {
  return localStorage.getItem(PENDING_BACKUP_KEY);
};

export const clearPendingBackup = () => {
  localStorage.removeItem(PENDING_BACKUP_KEY);
};

export const getOnlineBackupMetadata = async (userId: string): Promise<{ updatedAt: string | null }> => {
  const { data, error } = await supabase
    .from('backups')
    .select('updated_at')
    .eq('user_id', userId)
    .single();

  if (error || !data) return { updatedAt: null };
  return { updatedAt: data.updated_at };
};

export const uploadBackupOnline = async (userId: string, dataJson: string): Promise<void> => {
  // Validate structure before uploading to prevent cloud corruption
  try {
    const parsed = JSON.parse(dataJson);
    if (!parsed[STORE_NAME]) throw new Error("Invalid backup structure: Missing critical stores.");
  } catch (e) {
    console.error("Backup Validation Failed", e);
    throw new Error("Malformed backup data. Aborting upload.");
  }

  const { error } = await supabase
    .from('backups')
    .upsert({ 
      user_id: userId, 
      backup_data: JSON.parse(dataJson),
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

  if (error) throw error;
};

export const fetchOnlineBackup = async (userId: string): Promise<string | null> => {
  const { data, error } = await supabase
    .from('backups')
    .select('backup_data')
    .eq('user_id', userId)
    .single();

  if (error) return null;
  return JSON.stringify(data.backup_data);
};

// --- AUTH PERSISTENCE HELPERS ---

export const setAuthHardLock = (locked: boolean) => {
  if (locked) localStorage.setItem(SYNC_LOCK_KEY, 'true');
  else localStorage.removeItem(SYNC_LOCK_KEY);
};

export const isAuthHardLocked = (): boolean => {
  return localStorage.getItem(SYNC_LOCK_KEY) === 'true';
};

export const setSessionBirth = () => {
  localStorage.setItem(SESSION_BIRTH_KEY, Date.now().toString());
};

export const getSessionAge = (): number => {
  const birth = localStorage.getItem(SESSION_BIRTH_KEY);
  if (!birth) return 999999;
  return Date.now() - parseInt(birth);
};

export const saveAuthMetadata = async (metadata: { sessionId?: string, isApproved?: boolean }): Promise<void> => {
  const db = await initDB();
  if (metadata.sessionId) setAuthHardLock(false);
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUTH_STORE, 'readwrite');
    const store = tx.objectStore(AUTH_STORE);
    if (metadata.sessionId !== undefined) store.put({ key: 'sessionId', value: metadata.sessionId });
    if (metadata.isApproved !== undefined) store.put({ key: 'isApproved', value: metadata.isApproved });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const getAuthMetadata = async (): Promise<{ sessionId: string | null, isApproved: boolean | null }> => {
  if (isAuthHardLocked()) {
    return { sessionId: null, isApproved: null };
  }

  const db = await initDB();
  return new Promise((resolve) => {
    const tx = db.transaction(AUTH_STORE, 'readonly');
    const store = tx.objectStore(AUTH_STORE);
    const req1 = store.get('sessionId');
    const req2 = store.get('isApproved');
    
    let sessionId: string | null = null;
    let isApproved: boolean | null = null;

    req1.onsuccess = () => { sessionId = req1.result?.value || null; };
    req2.onsuccess = () => { isApproved = req2.result !== undefined ? req2.result.value : null; };

    tx.oncomplete = () => resolve({ sessionId, isApproved });
  });
};

export const clearAuthMetadata = async (): Promise<void> => {
  setAuthHardLock(true);
  localStorage.removeItem(SESSION_BIRTH_KEY);
  localStorage.removeItem(LAST_BACKUP_KEY); 
  localStorage.removeItem(PENDING_BACKUP_KEY);
  
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUTH_STORE, 'readwrite');
    const store = tx.objectStore(AUTH_STORE);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => resolve();
  });
};

const seedMegaDrugBank = async (db: IDBDatabase) => {
  const tx = db.transaction(DRUG_STORE, 'readonly');
  const store = tx.objectStore(DRUG_STORE);
  const count = await new Promise<number>((res) => {
    const req = store.count();
    req.onsuccess = () => res(req.result);
  });

  if (count === 0) {
    const strategicDrugs = [
      { g: 'Amoxicillin', f: 'Cap' }, { g: 'Metformin', f: 'Tab' }, { g: 'Atorvastatin', f: 'Tab' },
      { g: 'Amlodipine', f: 'Tab' }, { g: 'Losartan', f: 'Tab' }, { g: 'Omeprazole', f: 'Cap' },
      { g: 'Azithromycin', f: 'Tab' }, { g: 'Sertraline', f: 'Tab' }, { g: 'Alprazolam', f: 'Tab' },
      { g: 'Acetaminophen', f: 'Tab' }, { g: 'Ibuprofen', f: 'Tab' }, { g: 'Naproxen', f: 'Tab' },
      { g: 'Ceftriaxone', f: 'Inj' }, { g: 'Dexamethasone', f: 'Inj' }, { g: 'Neurobion', f: 'Inj' },
      { g: 'Diphenhydramine', f: 'Syr' }, { g: 'Guaifenesin', f: 'Syr' }, { g: 'Aluminum MG S', f: 'Syr' },
      { g: 'Hydrocortisone', f: 'Oint' }, { g: 'Betamethasone', f: 'Oint' }, { g: 'Mupirocin', f: 'Cream' },
      { g: 'Ciprofloxacin', f: 'Drop' }, { g: 'Artificial Tears', f: 'Drop' }, { g: 'Salbutamol', f: 'Spray' },
      { g: 'Fluticasone', f: 'Spray' }, { g: 'Pantoprazole', f: 'Tab' }, { g: 'Levothyroxine', f: 'Tab' },
      { g: 'Warfarin', f: 'Tab' }, { g: 'Clopidogrel', f: 'Tab' }, { g: 'Aspirin', f: 'Tab' },
      { g: 'Gabapentin', f: 'Cap' }, { g: 'Pregabalin', f: 'Cap' }, { g: 'Fluoxetine', f: 'Cap' },
      { g: 'Risperidone', f: 'Tab' }, { g: 'Quetiapine', f: 'Tab' }, { g: 'Olanzapine', f: 'Tab' },
      { g: 'Metronidazole', f: 'Tab' }, { g: 'Doxycycline', f: 'Cap' }, { g: 'Nitrofurantoin', f: 'Cap' },
      { g: 'Lisinopril', f: 'Tab' }, { g: 'Enalapril', f: 'Tab' }, { g: 'Captopril', f: 'Tab' },
      { g: 'Montelukast', f: 'Tab' }, { g: 'Budesonide', f: 'Spray' }, { g: 'Tiotropium', f: 'Cap' },
      { g: 'Gliclazide', f: 'Tab' }, { g: 'Sitagliptin', f: 'Tab' }, { g: 'Empagliflozin', f: 'Tab' },
      { g: 'Dapagliflozin', f: 'Tab' }, { g: 'Liraglutide', f: 'Inj' }, { g: 'Insulin Glargine', f: 'Inj' },
      { g: 'Celecoxib', f: 'Cap' }, { g: 'Diclofenac', f: 'Tab' }, { g: 'Meloxicam', f: 'Tab' },
      { g: 'Sumatriptan', f: 'Tab' }, { g: 'Ergotamine', f: 'Tab' }, { g: 'Valproate Sodium', f: 'Syr' },
      { g: 'Carbamazepine', f: 'Tab' }, { g: 'Levetiracetam', f: 'Tab' }, { g: 'Topiramate', f: 'Tab' },
      { g: 'Donepezil', f: 'Tab' }, { g: 'Memantine', f: 'Tab' }, { g: 'Levodopa/Carbidopa', f: 'Tab' },
      { g: 'Amitriptyline', f: 'Tab' }, { g: 'Nortriptyline', f: 'Tab' }, { g: 'Clarithromycin', f: 'Tab' },
      { g: 'Ondansetron', f: 'Tab' }, { g: 'Metoclopramide', f: 'Tab' }, { g: 'Domperidone', f: 'Tab' },
      { g: 'Bisoprolol', f: 'Tab' }, { g: 'Carvedilol', f: 'Tab' }, { g: 'Ramipril', f: 'Tab' },
      { g: 'Rosuvastatin', f: 'Tab' }, { g: 'Simvastatin', f: 'Tab' }, { g: 'Spironolactone', f: 'Tab' },
      { g: 'Furosemide', f: 'Tab' }, { g: 'Hydrochlorothiazide', f: 'Tab' }, { g: 'Valsartan', f: 'Tab' },
      { g: 'Loratadine', f: 'Tab' }, { g: 'Cetirizine', f: 'Tab' }, { g: 'Fexofenadine', f: 'Tab' },
      { g: 'Promethazine', f: 'Syr' }, { g: 'Chlorpheniramine', f: 'Tab' }, { g: 'Hydroxyzine', f: 'Tab' }
    ];

    const writeTx = db.transaction(DRUG_STORE, 'readwrite');
    const writeStore = writeTx.objectStore(DRUG_STORE);
    
    strategicDrugs.forEach(item => {
        const fullName = `${item.f} ${item.g}`;
        writeStore.put({ 
          id: (crypto && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).substring(2), 
          name: fullName, 
          category: item.f,
          isCustom: false, 
          createdAt: Date.now() 
        });
    });
  }
};

export const getNextDisplayId = async (): Promise<string> => {
  const db = await initDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      const records = request.result as PatientRecord[];
      const numericIds = records
        .map(r => {
            const parsed = parseInt(r.displayId || "0", 10);
            return isNaN(parsed) ? 0 : parsed;
        });
      const maxId = numericIds.length > 0 ? Math.max(...numericIds) : 0;
      const nextId = maxId + 1;
      resolve(nextId.toString().padStart(3, '0'));
    };
  });
};

export const getAllDrugs = async (): Promise<Drug[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DRUG_STORE, 'readonly');
    const store = tx.objectStore(DRUG_STORE);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveDrug = async (drug: Drug): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DRUG_STORE, 'readwrite');
    const store = tx.objectStore(DRUG_STORE);
    const request = store.put(drug);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const deleteDrug = async (id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DRUG_STORE, 'readwrite');
    const store = tx.objectStore(DRUG_STORE);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const trackDrugUsage = async (drugName: string, dosage?: string, instruction?: string): Promise<void> => {
  if (!drugName) return;
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(USAGE_STORE, 'readwrite');
    const store = tx.objectStore(USAGE_STORE);
    const getReq = store.get(drugName);

    getReq.onsuccess = () => {
      let usage: any = getReq.result || { drugName, count: 0, lastUsed: 0, commonInstructions: [] };
      usage.count += 1;
      usage.lastUsed = Date.now();
      
      if (dosage) usage.lastDosage = dosage;
      if (instruction) {
        usage.lastInstruction = instruction;
        const idx = usage.commonInstructions.indexOf(instruction);
        if (idx > -1) {
            usage.commonInstructions.splice(idx, 1);
        }
        usage.commonInstructions.unshift(instruction);
        usage.commonInstructions = usage.commonInstructions.slice(0, 3); 
      }

      store.put(usage);
      resolve();
    };
    getReq.onerror = () => reject(getReq.error);
  });
};

export const getUsageStats = async (): Promise<any[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(USAGE_STORE, 'readonly');
    const store = tx.objectStore(USAGE_STORE);
    const request = store.getAll();
    request.onsuccess = () => {
        const stats = request.result;
        stats.sort((a: any, b: any) => b.count - a.count);
        resolve(stats);
    };
    request.onerror = () => reject(request.error);
  });
};

export const removeDosageFromUsage = async (dosage: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(USAGE_STORE, 'readwrite');
    const store = tx.objectStore(USAGE_STORE);
    const request = store.openCursor();
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        const usage = cursor.value;
        if (usage.lastDosage === dosage) {
          usage.lastDosage = undefined;
          cursor.update(usage);
        }
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const removeInstructionFromUsage = async (instruction: string, drugName?: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(USAGE_STORE, 'readwrite');
    const store = tx.objectStore(USAGE_STORE);
    
    if (drugName) {
        const getReq = store.get(drugName);
        getReq.onsuccess = () => {
            const usage = getReq.result;
            if (usage) {
                if (usage.commonInstructions) {
                    usage.commonInstructions = usage.commonInstructions.filter((i: string) => i !== instruction);
                }
                if (usage.lastInstruction === instruction) usage.lastInstruction = undefined;
                store.put(usage);
            }
        };
    } else {
        const request = store.openCursor();
        request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
                const usage = cursor.value;
                let changed = false;
                if (usage.commonInstructions) {
                    const filtered = usage.commonInstructions.filter((i: string) => i !== instruction);
                    if (filtered.length !== usage.commonInstructions.length) {
                        usage.commonInstructions = filtered;
                        changed = true;
                    }
                }
                if (usage.lastInstruction === instruction) {
                    usage.lastInstruction = undefined;
                    changed = true;
                }
                if (changed) cursor.update(usage);
                cursor.continue();
            }
        };
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const saveRecord = async (record: PatientRecord): Promise<void> => {
  const db = await initDB();
  if (!record.displayId) {
      const records = await getRecordsByName(record.name);
      if (records.length > 0 && records[0].displayId) {
          record.displayId = records[0].displayId;
      } else {
          record.displayId = await getNextDisplayId();
      }
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const deleteRecord = async (id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const deletePatientRecords = async (name: string): Promise<void> => {
    const db = await initDB();
    const records = await getRecordsByName(name);
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        records.forEach(r => store.delete(r.id));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

export const getAllRecords = async (): Promise<PatientRecord[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      const results = request.result as PatientRecord[];
      results.sort((a, b) => b.visitDate - a.visitDate);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
};

export const getRecordsByName = async (name: string): Promise<PatientRecord[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('name');
    const request = index.getAll(name);
    request.onsuccess = () => {
      const results = request.result as PatientRecord[];
      results.sort((a, b) => b.visitDate - a.visitDate);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
};

export const getUniquePatients = async (): Promise<PatientRecord[]> => {
  const records = await getAllRecords();
  const seen = new Set();
  return records.filter(r => {
    if (seen.has(r.name)) return false;
    seen.add(r.name);
    return true;
  });
};

export const saveTemplate = async (template: PrescriptionTemplate): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TEMPLATE_STORE, 'readwrite');
    const store = tx.objectStore(TEMPLATE_STORE);
    const request = store.put(template);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getAllTemplates = async (): Promise<PrescriptionTemplate[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TEMPLATE_STORE, 'readonly');
    const store = tx.objectStore(TEMPLATE_STORE);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as PrescriptionTemplate[]);
    request.onerror = () => reject(request.error);
  });
};

export const deleteTemplate = async (id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TEMPLATE_STORE, 'readwrite');
    const store = tx.objectStore(TEMPLATE_STORE);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// Complaint Template Functions
export const saveComplaintTemplate = async (text: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(COMPLAINT_TEMPLATE_STORE, 'readwrite');
    const store = tx.objectStore(COMPLAINT_TEMPLATE_STORE);
    const request = store.put({ id: (crypto && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).substring(2), text, createdAt: Date.now() });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getAllComplaintTemplates = async (): Promise<any[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(COMPLAINT_TEMPLATE_STORE, 'readonly');
    const store = tx.objectStore(COMPLAINT_TEMPLATE_STORE);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const deleteComplaintTemplate = async (id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(COMPLAINT_TEMPLATE_STORE, 'readwrite');
    const store = tx.objectStore(COMPLAINT_TEMPLATE_STORE);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const saveSettings = async (settings: PrescriptionSettings): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SETTINGS_STORE, 'readwrite');
    const store = tx.objectStore(SETTINGS_STORE);
    const request = store.put({ id: 'config', ...settings });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getSettings = async (): Promise<PrescriptionSettings | undefined> => {
  const db = await initDB();
  return new Promise((resolve) => {
    const tx = db.transaction(SETTINGS_STORE, 'readonly');
    const store = tx.objectStore(SETTINGS_STORE);
    const request = store.get('config');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(undefined);
  });
};

export const saveDoctorProfile = async (profile: DoctorProfile): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROFILE_STORE, 'readwrite');
    const store = tx.objectStore(PROFILE_STORE);
    const request = store.put({ id: 'main_profile', ...profile });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getDoctorProfile = async (): Promise<DoctorProfile | undefined> => {
  const db = await initDB();
  return new Promise((resolve) => {
    const tx = db.transaction(PROFILE_STORE, 'readonly');
    const store = tx.objectStore(PROFILE_STORE);
    const request = store.get('main_profile');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(undefined);
  });
};

export const exportDatabase = async (): Promise<string> => {
  const db = await initDB();
  return new Promise(async (resolve, reject) => {
    try {
      const stores = [STORE_NAME, TEMPLATE_STORE, COMPLAINT_TEMPLATE_STORE, SETTINGS_STORE, PROFILE_STORE, DRUG_STORE, USAGE_STORE];
      const exportData: any = {};

      for (const storeName of stores) {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const records = await new Promise((res, rej) => {
           const req = store.getAll();
           req.onsuccess = () => res(req.result);
           req.onerror = () => rej(req.error);
        });
        exportData[storeName] = records;
      }
      
      resolve(JSON.stringify(exportData));
    } catch (e) {
      reject(e);
    }
  });
};

/**
 * Mirror-Sync Protocol v3: 
 * Purges the entire database before population to ensure 
 * current device is a perfect mirror of the backup.
 */
export const importDatabase = async (jsonString: string): Promise<void> => {
  const db = await initDB();
  const data = JSON.parse(jsonString);
  const stores = [STORE_NAME, TEMPLATE_STORE, COMPLAINT_TEMPLATE_STORE, SETTINGS_STORE, PROFILE_STORE, DRUG_STORE, USAGE_STORE];

  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, 'readwrite');
    
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);

    // Phase 1: Purge All Stores (Atomic)
    for (const storeName of stores) {
        tx.objectStore(storeName).clear();
    }

    // Phase 2: Populate with Mirror Data
    for (const storeName of stores) {
      if (data[storeName]) {
        const store = tx.objectStore(storeName);
        for (const record of data[storeName]) {
          store.put(record);
        }
      }
    }
  });
};
