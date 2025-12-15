
import React, { useState, useEffect, useRef } from 'react';
import { digitizePrescription } from '../services/geminiService';
import { saveTemplate, getAllTemplates, deleteTemplate, getSettings, saveRecord, getDoctorProfile, getUniquePatients } from '../services/db';
import { PrescriptionItem, PrescriptionTemplate, PrescriptionSettings, DoctorProfile, PatientVitals, PatientRecord } from '../types';
import { FileSignature, ScanLine, Printer, Save, Trash, Plus, CheckCircle, Search, LayoutTemplate, Activity, UserPlus, Stethoscope, ArrowLeft, X, Phone, Scale, AlertCircle, WifiOff, Camera, Image as ImageIcon, Heart, Thermometer, Wind, Droplet, Hash, FileText, ChevronRight, Loader2, Sparkles, User, RotateCw } from 'lucide-react';

interface PrescriptionProps {
  initialRecord: PatientRecord | null;
}

const Prescription: React.FC<PrescriptionProps> = ({ initialRecord }) => {
  const [viewMode, setViewMode] = useState<'landing' | 'editor'>('landing');
  const [mobileTab, setMobileTab] = useState<'rx' | 'vitals' | 'templates'>('rx');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [allPatients, setAllPatients] = useState<PatientRecord[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const [diagnosis, setDiagnosis] = useState('');
  const [items, setItems] = useState<PrescriptionItem[]>([]);
  const [templates, setTemplates] = useState<PrescriptionTemplate[]>([]);
  
  const [vitals, setVitals] = useState<PatientVitals>({
    bloodPressure: '', heartRate: '', temperature: '', spO2: '', weight: '', height: '', respiratoryRate: '', bloodSugar: ''
  });
  
  const [settings, setSettings] = useState<PrescriptionSettings>({
    topPadding: 50, fontSize: 14, fontFamily: 'Vazirmatn', printBackground: true, paperSize: 'A4', elements: []
  });
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);

  const [showPrintModal, setShowPrintModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);

  // Camera Logic State
  const [showCamera, setShowCamera] = useState(false);
  const [scanOrientation, setScanOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // New Patient Form
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientAge, setNewPatientAge] = useState('');
  const [newPatientGender, setNewPatientGender] = useState<'male' | 'female'>('male');
  const [newPatientPhone, setNewPatientPhone] = useState('');
  const [newPatientWeight, setNewPatientWeight] = useState('');
  const [newPatientHistory, setNewPatientHistory] = useState('');
  const [newPatientAllergies, setNewPatientAllergies] = useState('');

  useEffect(() => {
    const handleStatusChange = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
      stopCamera();
    };
  }, []);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (initialRecord) {
        handleSelectPatient(initialRecord);
    }
  }, [initialRecord]);

  const loadInitialData = async () => {
    try {
      const templatesData = await getAllTemplates();
      setTemplates(templatesData);
      
      const patientsData = await getUniquePatients();
      setAllPatients(patientsData);

      const s = await getSettings();
      if (s) setSettings(s);
      const p = await getDoctorProfile();
      if (p) setDoctorProfile(p);
    } catch (e) { console.error(e); }
  };

  const filteredPatients = allPatients.filter(p => p.name.includes(searchTerm));

  const handleSelectPatient = (patient: PatientRecord) => {
    setSelectedPatient(patient);
    setViewMode('editor');
    setItems([]);
    
    // Auto-fill Logic
    if (patient.diagnosis && patient.status === 'diagnosed') {
        setDiagnosis(patient.diagnosis.modern.diagnosis);
        
        const aiItems = patient.diagnosis.modern.treatmentPlan.map(plan => ({
            drug: plan,
            dosage: '',
            instruction: ''
        }));
        setItems(aiItems);
    } else {
        const cp = patient.chiefComplaint || '';
        setDiagnosis(cp === 'ثبت نام اولیه (مستقیم)' ? '' : cp);
    }

    setVitals(patient.vitals || { bloodPressure: '', heartRate: '', temperature: '', spO2: '', weight: '', height: '', respiratoryRate: '', bloodSugar: '' });
  };

  const handleRegisterPatient = async () => {
    if (!newPatientName) return;
    const newRecord: PatientRecord = {
      id: crypto.randomUUID(),
      name: newPatientName,
      age: newPatientAge,
      gender: newPatientGender,
      phoneNumber: newPatientPhone,
      chiefComplaint: '', // Default empty for new patients in desk
      history: newPatientHistory,
      allergies: newPatientAllergies,
      vitals: { 
        bloodPressure: '', heartRate: '', temperature: '', spO2: '', weight: newPatientWeight, height: '', respiratoryRate: '', bloodSugar: ''
      },
      visitDate: Date.now(),
      status: 'waiting'
    };
    
    await saveRecord(newRecord);
    setShowNewPatientModal(false);
    
    setNewPatientName('');
    setNewPatientAge('');
    setNewPatientGender('male');
    setNewPatientPhone('');
    setNewPatientWeight('');
    setNewPatientHistory('');
    setNewPatientAllergies('');
    
    loadInitialData(); 
    handleSelectPatient(newRecord); 
  };

  // --- CAMERA LOGIC ---
  const startCamera = async () => {
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } 
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera Error:", err);
      alert("دسترسی به دوربین امکان‌پذیر نیست. لطفا از دکمه آپلود فایل استفاده کنید.");
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(async (blob) => {
          if (blob) {
            const file = new File([blob], "prescription_scan.jpg", { type: "image/jpeg" });
            stopCamera();
            await processFile(file);
          }
        }, 'image/jpeg', 0.8);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      stopCamera();
      processFile(e.target.files[0]);
    }
  };

  const processFile = async (file: File) => {
    setLoading(true);
    try {
      const res = await digitizePrescription(file);
      if (res.items) setItems(res.items);
      if (res.diagnosis) setDiagnosis(res.diagnosis);
      if (res.vitals) {
          setVitals(prev => ({
            ...prev,
            ...res.vitals
          }));
      }
    } catch (e) {
      console.error(e);
      alert('خطا در اسکن نسخه');
    } finally {
      setLoading(false);
    }
  };

  const addItem = () => {
    setItems([...items, { drug: '', dosage: '', instruction: '' }]);
  };

  const updateItem = (index: number, field: keyof PrescriptionItem, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSaveTemplate = async () => {
    if (!templateName) return;
    try {
      await saveTemplate({
        id: crypto.randomUUID(),
        name: templateName,
        items
      });
      setShowSaveModal(false);
      setTemplateName('');
      loadInitialData();
    } catch (e) { console.error(e); }
  };

  const loadTemplate = (t: PrescriptionTemplate) => {
    setItems(t.items);
    if(window.innerWidth < 1024) setMobileTab('rx'); 
  };

  const handleDeleteTemplate = async (id: string) => {
    if (confirm('آیا مطمئن هستید؟')) {
      await deleteTemplate(id);
      loadInitialData();
    }
  };

  // --- ENHANCED PRINT LOGIC (MOBILE OPTIMIZED) ---
  const handlePrint = (mode: 'plain' | 'custom') => {
     saveToPatientRecord();

     const win = window.open('', '_blank', 'width=900,height=1200');
     if (!win) {
       alert('لطفا اجازه باز شدن پاپ-آپ را بدهید.');
       return;
     }

     // Updated CSS for single page enforcement on mobile
     let style = `
       @page { size: ${settings.paperSize || 'A4'} portrait; margin: 0; }
       html, body { height: 100%; }
       body { font-family: '${settings.fontFamily}', sans-serif; margin: 0; direction: rtl; padding-top: 80px; -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
       
       /* Control Bar - Hidden on Print */
       .control-bar {
          position: fixed; top: 0; left: 0; right: 0;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          padding: 12px;
          display: flex;
          justify-content: center;
          gap: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.05);
          z-index: 9999;
          border-bottom: 1px solid #eee;
       }
       .btn {
          padding: 10px 24px;
          border-radius: 12px;
          border: none;
          font-family: '${settings.fontFamily}', sans-serif;
          font-weight: bold;
          cursor: pointer;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: transform 0.1s;
       }
       .btn:active { transform: scale(0.95); }
       .btn-print { background: #2563eb; color: white; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.2); }
       .btn-close { background: #fee2e2; color: #ef4444; }

       @media print {
          .no-print { display: none !important; }
          html, body { 
             height: 100%; 
             margin: 0 !important; 
             padding: 0 !important; 
             overflow: hidden; 
          }
          
          .rx-container, .custom-container {
             width: 100%;
             height: 100%;
             max-height: 100%;
             page-break-after: avoid;
             page-break-inside: avoid;
             break-inside: avoid;
             overflow: hidden;
             transform: scale(0.98); /* Safety scale for mobile margins */
             transform-origin: top center;
          }
       }
       
       /* Digital Mode Styles */
       .rx-container { padding: 40px; box-sizing: border-box; }
       .rx-table { width: 100%; border-collapse: collapse; margin-top: 20px; direction: ltr; }
       .rx-table th, .rx-table td { border-bottom: 1px solid #ddd; padding: 12px; text-align: left; }
       .rx-table th { background-color: #f8f9fa; }
       .rx-symbol { font-size: 32px; font-weight: bold; margin: 20px 0; font-family: serif; }
       .digital-header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
       
       /* Custom Layout Mode Styles */
       .custom-container { position: relative; width: 100%; height: 100%; overflow: hidden; }
       .print-element { position: absolute; white-space: nowrap; }
       .bg-image { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: fill; z-index: -1; }
     `;

     let content = '';

     const controlHtml = `
        <div class="control-bar no-print">
           <button class="btn btn-print" onclick="window.print()">
              <span>🖨️</span> چاپ نهایی
           </button>
           <button class="btn btn-close" onclick="window.close()">
              <span>✖</span> بستن
           </button>
        </div>
     `;

     if (mode === 'plain') {
        content = `
          <div class="rx-container">
             <div class="digital-header">
                <div class="doc-info">
                   <h1 style="margin:0; font-size:24px;">${doctorProfile?.name || 'دکتر ...'}</h1>
                   <p style="margin:5px 0;">${doctorProfile?.specialty || ''}</p>
                   <p style="font-size:12px;">نظام پزشکی: ${doctorProfile?.medicalCouncilNumber || '---'}</p>
                </div>
                ${doctorProfile?.logo ? `<img src="${doctorProfile.logo}" style="height: 80px; object-fit: contain;" />` : ''}
             </div>
             
             <div style="background:#f3f4f6; padding:15px; border-radius:10px; display:flex; gap:20px; margin-bottom:20px;">
                <div><strong>نام بیمار:</strong> ${selectedPatient?.name}</div>
                ${selectedPatient?.age ? `<div><strong>سن:</strong> ${selectedPatient.age}</div>` : ''}
                <div><strong>تاریخ:</strong> ${new Date().toLocaleDateString('fa-IR')}</div>
             </div>
             
             <div style="font-size: 12px; margin-bottom: 10px; display: flex; gap: 15px; color: #555;">
                ${vitals.bloodPressure ? `<span><strong>BP:</strong> ${vitals.bloodPressure}</span>` : ''}
                ${vitals.heartRate ? `<span><strong>HR:</strong> ${vitals.heartRate}</span>` : ''}
             </div>

             ${(diagnosis) ? `<div style="margin-bottom:20px; padding:10px; border:1px dashed #ccc;"><strong>تشخیص:</strong> ${diagnosis}</div>` : ''}

             <div class="rx-symbol">Rx</div>
             <table class="rx-table">
                <thead><tr><th>#</th><th>Drug Name</th><th>Dosage</th><th>Instruction</th></tr></thead>
                <tbody>
                   ${items.map((item, i) => `
                      <tr><td>${i + 1}</td><td style="font-weight:bold;">${item.drug}</td><td>${item.dosage}</td><td>${item.instruction}</td></tr>
                   `).join('')}
                </tbody>
             </table>
          </div>
        `;
     } else {
        // --- CUSTOM LAYOUT WITH FORCED BACKGROUND ---
        let bgHtml = '';
        if (settings.printBackground && settings.backgroundImage) {
           // Using IMG tag instead of CSS background ensures mobile browsers print it more reliably
           bgHtml = `<img src="${settings.backgroundImage}" class="bg-image" />`;
        }

        const elementsHtml = (settings.elements || []).filter(el => el.visible).map(el => {
           let innerHtml = '';
           switch (el.id) {
              case 'patientName': innerHtml = selectedPatient?.name || ''; break;
              case 'age': innerHtml = selectedPatient?.age || ''; break;
              case 'date': innerHtml = new Date().toLocaleDateString('fa-IR'); break;
              case 'diagnosis': innerHtml = diagnosis; break;
              case 'vital_bp': innerHtml = vitals.bloodPressure || ''; break;
              case 'vital_hr': innerHtml = vitals.heartRate || ''; break;
              case 'vital_rr': innerHtml = vitals.respiratoryRate || ''; break;
              case 'vital_temp': innerHtml = vitals.temperature || ''; break;
              case 'vital_weight': innerHtml = vitals.weight || ''; break;
              case 'items':
                 innerHtml = `<ul style="list-style:none; padding:0; margin:0; direction: ltr; text-align: left;">
                    ${items.map((item, i) => `
                       <li style="margin-bottom:8px;">
                          <span style="font-weight:bold;">${i+1}. ${item.drug}</span>
                          <span style="margin:0 10px;">${item.dosage}</span>
                          <div style="font-size:0.9em; color:#444;">${item.instruction}</div>
                       </li>
                    `).join('')}
                 </ul>`;
                 break;
              default: innerHtml = '';
           }

           if (!innerHtml) return '';

           return `
             <div class="print-element" style="
                left: ${el.x}px; 
                top: ${el.y}px; 
                width: ${el.width}px; 
                font-size: ${el.fontSize}pt; 
                transform: rotate(${el.rotation}deg);
                text-align: ${el.align || (el.id === 'items' ? 'left' : 'right')};
             ">
                ${innerHtml}
             </div>
           `;
        }).join('');

        content = `<div class="custom-container">${bgHtml}${elementsHtml}</div>`;
     }

     win.document.write(`
       <html dir="rtl">
         <head>
           <title>پیش‌نمایش چاپ</title>
           <meta name="viewport" content="width=device-width, initial-scale=1.0">
           <link href="https://fonts.googleapis.com/css2?family=Vazirmatn&display=swap" rel="stylesheet">
           <style>${style}</style>
         </head>
         <body>
           ${controlHtml}
           ${content}
         </body>
       </html>
     `);
     win.document.close();
     setShowPrintModal(false);
  };

  const saveToPatientRecord = async () => {
     if (!selectedPatient) return;
     try {
       const record: PatientRecord = {
           ...selectedPatient,
           vitals: { ...selectedPatient.vitals, ...vitals },
           status: 'completed',
           prescriptions: [
             ...(selectedPatient.prescriptions || []),
             {
               id: crypto.randomUUID(),
               date: Date.now(),
               items: items,
               manualDiagnosis: diagnosis,
               manualVitals: vitals
             }
           ]
       };
       await saveRecord(record);
     } catch (e) { console.error(e); }
  };

  if (viewMode === 'landing') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] animate-fade-in gap-8">
         <div className="bg-white p-12 rounded-[2rem] shadow-xl border border-blue-50 w-full max-w-3xl text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-teal-400"></div>
            <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-600">
               <Stethoscope size={48} />
            </div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">میز کار نسخه نویسی</h1>
            <p className="text-gray-500 mb-10">برای شروع، نام بیمار را جستجو کنید یا از اتاق تشخیص دستور دریافت کنید</p>
            <div className="relative max-w-xl mx-auto mb-8">
               <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                  <Search className="text-gray-400" />
               </div>
               <input type="text" autoFocus placeholder="جستجوی نام بیمار..." className="w-full p-5 pr-12 text-lg bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all shadow-inner" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
               <button onClick={() => setShowNewPatientModal(true)} className="absolute top-2 left-2 bottom-2 bg-teal-500 hover:bg-teal-600 text-white p-3 rounded-xl transition-all shadow-md" title="ثبت بیمار جدید"><UserPlus size={24} /></button>
               {searchTerm && filteredPatients.length > 0 && (
                 <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-20 max-h-64 overflow-y-auto">
                    {filteredPatients.map(p => (
                      <button key={p.id} onClick={() => handleSelectPatient(p)} className="w-full text-right p-4 hover:bg-blue-50 border-b border-gray-50 last:border-0 flex justify-between items-center transition-colors">
                        <span className="font-bold text-gray-700">{p.name}</span>
                        <span className="text-sm text-gray-400 bg-gray-100 px-2 py-1 rounded">{p.age} ساله</span>
                      </button>
                    ))}
                 </div>
               )}
            </div>
         </div>

         {/* New Patient Modal Code... (unchanged) */}
         {showNewPatientModal && (
            <div className="fixed inset-0 z-[100] lg:bg-black/60 lg:backdrop-blur-sm flex items-end lg:items-center justify-center p-0 lg:p-4">
               <div className="bg-white w-full lg:max-w-lg h-[100dvh] lg:h-auto lg:rounded-3xl shadow-2xl relative animate-slide-up lg:animate-fade-in flex flex-col">
                  <div className="p-4 lg:p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10 lg:rounded-t-3xl">
                     <h3 className="text-xl lg:text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <div className="bg-teal-100 p-2 rounded-xl text-teal-600"><UserPlus size={24} /></div>
                        ثبت بیمار جدید
                     </h3>
                     <button onClick={() => setShowNewPatientModal(false)} className="p-2 bg-gray-50 rounded-full text-gray-500 hover:bg-gray-100 hover:text-red-500 transition-colors">
                        <X size={20} />
                     </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-5 lg:p-8 space-y-5">
                     <div>
                       <label className="block text-sm font-bold text-gray-600 mb-2">نام و نام خانوادگی</label>
                       <div className="relative">
                          <User className="absolute right-3 top-3.5 text-gray-400" size={18} />
                          <input autoFocus className="w-full p-3.5 pr-10 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 transition-all border border-gray-100" placeholder="مثال: علی رضایی" value={newPatientName} onChange={e => setNewPatientName(e.target.value)} />
                       </div>
                     </div>
                     <div><label className="block text-sm font-bold text-gray-600 mb-2">شماره تماس</label><div className="relative"><input type="tel" className="w-full p-3.5 pl-10 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 transition-all text-left border border-gray-100 font-mono" placeholder="0912..." value={newPatientPhone} onChange={e => setNewPatientPhone(e.target.value)} dir="ltr" /><Phone className="absolute left-3 top-3.5 text-gray-400" size={18} /></div></div>
                     <div className="flex gap-4">
                        <div className="flex-1"><label className="block text-sm font-bold text-gray-600 mb-2">سن</label><input type="number" className="w-full p-3.5 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 text-center border border-gray-100" value={newPatientAge} onChange={e => setNewPatientAge(e.target.value)} placeholder="سال" /></div>
                        <div className="flex-[1.5]"><label className="block text-sm font-bold text-gray-600 mb-2">جنسیت</label><div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100"><button onClick={() => setNewPatientGender('male')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${newPatientGender === 'male' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}>آقا</button><button onClick={() => setNewPatientGender('female')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${newPatientGender === 'female' ? 'bg-white shadow-sm text-pink-600' : 'text-gray-400'}`}>خانم</button></div></div>
                     </div>
                     <div><label className="block text-sm font-bold text-gray-600 mb-2">وزن (کیلوگرم)</label><div className="relative"><input type="number" className="w-full p-3.5 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 text-center border border-gray-100" placeholder="kg" value={newPatientWeight} onChange={e => setNewPatientWeight(e.target.value)} /><Scale className="absolute left-3 top-3.5 text-gray-400" size={18} /></div></div>
                     <div className="pt-2"><label className="flex items-center gap-2 text-sm font-bold text-orange-600 mb-2"><Activity size={16} />سابقه بیماری</label><input className="w-full p-3.5 bg-orange-50/30 border border-orange-100 rounded-xl outline-none focus:ring-2 focus:ring-orange-200" placeholder="دیابت، فشار خون و..." value={newPatientHistory} onChange={e => setNewPatientHistory(e.target.value)} /></div>
                     <div><label className="flex items-center gap-2 text-sm font-bold text-red-600 mb-2"><AlertCircle size={16} />حساسیت‌ها و آلرژی</label><input className="w-full p-3.5 bg-red-50/30 border border-red-100 rounded-xl outline-none focus:ring-2 focus:ring-red-200" placeholder="پنی‌سیلین، آسپرین..." value={newPatientAllergies} onChange={e => setNewPatientAllergies(e.target.value)} /></div>
                  </div>
                  <div className="p-4 lg:p-6 border-t border-gray-100 bg-white lg:rounded-b-3xl">
                     <button onClick={handleRegisterPatient} disabled={!newPatientName} className="w-full bg-gradient-to-r from-teal-600 to-teal-500 text-white py-4 rounded-2xl font-bold shadow-lg shadow-teal-200 hover:shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-3 text-lg"><Save size={22} />ذخیره پرونده اولیه</button>
                  </div>
               </div>
            </div>
         )}
      </div>
    );
  }

  // ... (Rest of the main component code remains largely same, minimal changes needed except the print logic above)
  
  return (
    <div className="space-y-8 animate-fade-in pb-24 lg:pb-20">
      {loading && (
         <div className="fixed inset-0 z-[70] bg-white/80 backdrop-blur-md flex flex-col items-center justify-center animate-fade-in">
            <div className="relative">
               <div className="w-24 h-24 border-4 border-indigo-100 rounded-full animate-ping absolute top-0 left-0"></div>
               <div className="w-24 h-24 bg-white rounded-full shadow-xl flex items-center justify-center relative z-10"><Sparkles className="text-indigo-600 w-10 h-10 animate-pulse" /></div>
            </div>
            <h3 className="mt-8 text-xl font-bold text-gray-800 animate-pulse">هوش مصنوعی در حال خواندن دست‌خط...</h3>
            <p className="text-gray-500 mt-2 text-sm">لطفا چند لحظه صبر کنید</p>
         </div>
      )}

      {/* Mobile & Desktop JSX (Standard layout) */}
      <div className="lg:hidden flex flex-col gap-4">
         <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 flex-1 min-w-0">
               <button onClick={() => setViewMode('landing')} className="p-2 bg-gray-50 rounded-xl text-gray-600 flex-shrink-0"><ArrowLeft size={20}/></button>
               <div className="min-w-0"><h2 className="font-bold text-gray-800 truncate text-sm">{selectedPatient?.name}</h2><p className="text-[10px] text-gray-400 truncate">{selectedPatient?.age} ساله</p></div>
            </div>
            <div className="flex items-center gap-2">
               <button onClick={() => setShowSaveModal(true)} disabled={items.length === 0} className="p-2 rounded-xl bg-gray-50 text-gray-600 disabled:opacity-50"><Save size={20} /></button>
               <button onClick={() => setShowPrintModal(true)} disabled={items.length === 0} className="p-2 rounded-xl bg-gray-50 text-gray-600 disabled:opacity-50"><Printer size={20} /></button>
               <button onClick={startCamera} disabled={!isOnline} className={`p-2 rounded-xl transition-colors ${isOnline ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-300'}`}><Camera size={20} /></button>
            </div>
         </div>
         <div className="bg-gray-100 p-1 rounded-xl flex">
            <button onClick={() => setMobileTab('rx')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${mobileTab === 'rx' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}>نسخه و تشخیص</button>
            <button onClick={() => setMobileTab('vitals')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${mobileTab === 'vitals' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>علائم حیاتی</button>
            <button onClick={() => setMobileTab('templates')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${mobileTab === 'templates' ? 'bg-white shadow text-gray-700' : 'text-gray-500'}`}>قالب‌ها</button>
         </div>
         <div className="min-h-[50vh]">
            {mobileTab === 'vitals' && (
               <div className="grid grid-cols-2 gap-3 animate-fade-in">
                  {[{ l: 'فشار خون', i: Activity, v: vitals.bloodPressure, k: 'bloodPressure', c: 'text-red-500' }, { l: 'ضربان قلب', i: Heart, v: vitals.heartRate, k: 'heartRate', c: 'text-rose-500' }, { l: 'دمای بدن', i: Thermometer, v: vitals.temperature, k: 'temperature', c: 'text-orange-500' }, { l: 'اکسیژن', i: Wind, v: vitals.spO2, k: 'spO2', c: 'text-blue-500' }, { l: 'قند خون', i: Droplet, v: vitals.bloodSugar, k: 'bloodSugar', c: 'text-pink-500' }, { l: 'وزن (kg)', i: Scale, v: vitals.weight, k: 'weight', c: 'text-indigo-500' }, { l: 'تنفس', i: Wind, v: vitals.respiratoryRate, k: 'respiratoryRate', c: 'text-cyan-500' }, { l: 'قد (cm)', i: Hash, v: vitals.height, k: 'height', c: 'text-gray-500' }].map((item: any) => (
                     <div key={item.k} className="bg-white p-4 rounded-2xl border border-gray-100 flex flex-col items-center justify-center gap-2 shadow-sm focus-within:ring-2 focus-within:ring-blue-200 transition-all">
                        <item.i size={24} className={item.c} /><label className="text-xs font-bold text-gray-400">{item.l}</label><input className="w-full text-center text-xl font-bold text-gray-700 outline-none bg-transparent placeholder-gray-200" placeholder="---" value={item.v} onChange={e => setVitals({...vitals, [item.k]: e.target.value})} />
                     </div>
                  ))}
               </div>
            )}
            {mobileTab === 'rx' && (
               <div className="space-y-4 animate-fade-in">
                  <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm"><label className="flex items-center gap-2 text-sm font-bold text-gray-500 mb-2"><Activity size={16} className="text-purple-500" />تشخیص پزشک</label><textarea className="w-full p-3 bg-gray-50 rounded-xl outline-none text-gray-700 h-20 resize-none focus:bg-white focus:ring-2 focus:ring-purple-100 transition-all" placeholder="تشخیص نهایی را بنویسید..." value={diagnosis} onChange={e => setDiagnosis(e.target.value)} /></div>
                  <div className="space-y-3">
                     {items.map((item, idx) => (
                        <div key={idx} className="bg-white p-4 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-gray-100 relative group animate-slide-up">
                           <button onClick={() => removeItem(idx)} className="absolute top-4 left-4 p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors"><Trash size={18} /></button>
                           <div className="mb-4 pl-12"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">نام دارو</label><input className="w-full font-bold text-gray-800 text-lg border-b border-gray-100 pb-2 outline-none focus:border-indigo-500 placeholder-gray-300" placeholder="نام دارو را وارد کنید..." value={item.drug} onChange={e => updateItem(idx, 'drug', e.target.value)} /></div>
                           <div className="flex gap-3"><div className="flex-1 bg-gray-50 p-2 rounded-xl border border-gray-100"><label className="text-[10px] font-bold text-gray-400 block mb-1">دوز / تعداد</label><input className="w-full bg-transparent font-mono text-center font-bold text-gray-700 outline-none" placeholder="N=30" value={item.dosage} onChange={e => updateItem(idx, 'dosage', e.target.value)} /></div><div className="flex-[2] bg-gray-50 p-2 rounded-xl border border-gray-100"><label className="text-[10px] font-bold text-gray-400 block mb-1">دستور مصرف</label><input className="w-full bg-transparent font-medium text-gray-700 outline-none text-right" placeholder="هر ۸ ساعت..." value={item.instruction} onChange={e => updateItem(idx, 'instruction', e.target.value)} /></div></div>
                        </div>
                     ))}
                  </div>
                  <button onClick={addItem} className="w-full py-4 border-2 border-dashed border-indigo-200 rounded-2xl text-indigo-500 font-bold flex items-center justify-center gap-2 hover:bg-indigo-50 transition-colors"><Plus size={20} />افزودن قلم داروی جدید</button>
               </div>
            )}
            {mobileTab === 'templates' && (
               <div className="animate-fade-in space-y-3">
                  {templates.length === 0 ? <div className="text-center p-8 text-gray-400 bg-white rounded-2xl border border-gray-100">قالبی یافت نشد</div> : templates.map(t => (<div key={t.id} onClick={() => loadTemplate(t)} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between active:scale-95 transition-transform cursor-pointer"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600"><LayoutTemplate size={20} /></div><span className="font-bold text-gray-700">{t.name}</span></div><ChevronRight className="text-gray-300" size={20} /></div>))}
               </div>
            )}
         </div>
         <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 pb-safe z-30 flex gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] lg:hidden"><button onClick={() => setShowSaveModal(true)} disabled={items.length === 0} className="p-4 bg-gray-100 text-gray-600 rounded-2xl disabled:opacity-50"><Save size={24} /></button><button onClick={() => setShowPrintModal(true)} disabled={items.length === 0} className="flex-1 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg shadow-indigo-200 active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none"><Printer size={20} />چاپ و اتمام نسخه</button></div>
      </div>

      <div className="hidden lg:block">
         <div className="flex justify-between items-center mb-6"><div className="flex items-center gap-3"><button onClick={() => setViewMode('landing')} className="p-2 bg-white rounded-xl shadow-sm hover:bg-gray-50 text-gray-500"><ArrowLeft /></button><FileSignature className="text-indigo-600 w-10 h-10" /><div><h2 className="text-3xl font-bold text-gray-800">میز کار دکتر</h2><p className="text-gray-500">پرونده: {selectedPatient?.name}</p></div></div></div>
         <div className="grid grid-cols-12 gap-8">
              <div className="col-span-3 space-y-4"><div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 h-full"><h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><LayoutTemplate size={18} />قالب‌های آماده</h4>{templates.length === 0 && <p className="text-sm text-gray-400">قالبی ذخیره نشده است</p>}<div className="space-y-2">{templates.map(t => (<div key={t.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg group"><button onClick={() => loadTemplate(t)} className="text-sm font-bold text-gray-700 hover:text-indigo-600 flex-1 text-right">{t.name}</button><button onClick={() => handleDeleteTemplate(t.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash size={14} /></button></div>))}</div></div></div>
              <div className="col-span-9 bg-white p-8 rounded-3xl shadow-sm border border-gray-100 min-h-[600px] flex flex-col">
                 <div className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-100 mb-6"><div className="flex gap-6"><div><span className="text-xs text-gray-400 font-bold block mb-1">نام بیمار</span><span className="font-bold text-lg text-gray-800">{selectedPatient?.name}</span></div><div><span className="text-xs text-gray-400 font-bold block mb-1">سن</span><span className="font-bold text-lg text-gray-800">{selectedPatient?.age}</span></div><div><span className="text-xs text-gray-400 font-bold block mb-1">جنسیت</span><span className="font-bold text-lg text-gray-800">{selectedPatient?.gender === 'male' ? 'آقا' : 'خانم'}</span></div></div><div className="relative"><button onClick={startCamera} disabled={!isOnline} className={`bg-white border text-blue-600 px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all ${isOnline ? 'border-blue-200 hover:bg-blue-50' : 'border-gray-200 text-gray-400 cursor-not-allowed'}`}>{isOnline ? <Camera size={18} /> : <WifiOff size={18} />}{loading ? '...' : isOnline ? 'اسکن نسخه (دوربین)' : 'آفلاین'}</button></div></div>
                 <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 mb-6"><div className="flex items-center gap-2 mb-3 text-indigo-800 font-bold"><Activity size={18} /><span>علائم حیاتی و تشخیص</span></div><div className="grid grid-cols-4 gap-3 mb-4"><input className="p-2 bg-white border border-indigo-100 rounded-lg text-sm" placeholder="BP" value={vitals.bloodPressure} onChange={e => setVitals({...vitals, bloodPressure: e.target.value})} /><input className="p-2 bg-white border border-indigo-100 rounded-lg text-sm" placeholder="HR" value={vitals.heartRate} onChange={e => setVitals({...vitals, heartRate: e.target.value})} /><input className="p-2 bg-white border border-indigo-100 rounded-lg text-sm" placeholder="Temp" value={vitals.temperature} onChange={e => setVitals({...vitals, temperature: e.target.value})} /><input className="p-2 bg-white border border-indigo-100 rounded-lg text-sm" placeholder="RR" value={vitals.respiratoryRate} onChange={e => setVitals({...vitals, respiratoryRate: e.target.value})} /><input className="p-2 bg-white border border-indigo-100 rounded-lg text-sm" placeholder="Glu/BS" value={vitals.bloodSugar} onChange={e => setVitals({...vitals, bloodSugar: e.target.value})} /><input className="p-2 bg-white border border-indigo-100 rounded-lg text-sm" placeholder="Weight" value={vitals.weight} onChange={e => setVitals({...vitals, weight: e.target.value})} /></div><input className="w-full p-2 bg-white border border-indigo-100 rounded-lg text-sm" placeholder="تشخیص پزشک (Diagnosis)" value={diagnosis} onChange={e => setDiagnosis(e.target.value)} /></div>
                 <div className="flex-1 overflow-x-auto"><table className="w-full text-right"><thead><tr className="border-b border-gray-200"><th className="pb-3 text-sm text-gray-500 w-10">#</th><th className="pb-3 text-sm text-gray-500 w-1/3">نام دارو (Drug)</th><th className="pb-3 text-sm text-gray-500 w-1/4">دوز (Dosage)</th><th className="pb-3 text-sm text-gray-500">دستور مصرف (Sig)</th><th className="pb-3 w-10"></th></tr></thead><tbody className="divide-y divide-gray-50">{items.map((item, idx) => (<tr key={idx} className="group"><td className="py-3 text-gray-400 text-sm">{idx + 1}</td><td className="py-3 px-1"><input className="w-full p-2 bg-transparent focus:bg-gray-50 rounded-lg outline-none font-medium" value={item.drug} onChange={e => updateItem(idx, 'drug', e.target.value)} placeholder="نام دارو" /></td><td className="py-3 px-1"><input className="w-full p-2 bg-transparent focus:bg-gray-50 rounded-lg outline-none" value={item.dosage} onChange={e => updateItem(idx, 'dosage', e.target.value)} placeholder="دوز" /></td><td className="py-3 px-1"><input className="w-full p-2 bg-transparent focus:bg-gray-50 rounded-lg outline-none" value={item.instruction} onChange={e => updateItem(idx, 'instruction', e.target.value)} placeholder="دستور" /></td><td className="py-3 text-center"><button onClick={() => removeItem(idx)} className="text-gray-300 hover:text-red-500"><Trash size={16} /></button></td></tr>))}</tbody></table><button onClick={addItem} className="mt-4 text-indigo-600 font-bold text-sm flex items-center gap-1 hover:bg-indigo-50 px-3 py-1 rounded-lg transition-colors"><Plus size={16} />افزودن قلم دارو</button></div>
                 <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end gap-3"><button onClick={() => setShowSaveModal(true)} disabled={items.length === 0} className="px-6 py-3 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 flex items-center gap-2"><Save size={18} />ذخیره در قالب‌ها</button><button onClick={() => setShowPrintModal(true)} disabled={items.length === 0} className="px-6 py-3 rounded-xl font-bold text-white bg-indigo-600 shadow-lg hover:bg-indigo-700 flex items-center gap-2"><Printer size={18} />تایید نهایی و چاپ نسخه</button></div>
              </div>
           </div>
      </div>

      {showCamera && (<div className="fixed inset-0 z-[60] bg-black flex flex-col"><div className="flex justify-between items-center p-4 bg-black/50 text-white absolute top-0 left-0 right-0 z-10"><h3 className="font-bold text-lg flex items-center gap-2"><ScanLine /> اسکن نسخه</h3><button onClick={stopCamera} className="p-2 bg-white/20 rounded-full"><X /></button></div><div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden"><video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain" /><div className="absolute inset-0 pointer-events-none flex items-center justify-center"><div className="relative border-2 border-white/50 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.7)] transition-all duration-500 ease-in-out" style={{aspectRatio: scanOrientation === 'portrait' ? '210/297' : '297/210',height: scanOrientation === 'portrait' ? '85%' : 'auto',width: scanOrientation === 'landscape' ? '85%' : 'auto',maxHeight: '90vh',maxWidth: '90vw'}}><div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-teal-500 -mt-[2px] -ml-[2px]"></div><div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-teal-500 -mt-[2px] -mr-[2px]"></div><div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-teal-500 -mb-[2px] -ml-[2px]"></div><div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-teal-500 -mb-[2px] -mr-[2px]"></div><div className="absolute inset-0 flex items-center justify-center"><div className="bg-black/50 text-white px-3 py-1 rounded-full text-xs font-bold backdrop-blur-sm border border-white/10 flex items-center gap-2"><ScanLine size={14} /><span>قالب {scanOrientation === 'portrait' ? 'عمودی' : 'افقی'} (A4/A5)</span></div></div></div></div><canvas ref={canvasRef} className="hidden" /></div><div className="bg-black p-6 pb-10 flex justify-between items-center"><button onClick={() => setScanOrientation(prev => prev === 'portrait' ? 'landscape' : 'portrait')} className="text-white flex flex-col items-center gap-1 text-xs hover:text-teal-400 transition-colors"><RotateCw size={24} /><span>چرخش قالب</span></button><button onClick={capturePhoto} className="w-20 h-20 rounded-full bg-white border-4 border-gray-300 flex items-center justify-center shadow-lg active:scale-95 transition-transform hover:border-teal-500 hover:scale-105"><div className="w-16 h-16 rounded-full bg-white border-2 border-black/10"></div></button><div className="w-12 relative overflow-hidden"><input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleFileUpload} /><button className="text-white flex flex-col items-center gap-1 text-xs hover:text-teal-400 transition-colors"><ImageIcon size={24} /><span>گالری</span></button></div></div></div>)}
      {showSaveModal && (<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"><div className="bg-white rounded-2xl p-6 w-full max-w-sm"><h3 className="font-bold text-lg mb-4">ذخیره به عنوان قالب</h3><input autoFocus className="w-full p-3 border border-gray-300 rounded-xl mb-4" placeholder="نام قالب (مثال: سرماخوردگی)" value={templateName} onChange={e => setTemplateName(e.target.value)} /><div className="flex justify-end gap-2"><button onClick={() => setShowSaveModal(false)} className="px-4 py-2 text-gray-600">لغو</button><button onClick={handleSaveTemplate} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">ذخیره</button></div></div></div>)}
      {showPrintModal && (
         <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md">
               <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Printer />انتخاب نوع چاپ</h3>
               <div className="space-y-3">
                  <button onClick={() => handlePrint('plain')} className="w-full p-4 border border-gray-200 rounded-xl flex items-center justify-between hover:border-indigo-500 hover:bg-indigo-50 transition-all text-right group"><div><span className="font-bold text-gray-700 block group-hover:text-indigo-700">چاپ دیجیتال (استاندارد)</span><span className="text-xs text-gray-500">با سربرگ و لوگوی دیجیتال سیستم</span></div><CheckCircle size={20} className="text-gray-300 group-hover:text-indigo-500" /></button>
                  <button onClick={() => handlePrint('custom')} disabled={!settings.backgroundImage} className="w-full p-4 border border-gray-200 rounded-xl flex items-center justify-between hover:border-indigo-500 hover:bg-indigo-50 transition-all text-right group disabled:opacity-50 disabled:cursor-not-allowed"><div><span className="font-bold text-gray-700 block group-hover:text-indigo-700">چاپ روی نسخه اختصاصی</span><span className="text-xs text-gray-500">جایگذاری متن روی تصویر طراحی شده</span>{!settings.backgroundImage && <span className="text-xs text-red-500 block mt-1"> (ابتدا در تنظیمات طرح را آماده کنید)</span>}{settings.backgroundImage && <span className="text-xs text-blue-500 block mt-1"> (حالت: {settings.printBackground ? 'چاپ پس‌زمینه فعال' : 'چاپ روی کاغذ سربرگ‌دار'})</span>}</div><CheckCircle size={20} className="text-gray-300 group-hover:text-indigo-500" /></button>
               </div>
               <div className="mt-6 flex justify-end"><button onClick={() => setShowPrintModal(false)} className="text-gray-500 font-bold hover:text-gray-700">انصراف</button></div>
            </div>
         </div>
      )}
    </div>
  );
};

export default Prescription;
