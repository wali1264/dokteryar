
import { PatientRecord, PrescriptionTemplate, PrescriptionSettings, DoctorProfile, Drug, DrugUsage } from '../types';

const DB_NAME = 'TabibHooshmandDB';
const STORE_NAME = 'patients';
const TEMPLATE_STORE = 'rx_templates';
const SETTINGS_STORE = 'settings';
const PROFILE_STORE = 'doctor_profile';
const DRUG_STORE = 'drugs';
const USAGE_STORE = 'drug_usage';
const VERSION = 5; 

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('name', 'name', { unique: false });
        store.createIndex('displayId', 'displayId', { unique: true });
        store.createIndex('visitDate', 'visitDate', { unique: false });
      }
      if (!db.objectStoreNames.contains(TEMPLATE_STORE)) {
        db.createObjectStore(TEMPLATE_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(PROFILE_STORE)) {
        db.createObjectStore(PROFILE_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(DRUG_STORE)) {
        const store = db.createObjectStore(DRUG_STORE, { keyPath: 'id' });
        store.createIndex('name', 'name', { unique: false });
      }
      if (!db.objectStoreNames.contains(USAGE_STORE)) {
        db.createObjectStore(USAGE_STORE, { keyPath: 'drugName' });
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

const seedMegaDrugBank = async (db: IDBDatabase) => {
  const tx = db.transaction(DRUG_STORE, 'readonly');
  const store = tx.objectStore(DRUG_STORE);
  const count = await new Promise<number>((res) => {
    const req = store.count();
    req.onsuccess = () => res(req.result);
  });

  if (count === 0) {
    const generics = [
      'Amoxicillin', 'Azithromycin', 'Metformin', 'Atorvastatin', 'Amlodipine', 
      'Losartan', 'Metoprolol', 'Omeprazole', 'Sertraline', 'Alprazolam',
      'Gabapentin', 'Tramadol', 'Acetaminophen', 'Ibuprofen', 'Naproxen',
      'Ciprofloxacin', 'Cephalexin', 'Prednisone', 'Furosemide', 'Levothyroxine',
      'Warfarin', 'Clopidogrel', 'Aspirin', 'Simvastatin', 'Rosuvastatin',
      'Valsartan', 'Spironolactone', 'Pantoprazole', 'Esomeprazole', 'Ranitidine',
      'Diazepam', 'Lorazepam', 'Fluoxetine', 'Escitalopram', 'Venlafaxine',
      'Duloxetine', 'Quetiapine', 'Risperidone', 'Olanzapine', 'Lithium',
      'Metronidazole', 'Doxycycline', 'Nitrofurantoin', 'Hydrochlorothiazide',
      'Lisinopril', 'Enalapril', 'Captopril', 'Montelukast', 'Salbutamol', 'Fluticasone',
      'Budesonide', 'Tiotropium', 'Glibenclamide', 'Gliclazide', 'Sitagliptin',
      'Empagliflozin', 'Dapagliflozin', 'Liraglutide', 'Insulin', 'Dexamethasone',
      'Hydrocortisone', 'Betamethasone', 'Celecoxib', 'Diclofenac', 'Meloxicam',
      'Sumatriptan', 'Ergotamine', 'Phenobarbital', 'Phenytoin', 'Valproate',
      'Carbamazepine', 'Levetiracetam', 'Topiramate', 'Pregabalin', 'Donepezil',
      'Memantine', 'Levodopa', 'Carbidopa', 'Entacapone', 'Selegiline',
      'Amitriptyline', 'Nortriptyline', 'Imipramine', 'Clomipramine', 'Mirtazapine',
      'Clarithromycin', 'Loperamide', 'Ondansetron', 'Metoclopramide', 'Domperidone',
      'Bisoprolol', 'Carvedilol', 'Ramipril', 'Amlodipine/Valsartan', 'Rosuvastatin/Ezetimibe',
      'Levofloxacin', 'Moxifloxacin', 'Gentamicin', 'Ceftriaxone', 'Cefixime',
      'Ketotifen', 'Loratadine', 'Cetirizine', 'Fexofenadine', 'Montelukast/Levocetirizine',
      'Hydroxyzine', 'Promethazine', 'Chlorpheniramine', 'Diphenhydramine'
    ];

    const forms = [
      { prefix: 'Tab', name: 'Tablet' },
      { prefix: 'Cap', name: 'Capsule' },
      { prefix: 'Syr', name: 'Syrup' },
      { prefix: 'Susp', name: 'Suspension' },
      { prefix: 'Oint', name: 'Ointment' },
      { prefix: 'Drop', name: 'Drops' },
      { prefix: 'Inj', name: 'Injection' },
      { prefix: 'Cream', name: 'Cream' },
      { prefix: 'Gel', name: 'Gel' },
      { prefix: 'Spray', name: 'Nasal Spray' },
      { prefix: 'Supp', name: 'Suppository' }
    ];

    const writeTx = db.transaction(DRUG_STORE, 'readwrite');
    const writeStore = writeTx.objectStore(DRUG_STORE);
    
    generics.forEach(gen => {
      forms.forEach(f => {
        const fullName = `${f.prefix} ${gen}`;
        writeStore.put({ 
          id: crypto.randomUUID(), 
          name: fullName, 
          category: f.name,
          isCustom: false, 
          createdAt: Date.now() 
        });
      });
    });
  }
};

// --- ID Generation ---
export const getNextDisplayId = async (): Promise<string> => {
  const db = await initDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      const records = request.result as PatientRecord[];
      // Find the maximum numeric displayId across all patient records
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

// --- Drug Methods ---
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

// --- Usage Tracking Methods ---
export interface UsageEntry extends DrugUsage {
  lastDosage?: string;
  lastInstruction?: string;
}

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
        usage.commonInstructions = usage.commonInstructions.slice(0, 3); // Keep top 3
      }

      store.put(usage);
      resolve();
    };
    getReq.onerror = () => reject(getReq.error);
  });
};

