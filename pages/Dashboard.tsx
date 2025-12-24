
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

     const win = window.open('', '', 'width=900,height=1200');
     if (!win) return;

     const fontFamily = settings?.fontFamily || 'Vazirmatn';
     const paperSize = settings?.paperSize || 'A4';
     
     let style = `
       @page { size: ${paperSize} portrait; margin: 0; }
       html, body { height: 100%; }
       body { font-family: '${fontFamily}', sans-serif; margin: 0; direction: rtl; padding-top: 60px; -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
       .rx-container { padding: 40px; box-sizing: border-box; }
       .rx-table { width: 100%; border-collapse: collapse; margin-top: 20px; direction: ltr; }
       .rx-table th, .rx-table td { border-bottom: 1px solid #ddd; padding: 12px; text-align: left; }
       .rx-table th { background-color: #f8f9fa; }
       .rx-symbol { font-size: 32px; font-weight: bold; margin: 20px 0; font-family: serif; }
       .digital-header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
       .control-bar { position: fixed; top: 0; left: 0; right: 0; background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); padding: 12px; display: flex; justify-content: center; gap: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); z-index: 9999; border-bottom: 1px solid #eee; }
       .btn { padding: 10px 24px; border-radius: 12px; border: none; font-weight: bold; cursor: pointer; }
       .btn-print { background: #2563eb; color: white; }
       .btn-close { background: #fee2e2; color: #ef4444; }
       @media print { .no-print { display: none !important; } html, body { height: 100%; margin: 0 !important; padding: 0 !important; overflow: hidden; } .custom-container, .rx-container { width: 100%; height: 100%; max-height: 100%; page-break-after: avoid; page-break-inside: avoid; break-inside: avoid; overflow: hidden; transform: scale(0.98); transform-origin: top center; } .print-element { position: absolute; white-space: nowrap; } }
     `;

     const controlHtml = `<div class="control-bar no-print"><button class="btn btn-print" onclick="window.print()">چاپ نهایی</button><button class="btn btn-close" onclick="window.close()">بستن</button></div>`;
     let content = '';

     if (settings?.printBackground && settings?.elements && settings.elements.length > 0) {
         let bgHtml = settings.backgroundImage ? `<img src="${settings.backgroundImage}" style="position: absolute; top:0; left:0; width:100%; height:100%; object-fit: fill; z-index:-1;" />` : '';
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
               case 'items':
                  innerHtml = `<ul style="list-style:none; padding:0; margin:0; direction: ltr; text-align: left;">${items.map((item, i) => `<li style="margin-bottom:8px;"><span style="font-weight:bold;">${i+1}. ${item.drug}</span><span style="margin:0 10px;">${item.dosage}</span><div style="font-size:0.9em; color:#444;">${item.instruction}</div></li>`).join('')}</ul>`;
                  break;
               default: innerHtml = '';
            }
            if (!innerHtml) return '';
            return `<div class="print-element" style="left: ${el.x}px; top: ${el.y}px; width: ${el.width}px; font-size: ${el.fontSize}pt; transform: rotate(${el.rotation}deg); text-align: ${el.align || (el.id === 'items' ? 'left' : 'right')};">${innerHtml}</div>`;
         }).join('');
         content = `<div class="custom-container" style="position: relative; width: 100%; height: 100%; overflow: hidden;">${bgHtml}${elementsHtml}</div>`;
     } else {
         content = `<div class="rx-container"><div class="digital-header"><div class="doc-info"><h1 style="margin:0; font-size:24px;">${doctorProfile?.name || 'دکتر ...'}</h1><p style="margin:5px 0;">${doctorProfile?.specialty || ''}</p><p style="font-size:12px;">نظام پزشکی: ${doctorProfile?.medicalCouncilNumber || '---'}</p></div>${doctorProfile?.logo ? `<img src="${doctorProfile.logo}" style="height: 80px; object-fit: contain;" />` : ''}</div><div style="background:#f3f4f6; padding:15px; border-radius:10px; display:flex; gap:20px; margin-bottom:20px;"><div><strong>نام بیمار:</strong> ${record.name} (ID: ${record.displayId})</div>${record.age ? `<div><strong>سن:</strong> ${record.age}</div>` : ''}<div><strong>تاریخ:</strong> ${new Date(pres.date || record.visitDate).toLocaleDateString('fa-IR')}</div></div><div style="font-size: 12px; margin-bottom: 10px; display: flex; gap: 15px; color: #555;">${snapshotVitals?.bloodPressure ? `<span><strong>BP:</strong> ${snapshotVitals.bloodPressure}</span>` : ''}${snapshotVitals?.heartRate ? `<span><strong>HR:</strong> ${snapshotVitals.heartRate}</span>` : ''}</div>${snapshotChiefComplaint ? `<div style="margin-bottom:10px; padding:10px; background:#f9fafb; border-radius:8px;"><strong>شکایت اصلی:</strong> ${snapshotChiefComplaint}</div>` : ''}${(snapshotDiagnosis) ? `<div style="margin-bottom:20px; padding:10px; border:1px dashed #ccc;"><strong>تشخیص:</strong> ${snapshotDiagnosis}</div>` : ''}<div class="rx-symbol">Rx</div><table class="rx-table"><thead><tr><th>#</th><th>Drug Name</th><th>Dosage</th><th>Instruction</th></tr></thead><tbody>${items.map((item, i) => `<tr><td>${i + 1}</td><td style="font-weight:bold;">${item.drug}</td><td>${item.dosage}</td><td>${item.instruction}</td></tr>`).join('')}</tbody></table></div>`;
     }

     win.document.write(`<html dir="rtl"><head><link href="https://fonts.googleapis.com/css2?family=Vazirmatn&display=swap" rel="stylesheet"><style>${style}</style></head><body>${controlHtml}${content}</body></html>`);
     win.document.close();
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
                                            <button onClick={() => handleDeleteRecord(record.id)} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all" title="حذف این ویزیت">
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
