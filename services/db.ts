
import { PatientRecord, PrescriptionTemplate, PrescriptionSettings, DoctorProfile } from '../types';

const DB_NAME = 'TabibHooshmandDB';
const STORE_NAME = 'patients';
const TEMPLATE_STORE = 'rx_templates';
const SETTINGS_STORE = 'settings';
const PROFILE_STORE = 'doctor_profile';
const VERSION = 3; // Upgraded version for profile

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('name', 'name', { unique: false });
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
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveRecord = async (record: PatientRecord): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getAllRecords = async (): Promise<PatientRecord[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      // Sort by date desc
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
    const request = index.getAll(name); // Exact match for simplicity
    request.onsuccess = () => {
      const results = request.result as PatientRecord[];
      results.sort((a, b) => b.visitDate - a.visitDate);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
};

export const getRecordById = async (id: string): Promise<PatientRecord | undefined> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
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
      const stores = [STORE_NAME, TEMPLATE_STORE, SETTINGS_STORE, PROFILE_STORE];
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
  const stores = [STORE_NAME, TEMPLATE_STORE, SETTINGS_STORE, PROFILE_STORE];

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
