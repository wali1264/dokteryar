
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
  const [groupedPatients, setGroupedPatients] = useState<Record<string, PatientRecord[]>>({});
  const [selectedPatientName, setSelectedPatientName] = useState<string | null>(null);
  const [selectedPatientHistory, setSelectedPatientHistory] = useState<PatientRecord[]>([]);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editForm, setEditForm] = useState<any>(null);
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
  const [settings, setSettings] = useState<PrescriptionSettings | null>(null);

  useEffect(() => { fetchRecords(); }, []);

  const fetchRecords = async () => {
    try {
      const data = await getAllRecords();
      setRecords(data);
      const groups: Record<string, PatientRecord[]> = {};
      data.forEach(r => { if (!groups[r.name]) groups[r.name] = []; groups[r.name].push(r); });
      setGroupedPatients(groups);
      const p = await getDoctorProfile(); if (p) setDoctorProfile(p);
      const s = await getSettings(); if (s) setSettings(s);
    } catch (e) { console.error("DB Error", e); } finally { setLoading(false); }
  };

  const filteredPatientNames = Object.keys(groupedPatients).filter(name => {
    const patientRecords = groupedPatients[name] || [];
    const displayId = patientRecords[0]?.displayId || "";
    return name.includes(searchTerm) || displayId.includes(searchTerm);
  });

  const openPatientFile = (name: string) => { setSelectedPatientName(name); setSelectedPatientHistory(groupedPatients[name] || []); };
  const closePatientFile = () => { setSelectedPatientName(null); setSelectedPatientHistory([]); setIsEditingProfile(false); };

  const handleDeleteRecord = async (id: string) => {
    if (confirm('آیا مایل به حذف این رکورد ویزیت هستید؟')) {
        await deleteRecord(id);
        if (selectedPatientName) {
            const allRecords = await getAllRecords();
            const updatedHistory = allRecords.filter(r => r.name === selectedPatientName);
            if (updatedHistory.length === 0) closePatientFile(); else setSelectedPatientHistory(updatedHistory);
        }
        await fetchRecords();
    }
  };

  const handleDeletePatient = async (name: string) => {
    if (confirm(`آیا از حذف کامل پرونده «${name}» اطمینان دارید؟`)) { await deletePatientRecords(name); closePatientFile(); await fetchRecords(); }
  };

  const startEditing = () => {
    if (selectedPatientHistory.length === 0) return;
    const latest = selectedPatientHistory[0];
    setEditForm({ name: latest.name, age: latest.age, gender: latest.gender, phoneNumber: latest.phoneNumber || '', allergies: latest.allergies || '', history: latest.history || '' });
    setIsEditingProfile(true);
  };

  const saveEditedProfile = async () => {
    if (!selectedPatientName || !editForm) return;
    try {
      const recordsToUpdate = groupedPatients[selectedPatientName] || [];
      for (const record of recordsToUpdate) { const updated = { ...record, ...editForm }; await saveRecord(updated); }
      setIsEditingProfile(false); await fetchRecords();
      const allRecords = await getAllRecords();
      const updatedHistory = allRecords.filter(r => r.name === editForm.name);
      setSelectedPatientName(editForm.name); setSelectedPatientHistory(updatedHistory);
    } catch (e) { alert("خطا در بروزرسانی پرونده"); }
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
     frame = document.createElement('iframe'); frame.id = iframeId; frame.style.position = 'fixed'; frame.style.right = '0'; frame.style.bottom = '0'; frame.style.width = '0'; frame.style.height = '0'; frame.style.border = '0'; document.body.appendChild(frame);
     const win = frame.contentWindow; if (!win) return;
     const fontFamily = settings?.fontFamily || 'Vazirmatn';
     const paperSize = settings?.paperSize || 'A4';
     
     // CRITICAL: margin 0 and removal of SIG: label
     let style = `
       @page { size: ${paperSize} portrait; margin: 0; }
       html, body { margin: 0; padding: 0; box-sizing: border-box; width: 100%; height: 100%; }
       body { font-family: '${fontFamily}', 'Vazirmatn', sans-serif; direction: rtl; -webkit-print-color-adjust: exact; print-color-adjust: exact; color: #1e293b; overflow: hidden; }
       .majestic-container { position: relative; width: 100%; height: 100%; padding: 12mm; box-sizing: border-box; border: 4px double #1e3a8a; }
       .header-pro { display: flex; justify-content: space-between; border-bottom: 2px solid #1e3a8a; padding-bottom: 5mm; margin-bottom: 6mm; }
       .dr-name { font-size: 22pt; font-weight: 900; color: #1e3a8a; margin: 0; }
       .patient-summary { display: flex; justify-content: space-between; background: #f8fafc; padding: 4mm; border-radius: 8px; margin-bottom: 6mm; font-size: 11pt; font-weight: 700; border: 1px solid #e2e8f0; }
       .drug-list { list-style: none; padding: 0; margin: 0; direction: ltr; }
       .drug-item { display: flex; align-items: flex-start; margin-bottom: 5mm; }
       .drug-name { font-size: 15pt; font-weight: 900; color: #0f172a; margin-bottom: 1mm; }
       .drug-sig { font-size: 12pt; color: #334155; font-style: italic; }
       .custom-container { position: relative; width: 100%; height: 100%; overflow: hidden; margin: 0; padding: 0; }
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
               case 'items':
                  innerHtml = `<ul style="list-style:none; padding:0; margin:0; direction: ltr; text-align: left;">${items.map((item, i) => `<li style="margin-bottom:8px;"><span style="font-weight:900; color:#1e3a8a;">${i+1}. ${item.drug}</span> <span style="margin:0 10px; font-weight:800;">(${item.dosage})</span><div style="font-size:0.9em; color:#444; font-style:italic;">${item.instruction}</div></li>`).join('')}</ul>`;
                  break;
               default: innerHtml = '';
            }
            if (!innerHtml) return '';
            return `<div class="print-element" style="left: ${el.x}px; top: ${el.y}px; width: ${el.width}px; font-size: ${el.fontSize}pt; transform: rotate(${el.rotation}deg); text-align: ${el.align || (el.id === 'items' ? 'left' : 'right')};">${innerHtml}</div>`;
         }).join('');
         content = `<div class="custom-container">${bgHtml}${elementsHtml}</div>`;
     } else {
         content = `
          <div class="majestic-container">
             <div class="header-pro"><div class="doc-info"><h1 class="dr-name">${doctorProfile?.name || 'دکتر متخصص'}</h1><div style="font-size:13pt; font-weight:700; color:#475569;">${doctorProfile?.specialty || ''}</div></div></div>
             <div class="patient-summary"><div><span>بیمار:</span> ${record.name}</div><div><span>ID:</span> ${record.displayId}</div><div><span>سن:</span> ${record.age || '--'}</div><div><span>تاریخ:</span> ${new Date(pres.date || record.visitDate).toLocaleDateString('fa-IR')}</div></div>
             <ul class="drug-list">${items.map((item, i) => `<li class="drug-item"><div style="font-weight:900; width:30px; color:#1e3a8a; font-size:14pt;">${i + 1}.</div><div style="flex:1;"><div class="drug-name">${item.drug}</div><div class="drug-sig">${item.instruction}</div></div><div style="font-weight:900; color:#1e3a8a; margin-left:10px; font-size:13pt;">${item.dosage}</div></li>`).join('')}</ul>
          </div>
        `;
     }
     win.document.write(`<html dir="rtl"><head><link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;700;900&display=swap" rel="stylesheet"><style>${style}</style></head><body>${content}</body></html>`);
     win.document.close();
     const bgImg = win.document.getElementById('bgImgReprint') as HTMLImageElement;
     const triggerPrint = () => { setTimeout(() => { win.print(); }, 300); };
     if (bgImg && !bgImg.complete) { bgImg.onload = triggerPrint; bgImg.onerror = triggerPrint; } else { triggerPrint(); }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
         <div><h1 className="text-3xl font-black text-gray-800 flex items-center gap-3"><Archive className="text-blue-600" size={32} />مدیریت پرونده‌های سلامت</h1><p className="text-gray-500 mt-2 font-bold text-sm">مرور جامع سوابق و تجویزها</p></div>
         <div className="bg-white px-6 py-3 rounded-2xl border border-gray-100 text-sm font-black text-blue-600 shadow-sm flex items-center gap-3"><UserPlus size={20} />کل بیماران: {Object.keys(groupedPatients).length}</div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3 max-w-2xl group focus-within:ring-4 focus-within:ring-blue-50 transition-all">
         <Search className="text-gray-400 group-focus-within:text-blue-500 transition-colors" />
         <input type="text" placeholder="جستجوی نام یا کد پرونده..." className="flex-1 outline-none text-gray-700 placeholder-gray-400 text-lg font-bold" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>

      <div>
         {loading ? (
           <div className="flex justify-center p-10"><div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div></div>
         ) : (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
              {filteredPatientNames.map((name) => {
                 const patientRecords = groupedPatients[name] || [];
                 const latest = patientRecords[0]; if (!latest) return null;
                 return (
                    <div key={name} onClick={() => openPatientFile(name)} className="bg-white p-5 lg:p-6 rounded-[1.5rem] lg:rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-blue-400 transition-all cursor-pointer group relative overflow-hidden flex lg:block items-center gap-4">
                        <div className={`w-14 h-14 lg:w-16 lg:h-16 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-md ${latest.gender === 'male' ? 'bg-gradient-to-br from-blue-500 to-indigo-600' : 'bg-gradient-to-br from-pink-500 to-rose-600'}`}>{latest.name.charAt(0)}</div>
                        <div className="flex-1">
                            <div className="flex justify-between items-start">
                               <h3 className="font-black text-lg lg:text-xl text-gray-800 truncate">{latest.name}</h3>
                               <span className="hidden lg:inline-block text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">#{latest.displayId}</span>
                            </div>
                            <p className="text-xs text-gray-400 font-bold mt-0.5">{latest.age} ساله • {patientRecords.length} ویزیت</p>
                            <div className="lg:mt-5 pt-3 lg:border-t border-gray-50 flex justify-between items-center text-[10px] font-black text-gray-400">
                               <span className="flex items-center gap-1"><Clock size={10}/> {new Date(latest.visitDate).toLocaleDateString('fa-IR')}</span>
                               <span className="lg:flex items-center gap-1 hidden group-hover:text-blue-600">پرونده کامل <ChevronLeft size={12} /></span>
                            </div>
                        </div>
                    </div>
                 );
              })}
           </div>
         )}
      </div>

      {selectedPatientName && selectedPatientHistory.length > 0 && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-0 lg:p-4 animate-fade-in">
            <div className="bg-white w-full lg:max-w-6xl h-full lg:h-[90vh] lg:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden relative">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 lg:w-20 lg:h-20 rounded-2xl lg:rounded-3xl flex items-center justify-center text-white font-black text-2xl lg:text-3xl shadow-xl ${selectedPatientHistory[0].gender === 'male' ? 'bg-blue-600' : 'bg-pink-600'}`}>{selectedPatientName.charAt(0)}</div>
                        <div><h2 className="text-xl lg:text-3xl font-black text-gray-800">{selectedPatientName}</h2><p className="text-[10px] lg:text-xs font-black text-gray-500">کد پرونده: #{selectedPatientHistory[0].displayId} • {selectedPatientHistory[0].age} ساله</p></div>
                    </div>
                    <div className="flex gap-1 lg:gap-2">
                       <button onClick={() => handleDeletePatient(selectedPatientName)} className="p-2 lg:p-3 text-red-500 bg-white border border-red-100 rounded-xl lg:rounded-2xl hover:bg-red-50 transition-all shadow-sm"><Trash2 size={20}/></button>
                       <button onClick={startEditing} className="p-2 lg:p-3 text-blue-600 bg-white border border-blue-100 rounded-xl lg:rounded-2xl hover:bg-blue-50 transition-all shadow-sm"><Edit3 size={20}/></button>
                       <button onClick={closePatientFile} className="p-2 lg:p-3 text-gray-400 bg-white border border-gray-200 rounded-xl lg:rounded-2xl hover:text-red-500 shadow-sm"><X size={24} /></button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto bg-slate-50 flex flex-col lg:flex-row">
                    <div className="lg:w-80 p-6 border-l border-gray-100 bg-white space-y-6">
                       <div><h4 className="font-black text-red-600 flex items-center gap-2 mb-3 text-xs uppercase tracking-widest"><AlertCircle size={16}/> حساسیت‌ها</h4><div className={`p-4 rounded-2xl border-2 border-dashed ${selectedPatientHistory[0].allergies ? 'bg-red-50 border-red-200 text-red-900 font-black' : 'bg-gray-50 border-gray-200 text-gray-400 font-medium'}`}>{selectedPatientHistory[0].allergies || 'موردی ثبت نشده'}</div></div>
                       <div><h4 className="font-black text-gray-700 flex items-center gap-2 mb-3 text-xs uppercase tracking-widest"><FileText size={16}/> سوابق زمینه ای</h4><p className="text-sm text-gray-600 leading-relaxed font-bold bg-gray-50 p-4 rounded-2xl border border-gray-100">{selectedPatientHistory[0].history || '---'}</p></div>
                    </div>
                    <div className="flex-1 p-5 lg:p-10 space-y-10">
                        {selectedPatientHistory.map((record) => (
                            <div key={record.id} className="relative pl-0 lg:pl-8 group">
                                <div className="absolute top-0 right-[-11px] bottom-0 w-0.5 bg-gray-200 group-last:bg-transparent z-0 hidden lg:block"></div>
                                <div className="absolute top-0 right-[-20px] w-5 h-5 rounded-full bg-white border-4 border-indigo-500 z-10 shadow-sm hidden lg:block"></div>
                                <div className="bg-white rounded-[2rem] lg:rounded-3xl shadow-sm border border-gray-200 p-6 lg:p-8 hover:shadow-xl transition-all">
                                    <div className="flex justify-between items-center mb-6"><div className="flex items-center gap-4"><div className="bg-indigo-50 p-2 lg:p-3 rounded-xl lg:rounded-2xl text-indigo-600"><Clock size={24}/></div><div><span className="text-base lg:text-lg font-black text-gray-800">مراجعه: {new Date(record.visitDate).toLocaleDateString('fa-IR')}</span><p className="text-[10px] text-gray-400 font-bold">{new Date(record.visitDate).toLocaleTimeString('fa-IR', {hour: '2-digit', minute:'2-digit'})}</p></div></div><button onClick={() => handleDeleteRecord(record.id)} className="p-2 text-gray-200 hover:text-red-500"><Trash2 size={20} /></button></div>
                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                                        <div className="lg:col-span-4 space-y-4">
                                            <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100"><h5 className="font-black text-blue-800 text-[10px] mb-3 uppercase tracking-widest flex items-center gap-1"><Activity size={14}/> علائم حیاتی</h5><div className="grid grid-cols-3 gap-2">{[{ l: 'BP', v: record.vitals?.bloodPressure, c: 'text-red-600' },{ l: 'HR', v: record.vitals?.heartRate, c: 'text-rose-600' },{ l: 'Temp', v: record.vitals?.temperature, c: 'text-orange-600' }].map(v => (<div key={v.l} className="bg-white p-2 rounded-xl text-center border border-blue-50 shadow-inner"><span className="text-[8px] text-gray-400 font-black block">{v.l}</span><span className={`text-[9px] font-black ${v.c}`}>{v.v || '-'}</span></div>))}</div></div>
                                            <div><h5 className="font-black text-gray-700 text-[10px] mb-2 uppercase flex items-center gap-1"><FileText size={14}/> تشخیص</h5><p className="text-xs font-bold text-gray-600 bg-gray-50 p-3 rounded-xl border border-gray-200">{record.diagnosis?.modern.diagnosis || record.chiefComplaint || '---'}</p></div>
                                        </div>
                                        <div className="lg:col-span-8 space-y-4"><h5 className="font-black text-gray-700 text-[10px] mb-1 uppercase flex items-center gap-1"><Pill size={14} className="text-indigo-500" /> نسخه‌ها</h5>
                                           {record.prescriptions?.map((pres, pIdx) => (<div key={pres.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:border-indigo-300 transition-all"><div className="flex justify-between items-center mb-3 border-b border-gray-50 pb-3"><div className="flex items-center gap-2"><div className="w-7 h-7 bg-indigo-600 text-white rounded-lg flex items-center justify-center text-[10px] font-black">{pIdx + 1}</div><span className="text-xs font-black text-gray-800">نسخه {pIdx + 1}</span></div><button onClick={() => handleReprint(record, pIdx)} className="flex items-center gap-2 text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg transition-all font-black text-[10px]"><Printer size={14} /> چاپ</button></div><div className="grid grid-cols-1 md:grid-cols-2 gap-3">{pres.items.map((med, mIdx) => (<div key={mIdx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl"><div className="flex-1 min-w-0"><p className="text-[11px] font-black text-gray-800 truncate">{med.drug}</p><div className="flex justify-between mt-0.5"><span className="text-[9px] text-gray-400 font-bold">{med.instruction}</span><span className="text-[9px] font-black text-indigo-600">Qty: {med.dosage}</span></div></div></div>))}</div></div>))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            {isEditingProfile && editForm && (<div className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-md flex items-center justify-center p-4"><div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-slide-up flex flex-col"><div className="p-8 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center"><h3 className="text-2xl font-black text-gray-800 flex items-center gap-3"><Edit3 className="text-blue-600" /> ویرایش بیمار</h3><button onClick={() => setIsEditingProfile(false)} className="p-2 text-gray-400 hover:text-red-500"><X /></button></div><div className="p-8 space-y-6 overflow-y-auto max-h-[70vh]"><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="space-y-2"><label className="text-xs font-black text-gray-500">نام</label><input className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} /></div><div className="space-y-2"><label className="text-xs font-black text-gray-500">تلفن</label><input className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold" dir="ltr" value={editForm.phoneNumber} onChange={e => setEditForm({...editForm, phoneNumber: e.target.value})} /></div></div><div className="space-y-2"><label className="text-xs font-black text-red-600">آلرژی</label><textarea className="w-full p-4 bg-red-50/50 border border-red-100 rounded-2xl font-bold text-red-900 h-20" value={editForm.allergies} onChange={e => setEditForm({...editForm, allergies: e.target.value})} /></div></div><div className="p-8 bg-gray-50 border-t border-gray-100"><button onClick={saveEditedProfile} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black shadow-xl flex items-center justify-center gap-3 text-lg"><Save size={24}/> ذخیره تغییرات</button></div></div></div>)}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