export const getUsageStats = async (): Promise<UsageEntry[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(USAGE_STORE, 'readonly');
    const store = tx.objectStore(USAGE_STORE);
    const request = store.getAll();
    request.onsuccess = () => {
        const stats = request.result as UsageEntry[];
        stats.sort((a, b) => b.count - a.count);
        resolve(stats);
    };
    request.onerror = () => reject(request.error);
  });
};

// --- Standard Patient Record Methods ---
export const saveRecord = async (record: PatientRecord): Promise<void> => {
  const db = await initDB();
  
  // Ensure patient ID display persistence across records for same patient name
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

export const getUniquePatients = async (): Promise<PatientRecord[]> => {
  const records = await getAllRecords();
  const seen = new Set();
  return records.filter(r => {
    if (seen.has(r.name)) return false;
    seen.add(r.name);
    return true;
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

// --- Template Methods ---
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

// --- Settings Methods ---
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
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SETTINGS_STORE, 'readonly');
    const store = tx.objectStore(SETTINGS_STORE);
    const request = store.get('config');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// --- Doctor Profile Methods ---
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
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROFILE_STORE, 'readonly');
    const store = tx.objectStore(PROFILE_STORE);
    const request = store.get('main_profile');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// --- Backup & Restore ---
export const exportDatabase = async (): Promise<string> => {
  const db = await initDB();
  return new Promise(async (resolve, reject) => {
    try {
      const stores = [STORE_NAME, TEMPLATE_STORE, SETTINGS_STORE, PROFILE_STORE, DRUG_STORE, USAGE_STORE];
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

export const importDatabase = async (jsonString: string): Promise<void> => {
  const db = await initDB();
  const data = JSON.parse(jsonString);
  const stores = [STORE_NAME, TEMPLATE_STORE, SETTINGS_STORE, PROFILE_STORE, DRUG_STORE, USAGE_STORE];

  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, 'readwrite');
    
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);

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
