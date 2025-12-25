
import React, { useEffect, useState } from 'react';
import { getAllRecords, getDoctorProfile, getSettings, saveRecord, deleteRecord, deletePatientRecords } from '../services/db';
import { PatientRecord, AppRoute, PrescriptionItem, DoctorProfile, PrescriptionSettings, PrescriptionRecord } from '../types';
import { Search, Archive, User, FileText, ChevronLeft, Clock, Printer, X, Activity, Pill, Edit3, Save, AlertCircle, Hash, Phone, UserPlus, History, Trash2 } from 'lucide-react';

interface DashboardProps {
  onNavigate: (route: AppRoute, record?: PatientRecord) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [records, setRecords] = useState<PatientRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Patient Centric View State
  const [groupedPatients, setGroupedPatients] = useState<Record<string, PatientRecord[]>>({});
  
  // Modal State
  const [selectedPatientName, setSelectedPatientName] = useState<string | null>(null);
  const [selectedPatientHistory, setSelectedPatientHistory] = useState<PatientRecord[]>([]);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editForm, setEditForm] = useState<any>(null);

  // Print State
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
  const [settings, setSettings] = useState<PrescriptionSettings | null>(null);

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    try {
      const data = await getAllRecords();
      setRecords(data);
      
      // Group by Name
      const groups: Record<string, PatientRecord[]> = {};
      data.forEach(r => {
          if (!groups[r.name]) groups[r.name] = [];
          groups[r.name].push(r);
      });
      setGroupedPatients(groups);

      const p = await getDoctorProfile();
      if (p) setDoctorProfile(p);
      const s = await getSettings();
      if (s) setSettings(s);

    } catch (e) {
      console.error("DB Error", e);
    } finally {
      setLoading(false);
    }
  };

  const filteredPatientNames = Object.keys(groupedPatients).filter(name => {
    const patientRecords = groupedPatients[name] || [];
    const displayId = patientRecords[0]?.displayId || "";
    return name.includes(searchTerm) || displayId.includes(searchTerm);
  });

  const openPatientFile = (name: string) => {
      setSelectedPatientName(name);
      setSelectedPatientHistory(groupedPatients[name] || []);
  };

  const closePatientFile = () => {
      setSelectedPatientName(null);
      setSelectedPatientHistory([]);
      setIsEditingProfile(false);
  };

  const handleDeleteRecord = async (id: string) => {
    if (confirm('آیا مایل به حذف این رکورد ویزیت هستید؟')) {
        await deleteRecord(id);
        if (selectedPatientName) {
            const allRecords = await getAllRecords();
            const updatedHistory = allRecords.filter(r => r.name === selectedPatientName);
            if (updatedHistory.length === 0) {
                closePatientFile();
            } else {
                setSelectedPatientHistory(updatedHistory);
            }
        }
        await fetchRecords();
    }
  };

  const handleDeletePatient = async (name: string) => {
    if (confirm(`آیا از حذف کامل پرونده «${name}» و تمامی سوابق مراجعات او اطمینان دارید؟ این عمل غیرقابل بازگشت است.`)) {
        await deletePatientRecords(name);
        closePatientFile();
        await fetchRecords();
    }
  };

  const startEditing = () => {
    if (selectedPatientHistory.length === 0) return;
    const latest = selectedPatientHistory[0];
    setEditForm({
      name: latest.name,
      age: latest.age,
      gender: latest.gender,
      phoneNumber: latest.phoneNumber || '',
      allergies: latest.allergies || '',
      history: latest.history || ''
    });
    setIsEditingProfile(true);
  };

  const saveEditedProfile = async () => {
    if (!selectedPatientName || !editForm) return;
    try {
      const recordsToUpdate = groupedPatients[selectedPatientName] || [];
      for (const record of recordsToUpdate) {
        const updated = { ...record, ...editForm };
        await saveRecord(updated);
      }
      setIsEditingProfile(false);
      await fetchRecords();
      // Re-fetch history for the updated name
      const allRecords = await getAllRecords();
      const updatedHistory = allRecords.filter(r => r.name === editForm.name);
      setSelectedPatientName(editForm.name);
      setSelectedPatientHistory(updatedHistory);
    } catch (e) {
      alert("خطا در بروزرسانی پرونده");
    }
  };

  const handleReprint = (record: PatientRecord, prescriptionIndex: number) => {
     const pres = record.prescriptions && record.prescriptions[prescriptionIndex];
     if (!pres) return;
     
     const snapshotVitals = pres.manualVitals || record.vitals;
     const snapshotDiagnosis = pres.manualDiagnosis || (record.diagnosis ? record.diagnosis.modern.diagnosis : record.chiefComplaint);
     const snapshotChiefComplaint = pres.manualChiefComplaint || '';
     const items = pres.items || []; 

     const iframeId = 'tabib-reprint-frame';
     let frame = document.getElementById(iframeId) as HTMLIFrameElement;
     if (frame) document.body.removeChild(frame);
     
     frame = document.createElement('iframe');
     frame.id = iframeId;
     frame.style.position = 'fixed';
     frame.style.right = '0';
     frame.style.bottom = '0';
     frame.style.width = '0';
     frame.style.height = '0';
     frame.style.border = '0';
     document.body.appendChild(frame);

     const win = frame.contentWindow;
     if (!win) return;

     const fontFamily = settings?.fontFamily || 'Vazirmatn';
     
     let style = `
       @page { 
         margin: 0 !important; 
         size: auto; 
       }
       html, body { 
         margin: 0 !important; 
         padding: 0 !important; 
         width: 100%; 
         height: 100%; 
         overflow: hidden; 
         box-sizing: border-box;
       }
       body { 
         font-family: '${fontFamily}', 'Vazirmatn', sans-serif; 
         direction: rtl; 
         -webkit-print-color-adjust: exact; 
         print-color-adjust: exact; 
         color: #1e293b; 
       }
       .print-wrapper {
         position: absolute;
         top: 0;
         left: 0;
         width: 100%;
         height: 100%;
         margin: 0 !important;
         padding: 0 !important;
       }
       .majestic-container { position: relative; width: 100%; height: 100%; border: 4px double #1e3a8a; padding: 12mm; box-sizing: border-box; overflow: hidden; }
       .rx-watermark { position: absolute; top: 55%; left: 50%; transform: translate(-50%, -50%); font-size: 350pt; opacity: 0.04; color: #1e3a8a; z-index: -1; font-family: 'Times New Roman', serif; font-weight: bold; pointer-events: none; }
       .header-pro { display: flex; justify-content: space-between; border-bottom: 2px solid #1e3a8a; padding-bottom: 5mm; margin-bottom: 6mm; }
       .dr-name { font-size: 22pt; font-weight: 900; color: #1e3a8a; margin: 0; }
       .dr-spec { font-size: 13pt; font-weight: 700; margin-top: 2mm; color: #475569; }
       .council-box { border: 1px solid #1e3a8a; padding: 2mm 4mm; border-radius: 4px; font-size: 10pt; font-weight: 800; display: inline-block; margin-top: 3mm; }
       .patient-summary { display: flex; justify-content: space-between; background: #f8fafc; padding: 4mm; border-radius: 8px; margin-bottom: 6mm; font-size: 11pt; font-weight: 700; border: 1px solid #e2e8f0; }
       .vitals-matrix { display: grid; grid-template-columns: repeat(4, 1fr); border: 1px solid #cbd5e1; margin-bottom: 6mm; background: #fff; }
       .vital-cell { border: 0.5px solid #cbd5e1; padding: 2mm; text-align: center; }
       .vital-label { font-size: 8pt; font-weight: 900; color: #64748b; display: block; margin-bottom: 1mm; text-transform: uppercase; }
       .vital-value { font-size: 11pt; font-weight: 900; color: #1e3a8a; }
       .clinical-section { margin-bottom: 5mm; }
       .section-title { font-size: 10pt; font-weight: 900; color: #1e3a8a; border-right: 4px solid #1e3a8a; padding-right: 3mm; margin-bottom: 2mm; text-transform: uppercase; }
       .clinical-content { font-size: 12pt; line-height: 1.6; color: #334155; padding: 2mm 4mm; background: #fdfdfd; border-radius: 4px; }
       .rx-symbol { font-size: 32pt; font-weight: bold; font-family: 'Times New Roman', serif; color: #1e3a8a; margin: 5mm 0 2mm 0; border-bottom: 1px solid #e2e8f0; }
       .drug-list { list-style: none; padding: 0; margin: 0; direction: ltr; }
       .drug-item { display: flex; align-items: flex-start; margin-bottom: 5mm; font-family: 'Georgia', 'Times New Roman', serif; }
       .drug-num { font-weight: 900; width: 30px; color: #1e3a8a; font-size: 14pt; }
       .drug-details { flex: 1; }
       .drug-name { font-size: 15pt; font-weight: 900; text-transform: capitalize; color: #0f172a; margin-bottom: 1mm; }
       .drug-sig { font-size: 12pt; color: #334155; font-style: italic; font-weight: 500; }
       .drug-qty { font-weight: 900; color: #1e3a8a; margin-left: 10px; font-size: 13pt; }
       .footer-pro { margin-top: auto; padding-top: 10mm; display: flex; justify-content: space-between; align-items: flex-end; }
       .signature-area { text-align: center; border-top: 1px solid #1e3a8a; padding-top: 2mm; width: 50mm; }
       .footer-motto { font-size: 8pt; font-style: italic; color: #94a3b8; text-align: center; width: 100%; border-top: 1px solid #f1f5f9; padding-top: 4mm; margin-top: 8mm; }
       .custom-container { position: relative; width: 100%; height: 100%; overflow: hidden; padding: 0 !important; margin: 0 !important; }
       .print-element { position: absolute; white-space: normal; word-wrap: break-word; line-height: 1.4; }
       .bg-image { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: fill; z-index: -1; }
     `;

     let content = '';

     if (settings?.printBackground && settings?.backgroundImage) {
         let bgHtml = `<img id="bgImgReprint" src="${settings.backgroundImage}" class="bg-image" />`;
         const elementsHtml = settings.elements.filter(el => el.visible).map(el => {
            let innerHtml = '';
            switch (el.id) {
               case 'patientName': innerHtml = record.name || ''; break;
               case 'patientId': innerHtml = record.displayId || ''; break;
               case 'age': innerHtml = record.age || ''; break;
               case 'date': innerHtml = new Date(pres.date || record.visitDate).toLocaleDateString('fa-IR'); break;
               case 'diagnosis': innerHtml = snapshotDiagnosis || ''; break;
               case 'chiefComplaint': innerHtml = snapshotChiefComplaint || ''; break;
               case 'vital_bp': innerHtml = snapshotVitals?.bloodPressure || ''; break;
               case 'vital_hr': innerHtml = snapshotVitals?.heartRate || ''; break;
               case 'vital_rr': innerHtml = snapshotVitals?.respiratoryRate || ''; break;
               case 'vital_temp': innerHtml = snapshotVitals?.temperature || ''; break;
               case 'vital_weight': innerHtml = snapshotVitals?.weight || ''; break;
               case 'vital_o2': innerHtml = snapshotVitals?.spO2 || ''; break;
               case 'vital_bs': innerHtml = snapshotVitals?.bloodSugar || ''; break;
               case 'items':
                  innerHtml = `<ul style="list-style:none; padding:0; margin:0; direction: ltr; text-align: left; font-family: serif;">${items.map((item, i) => `<li style="margin-bottom:8px; font-size:1.1em;"><span style="font-weight:900; color:#1e3a8a;">${i+1}. ${item.drug}</span> <span style="margin:0 10px; font-weight:800;">(${item.dosage})</span><div style="font-size:0.9em; color:#444; font-style:italic;">Sig: ${item.instruction}</div></li>`).join('')}</ul>`;
                  break;
               default: innerHtml = '';
            }
            if (!innerHtml) return '';
            return `<div class="print-element" style="left: ${el.x}px; top: ${el.y}px; width: ${el.width}px; font-size: ${el.fontSize}pt; transform: rotate(${el.rotation}deg); text-align: ${el.align || (el.id === 'items' ? 'left' : 'right')};">${innerHtml}</div>`;
         }).join('');
         content = `<div class="print-wrapper"><div class="custom-container">${bgHtml}${elementsHtml}</div></div>`;
     } else {
         content = `
          <div class="print-wrapper">
            <div class="majestic-container">
               <div class="rx-watermark">℞</div>
               <div class="header-pro">
                  <div class="doc-info">
                     <h1 class="dr-name">${doctorProfile?.name || 'دکتر متخصص'}</h1>
                     <div class="dr-spec">${doctorProfile?.specialty || ''}</div>
                     <div class="council-box">نظام پزشکی: ${doctorProfile?.medicalCouncilNumber || '---'}</div>
                  </div>
                  ${doctorProfile?.logo ? `<img src="${doctorProfile.logo}" style="height: 90px; object-fit: contain;" />` : ''}
               </div>
               
               <div class="patient-summary">
                  <div><span>بیمار:</span> ${record.name}</div>
                  <div><span>ID:</span> ${record.displayId}</div>
                  <div><span>سن:</span> ${record.age || '--'}</div>
                  <div><span>تاریخ:</span> ${new Date(pres.date || record.visitDate).toLocaleDateString('fa-IR')}</div>
               </div>

               <div class="vitals-matrix">
                  <div class="vital-cell"><span class="vital-label">BP</span><span class="vital-value">${snapshotVitals?.bloodPressure || '--'}</span></div>
                  <div class="vital-cell"><span class="vital-label">HR</span><span class="vital-value">${snapshotVitals?.heartRate || '--'}</span></div>
                  <div class="vital-cell"><span class="vital-label">TEMP</span><span class="vital-value">${snapshotVitals?.temperature || '--'}</span></div>
                  <div class="vital-cell"><span class="vital-label">RR</span><span class="vital-value">${snapshotVitals?.respiratoryRate || '--'}</span></div>
                  <div class="vital-cell"><span class="vital-label">SPO2</span><span class="vital-value">${snapshotVitals?.spO2 || '--'}</span></div>
                  <div class="vital-cell"><span class="vital-label">BS</span><span class="vital-value">${snapshotVitals?.bloodSugar || '--'}</span></div>
                  <div class="vital-cell"><span class="vital-label">WT</span><span class="vital-value">${snapshotVitals?.weight || '--'}</span></div>
                  <div class="vital-cell"><span class="vital-label">HT</span><span class="vital-value">${snapshotVitals?.height || '--'}</span></div>
               </div>

               ${snapshotChiefComplaint ? `
               <div class="clinical-section">
                  <div class="section-title">Clinical Findings (CC)</div>
                  <div class="clinical-content">${snapshotChiefComplaint}</div>
               </div>` : ''}

               ${snapshotDiagnosis ? `
               <div class="clinical-section">
                  <div class="section-title">Impression / Diagnosis</div>
                  <div class="clinical-content" style="font-weight:bold; color:#1e3a8a;">${snapshotDiagnosis}</div>
               </div>` : ''}

               <div class="rx-symbol">℞</div>
               
               <ul class="drug-list">
                  ${items.map((item, i) => `
                  <li class="drug-item">
                     <div class="drug-num">${i + 1}.</div>
                     <div class="drug-details">
                        <div class="drug-name">${item.drug}</div>
                        <div class="drug-sig">Sig: ${item.instruction}</div>
                     </div>
                     <div class="drug-qty">${item.dosage}</div>
                  </li>`).join('')}
               </ul>

               <div class="footer-pro">
                  <div style="font-size:9pt; color:#64748b;">
                     <div>${doctorProfile?.address || ''}</div>
                     <div style="margin-top:1mm;">تلفن: ${doctorProfile?.phone || ''}</div>
                  </div>
                  <div class="signature-area">Signature & Stamp</div>
               </div>
               
               <div class="footer-motto">"Preserving the integrity of the profession with AI precision."</div>
            </div>
          </div>
        `;
     }

     win.document.write(`<html dir="rtl"><head><link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;700;900&display=swap" rel="stylesheet"><style>${style}</style></head><body>${content}</body></html>`);
     win.document.close();

     const bgImg = win.document.getElementById('bgImgReprint') as HTMLImageElement;
     const triggerPrint = () => {
        setTimeout(() => {
           win.print();
        }, 400);
     };

     if (bgImg && !bgImg.complete) {
        bgImg.onload = triggerPrint;
        bgImg.onerror = triggerPrint;
     } else {
        triggerPrint();
     }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      
      {/* Search & Statistics Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
         <div>
            <h1 className="text-3xl font-black text-gray-800 flex items-center gap-3">
               <Archive className="text-blue-600" size={32} />
               مدیریت پرونده‌های سلامت
            </h1>
            <p className="text-gray-500 mt-2 font-bold text-sm">مرور جامع سوابق، تشخیص‌ها و تجویزها</p>
         </div>
         <div className="bg-white px-6 py-3 rounded-2xl border border-gray-100 text-sm font-black text-blue-600 shadow-sm flex items-center gap-3">
            <UserPlus size={20} />
            تعداد کل بیماران: {Object.keys(groupedPatients).length}
         </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3 max-w-2xl group focus-within:ring-4 focus-within:ring-blue-50 transition-all">
         <Search className="text-gray-400 group-focus-within:text-blue-500 transition-colors" />
         <input 
            type="text" 
            placeholder="جستجوی نام بیمار یا کد پرونده (مثلاً 001)..." 
            className="flex-1 outline-none text-gray-700 placeholder-gray-400 text-lg font-bold"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
         />
      </div>

      {/* Patients Grid */}
      <div>
         {loading ? (
           <div className="flex justify-center p-10"><div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div></div>
         ) : filteredPatientNames.length === 0 ? (
           <div className="text-center p-20 bg-white rounded-3xl border border-gray-100 text-gray-400">
              <Archive size={64} className="mx-auto mb-4 opacity-20" />
              <p className="text-lg font-bold">پرونده‌ای یافت نشد.</p>
           </div>
         ) : (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPatientNames.map((name) => {
                 const patientRecords = groupedPatients[name] || [];
                 const latest = patientRecords[0]; 
                 if (!latest) return null;
                 return (
                    <div key={name} onClick={() => openPatientFile(name)} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-blue-400 transition-all cursor-pointer group relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div className="flex items-center gap-4">
                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-md group-hover:rotate-3 transition-transform ${latest.gender === 'male' ? 'bg-gradient-to-br from-blue-500 to-indigo-600' : 'bg-gradient-to-br from-pink-500 to-rose-600'}`}>
                                {latest.name.charAt(0)}
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-start">
                                   <h3 className="font-black text-xl text-gray-800 group-hover:text-blue-700 transition-colors">{latest.name}</h3>
                                   <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">ID: {latest.displayId}</span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1 font-bold">{latest.age} ساله • {patientRecords.length} بار مراجعه</p>
                            </div>
                        </div>
                        <div className="mt-5 pt-4 border-t border-gray-50 flex justify-between items-center text-[10px] font-black uppercase tracking-tighter text-gray-400">
                           <span className="flex items-center gap-1"><Clock size={12}/> آخرین: {new Date(latest.visitDate).toLocaleDateString('fa-IR')}</span>
                           <span className="flex items-center gap-1 group-hover:text-blue-600 transition-colors">مشاهده پرونده کامل <ChevronLeft size={12} /></span>
                        </div>
                    </div>
                 );
              })}
           </div>
         )}
      </div>

      {/* Patient File Modal */}
      {selectedPatientName && selectedPatientHistory.length > 0 && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-0 lg:p-4 animate-fade-in">
            <div className="bg-white w-full lg:max-w-6xl h-full lg:h-[90vh] lg:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden relative">
                
                {/* Modal Header */}
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div className="flex items-center gap-5">
                        <div className={`w-16 h-16 lg:w-20 lg:h-20 rounded-2xl lg:rounded-3xl flex items-center justify-center text-white font-black text-2xl lg:text-3xl shadow-xl ${selectedPatientHistory[0].gender === 'male' ? 'bg-blue-600' : 'bg-pink-600'}`}>
                            {selectedPatientName.charAt(0)}
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                               <h2 className="text-xl lg:text-3xl font-black text-gray-800">{selectedPatientName}</h2>
                               <span className="bg-gray-800 text-white text-[10px] lg:text-xs px-2 lg:px-3 py-1 rounded-full font-bold">#{selectedPatientHistory[0].displayId}</span>
                            </div>
                            <div className="flex flex-wrap gap-2 lg:gap-4 text-[10px] lg:text-xs font-black text-gray-500 mt-2">
                                <span className="flex items-center gap-1 text-blue-600"><Hash size={14}/> سن: {selectedPatientHistory[0].age}</span>
                                <span className="flex items-center gap-1 text-teal-600"><Phone size={14}/> تماس: {selectedPatientHistory[0].phoneNumber || 'ثبت نشده'}</span>
                                <span className="flex items-center gap-1 text-purple-600"><Archive size={14}/> مراجعات: {selectedPatientHistory.length}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                       <button onClick={() => handleDeletePatient(selectedPatientName)} className="p-3 bg-white border border-red-100 rounded-2xl text-red-500 hover:bg-red-50 transition-colors shadow-sm flex items-center gap-2 font-bold text-sm">
                          <Trash2 size={20}/> حذف کل پرونده
                       </button>
                       <button onClick={startEditing} className="hidden lg:flex p-3 bg-white border border-gray-200 rounded-2xl text-blue-600 hover:bg-blue-50 transition-colors shadow-sm items-center gap-2 font-bold text-sm">
                          <Edit3 size={20}/> ویرایش مشخصات
                       </button>
                       <button onClick={closePatientFile} className="p-3 bg-white border border-gray-200 rounded-2xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors shadow-sm"><X size={24} /></button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-slate-50 flex flex-col lg:flex-row">
                    
                    {/* Left Sidebar: Allergies & Basic History */}
                    <div className="lg:w-80 p-6 border-l border-gray-100 bg-white space-y-8">
                       <button onClick={startEditing} className="lg:hidden w-full p-4 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center gap-2 font-black mb-4 border border-blue-100"><Edit3 size={18}/> ویرایش اطلاعات پایه</button>
                       <div>
                          <h4 className="font-black text-red-600 flex items-center gap-2 mb-4 text-sm uppercase tracking-widest"><AlertCircle size={18}/> حساسیت‌ها و آلرژی</h4>
                          <div className={`p-4 rounded-2xl border-2 border-dashed ${selectedPatientHistory[0].allergies ? 'bg-red-50 border-red-200 text-red-900 font-black' : 'bg-gray-50 border-gray-200 text-gray-400 font-medium'}`}>
                             {selectedPatientHistory[0].allergies || 'هیچ حساسیتی ثبت نشده است'}
                          </div>
                       </div>
                       <div>
                          <h4 className="font-black text-gray-700 flex items-center gap-2 mb-4 text-sm uppercase tracking-widest"><FileText size={18}/> سوابق زمینه ای</h4>
                          <p className="text-sm text-gray-600 leading-relaxed font-bold bg-gray-50 p-4 rounded-2xl border border-gray-100">
                             {selectedPatientHistory[0].history || 'اطلاعاتی ثبت نشده'}
                          </p>
                       </div>
                    </div>

                    {/* Main Content: Visits History */}
                    <div className="flex-1 p-6 lg:p-10 space-y-12">
                        <h3 className="text-2xl font-black text-gray-800 flex items-center gap-3 mb-8">
                           <History size={28} className="text-indigo-600" />
                           تاریخچه مراجعات و نسخه‌ها
                        </h3>
                        
                        <div className="space-y-12">
                            {selectedPatientHistory.map((record) => (
                                <div key={record.id} className="relative pl-8 group">
                                    <div className="absolute top-0 right-[-11px] bottom-0 w-0.5 bg-gray-200 group-last:bg-transparent z-0"></div>
                                    <div className="absolute top-0 right-[-20px] w-5 h-5 rounded-full bg-white border-4 border-indigo-500 z-10 shadow-sm"></div>
                                    
                                    <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-6 lg:p-8 hover:shadow-xl hover:border-indigo-200 transition-all">
                                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                                            <div className="flex items-center gap-4">
                                               <div className="bg-indigo-50 p-3 rounded-2xl text-indigo-600"><Clock size={24}/></div>
                                               <div>
                                                  <span className="text-lg font-black text-gray-800">مراجعه: {new Date(record.visitDate).toLocaleDateString('fa-IR')}</span>
                                                  <p className="text-xs text-gray-400 font-bold mt-1">{new Date(record.visitDate).toLocaleTimeString('fa-IR', {hour: '2-digit', minute:'2-digit'})}</p>
                                               </div>
                                            </div>
                                            <button onClick={() => handleDeleteRecord(record.id)} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all" title="حذف این وویزیت">
                                               <Trash2 size={20} />
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                                            {/* Visit Info */}
                                            <div className="lg:col-span-4 space-y-6">
                                                <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100">
                                                   <h5 className="font-black text-blue-800 text-[10px] mb-4 flex items-center gap-2 uppercase tracking-widest"><Activity size={14}/> علائم حیاتی ثبت شده</h5>
                                                   <div className="grid grid-cols-3 gap-2">
                                                      {[
                                                         { l: 'BP', v: record.vitals?.bloodPressure, c: 'text-red-600' },
                                                         { l: 'HR', v: record.vitals?.heartRate, c: 'text-rose-600' },
                                                         { l: 'Temp', v: record.vitals?.temperature, c: 'text-orange-600' },
                                                         { l: 'Weight', v: record.vitals?.weight, c: 'text-indigo-600' },
                                                         { l: 'BS', v: record.vitals?.bloodSugar, c: 'text-pink-600' },
                                                         { l: 'SpO2', v: record.vitals?.spO2, c: 'text-cyan-600' },
                                                      ].map(v => (
                                                        <div key={v.l} className="bg-white p-2 rounded-xl text-center border border-blue-50 shadow-inner">
                                                           <span className="text-[9px] text-gray-400 font-black block mb-0.5">{v.l}</span>
                                                           <span className={`text-[10px] font-black ${v.c}`}>{v.v || '-'}</span>
                                                        </div>
                                                      ))}
                                                   </div>
                                                </div>
                                                <div>
                                                   <h5 className="font-black text-gray-700 text-[10px] mb-3 uppercase tracking-widest flex items-center gap-2"><FileText size={14}/> تشخیص پزشک در این ویزیت</h5>
                                                   <p className="text-xs font-bold text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-2xl border border-gray-200 shadow-inner">
                                                      {record.diagnosis?.modern.diagnosis || record.chiefComplaint || 'تشخیصی ثبت نشده'}
                                                   </p>
                                                </div>
                                            </div>

                                            {/* ALL Prescriptions for this Visit */}
                                            <div className="lg:col-span-8 space-y-6">
                                               <h5 className="font-black text-gray-700 text-[10px] mb-2 uppercase tracking-widest flex items-center gap-2"><Pill size={14} className="text-indigo-500" /> برگه‌های نسخه صادر شده</h5>
                                               <div className="space-y-4">
                                                  {record.prescriptions && record.prescriptions.length > 0 ? (
                                                     record.prescriptions.map((pres, pIdx) => (
                                                        <div key={pres.id} className="bg-white p-4 lg:p-6 rounded-3xl border border-gray-100 shadow-sm hover:border-indigo-300 transition-all group/pres">
                                                           <div className="flex justify-between items-center mb-4 border-b border-gray-50 pb-4">
                                                              <div className="flex items-center gap-2">
                                                                 <div className="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center text-xs font-black shadow-lg shadow-indigo-100">{pIdx + 1}</div>
                                                                 <span className="text-sm font-black text-gray-800">نسخه شماره {pIdx + 1}</span>
                                                                 <span className="text-[10px] text-gray-400 font-bold bg-gray-50 px-2 py-0.5 rounded-full">{new Date(pres.date || record.visitDate).toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'})}</span>
                                                              </div>
                                                              <button onClick={() => handleReprint(record, pIdx)} className="flex items-center gap-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-600 hover:text-white px-4 py-2 rounded-xl transition-all font-black text-xs">
                                                                 <Printer size={16} /> چاپ مجدد
                                                              </button>
                                                           </div>
                                                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                              {pres.items.map((med, mIdx) => (
                                                                 <div key={mIdx} className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl">
                                                                    <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-[10px] font-black text-indigo-500 shadow-sm">{mIdx + 1}</div>
                                                                    <div className="flex-1 min-w-0">
                                                                       <p className="text-xs font-black text-gray-800 truncate">{med.drug}</p>
                                                                       <div className="flex justify-between mt-1">
                                                                          <span className="text-[9px] text-gray-400 font-bold">Sig: {med.instruction}</span>
                                                                          <span className="text-[9px] font-black text-indigo-600">Qty: {med.dosage}</span>
                                                                       </div>
                                                                    </div>
                                                                 </div>
                                                              ))}
                                                           </div>
                                                           {pres.manualChiefComplaint && <div className="mt-3 text-[10px] text-indigo-600 bg-indigo-50 p-2 rounded-lg font-bold">شکایت اصلی: {pres.manualChiefComplaint}</div>}
                                                           {pres.notes && <div className="mt-3 text-[10px] text-gray-500 bg-gray-50 p-2 rounded-lg italic">یادداشت: {pres.notes}</div>}
                                                        </div>
                                                     ))
                                                  ) : (
                                                     <div className="text-center py-10 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                                                        <Pill className="mx-auto text-gray-300 mb-2 opacity-30" />
                                                        <p className="text-xs text-gray-400 font-bold">نسخه دارویی برای این مراجعه ثبت نشده است</p>
                                                     </div>
                                                  )}
                                               </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Edit Profile Modal (Nested) */}
            {isEditingProfile && editForm && (
               <div className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-md flex items-center justify-center p-4">
                  <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-slide-up flex flex-col">
                     <div className="p-8 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                        <h3 className="text-2xl font-black text-gray-800 flex items-center gap-3"><Edit3 className="text-blue-600" /> ویرایش اطلاعات پایه بیمار</h3>
                        <button onClick={() => setIsEditingProfile(false)} className="p-2 text-gray-400 hover:text-red-500"><X /></button>
                     </div>
                     <div className="p-8 space-y-6 overflow-y-auto max-h-[70vh]">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div className="space-y-2"><label className="text-xs font-black text-gray-500 uppercase tracking-widest mr-1">نام و نام خانوادگی</label><input className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} /></div>
                           <div className="space-y-2"><label className="text-xs font-black text-gray-500 uppercase tracking-widest mr-1">شماره تماس</label><input className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-left" dir="ltr" value={editForm.phoneNumber} onChange={e => setEditForm({...editForm, phoneNumber: e.target.value})} /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-2"><label className="text-xs font-black text-gray-500 uppercase tracking-widest mr-1">سن</label><input type="number" className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-center" value={editForm.age} onChange={e => setEditForm({...editForm, age: e.target.value})} /></div>
                           <div className="space-y-2"><label className="text-xs font-black text-gray-500 uppercase tracking-widest mr-1">جنسیت</label><select className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold" value={editForm.gender} onChange={e => setEditForm({...editForm, gender: e.target.value as any})}><option value="male">آقا</option><option value="female">خانم</option></select></div>
                        </div>
                        <div className="space-y-2"><label className="text-xs font-black text-red-600 uppercase tracking-widest mr-1">حساسیت‌ها و آلرژی</label><textarea className="w-full p-4 bg-red-50/50 border border-red-100 rounded-2xl font-bold text-red-900 h-24 resize-none" value={editForm.allergies} onChange={e => setEditForm({...editForm, allergies: e.target.value})} /></div>
                        <div className="space-y-2"><label className="text-xs font-black text-gray-500 uppercase tracking-widest mr-1">خلاصه سوابق</label><textarea className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-gray-700 h-24 resize-none" value={editForm.history} onChange={e => setEditForm({...editForm, history: e.target.value})} /></div>
                     </div>
                     <div className="p-8 bg-gray-50 border-t border-gray-100">
                        <button onClick={saveEditedProfile} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black shadow-xl shadow-blue-100 hover:bg-blue-700 flex items-center justify-center gap-3 text-lg"><Save size={24}/> ذخیره تغییرات پرونده</button>
                     </div>
                  </div>
               </div>
            )}
        </div>
      )}

    </div>
  );
};

export default Dashboard;
