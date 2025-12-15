
import React, { useEffect, useState } from 'react';
import { getAllRecords, getDoctorProfile, getSettings } from '../services/db';
import { PatientRecord, AppRoute, PrescriptionItem, DoctorProfile, PrescriptionSettings } from '../types';
import { Search, Archive, User, FileText, ChevronLeft, Clock, Printer, X, Activity, Pill } from 'lucide-react';

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

  // Print State
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
  const [settings, setSettings] = useState<PrescriptionSettings | null>(null);

  useEffect(() => {
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

        // Preload print settings
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
    fetchRecords();
  }, []);

  const filteredPatientNames = Object.keys(groupedPatients).filter(name => 
    name.includes(searchTerm)
  );

  const openPatientFile = (name: string) => {
      setSelectedPatientName(name);
      setSelectedPatientHistory(groupedPatients[name]);
  };

  const closePatientFile = () => {
      setSelectedPatientName(null);
      setSelectedPatientHistory([]);
  };

  const handleReprint = (record: PatientRecord, prescriptionIndex: number = 0) => {
     const pres = record.prescriptions && record.prescriptions[prescriptionIndex];
     
     const snapshotVitals = pres?.manualVitals || record.vitals;
     const snapshotDiagnosis = pres?.manualDiagnosis || (record.diagnosis ? record.diagnosis.modern.diagnosis : record.chiefComplaint);
     const items = pres?.items || []; 

     const win = window.open('', '', 'width=900,height=1200');
     if (!win) return;

     const fontFamily = settings?.fontFamily || 'Vazirmatn';
     const paperSize = settings?.paperSize || 'A4';
     
     let content = '';
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
       .btn { padding: 10px 24px; border-radius: 12px; border: none; font-weight: bold; cursor: pointer; }
       .btn-print { background: #2563eb; color: white; }
       .btn-close { background: #fee2e2; color: #ef4444; }

       @media print {
          .no-print { display: none !important; }
          html, body { 
             height: 100%; 
             margin: 0 !important; 
             padding: 0 !important; 
             overflow: hidden; 
          }
          .custom-container, .rx-container { 
             width: 100%;
             height: 100%;
             max-height: 100%;
             page-break-after: avoid; 
             page-break-inside: avoid;
             break-inside: avoid;
             overflow: hidden; 
             transform: scale(0.98); 
             transform-origin: top center;
          }
       }
     `;

     const controlHtml = `
        <div class="control-bar no-print">
           <button class="btn btn-print" onclick="window.print()">چاپ مجدد</button>
           <button class="btn btn-close" onclick="window.close()">بستن</button>
        </div>
     `;

     if (settings?.printBackground && settings?.elements && settings.elements.length > 0) {
         let bgHtml = '';
         if (settings.backgroundImage) {
            bgHtml = `<img src="${settings.backgroundImage}" style="position: absolute; top:0; left:0; width:100%; height:100%; object-fit: fill; z-index:-1;" />`;
            style += `.custom-container { position: relative; width: 100%; height: 100%; overflow: hidden; } .print-element { position: absolute; white-space: nowrap; }`;
         } else {
             style += `.custom-container { position: relative; width: 100%; height: 100%; overflow: hidden; } .print-element { position: absolute; }`;
         }

         const elementsHtml = settings.elements.filter(el => el.visible).map(el => {
            let innerHtml = '';
            switch (el.id) {
               case 'patientName': innerHtml = record.name || ''; break;
               case 'age': innerHtml = record.age || ''; break;
               case 'date': innerHtml = new Date(record.visitDate).toLocaleDateString('fa-IR'); break;
               case 'diagnosis': innerHtml = snapshotDiagnosis || ''; break;
               case 'vital_bp': innerHtml = snapshotVitals?.bloodPressure || ''; break;
               case 'vital_hr': innerHtml = snapshotVitals?.heartRate || ''; break;
               case 'vital_rr': innerHtml = snapshotVitals?.respiratoryRate || ''; break;
               case 'vital_temp': innerHtml = snapshotVitals?.temperature || ''; break;
               case 'vital_weight': innerHtml = snapshotVitals?.weight || ''; break;
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

     } else {
         // Plain Digital Layout (Same as Prescription.tsx)
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
                <div><strong>نام بیمار:</strong> ${record.name}</div>
                ${record.age ? `<div><strong>سن:</strong> ${record.age}</div>` : ''}
                <div><strong>تاریخ ویزیت:</strong> ${new Date(record.visitDate).toLocaleDateString('fa-IR')}</div>
             </div>
             
             <div style="font-size: 12px; margin-bottom: 10px; display: flex; gap: 15px; color: #555;">
                ${snapshotVitals?.bloodPressure ? `<span><strong>BP:</strong> ${snapshotVitals.bloodPressure}</span>` : ''}
                ${snapshotVitals?.heartRate ? `<span><strong>HR:</strong> ${snapshotVitals.heartRate}</span>` : ''}
             </div>

             ${(snapshotDiagnosis) ? `<div style="margin-bottom:20px; padding:10px; border:1px dashed #ccc;"><strong>تشخیص:</strong> ${snapshotDiagnosis}</div>` : ''}

             <div class="rx-symbol">Rx (Reprint)</div>
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
     }

     win.document.write(`
       <html dir="rtl">
         <head>
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
  };

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      
      {/* ==================== MOBILE LAYOUT (Archive View) ==================== */}
      <div className="lg:hidden space-y-4">
         <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
               <Archive size={24} className="text-blue-600" />
               بایگانی پرونده‌ها
            </h1>
            <div className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-xs font-bold">
               {records.length} پرونده
            </div>
         </div>

         <div className="relative">
            <input 
               className="w-full p-4 pl-12 bg-white rounded-2xl shadow-sm border border-gray-100 outline-none focus:border-blue-500 transition-all text-gray-700"
               placeholder="جستجوی نام بیمار..."
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
            />
            <Search className="absolute left-4 top-4 text-gray-400" />
         </div>

         <div className="space-y-3">
            {loading ? (
               <div className="flex justify-center p-4"><div className="animate-spin w-6 h-6 border-2 border-blue-500 rounded-full border-t-transparent"></div></div>
            ) : filteredPatientNames.length === 0 ? (
               <div className="text-center p-8 bg-white rounded-2xl border border-gray-100 text-gray-400 text-sm">پرونده‌ای یافت نشد</div>
            ) : (
               filteredPatientNames.map((name) => {
                  const patientRecords = groupedPatients[name];
                  const latest = patientRecords[0];
                  return (
                     <div key={name} onClick={() => openPatientFile(name)} className="bg-white p-4 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.02)] border border-gray-50 flex items-center gap-4 active:scale-[0.98] transition-transform cursor-pointer">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md ${latest.gender === 'male' ? 'bg-blue-500' : 'bg-pink-500'}`}>
                           {latest.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                           <h4 className="font-bold text-gray-800 text-sm truncate">{latest.name}</h4>
                           <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{latest.age} ساله</span>
                              <span className="text-[10px] text-gray-400">{new Date(latest.visitDate).toLocaleDateString('fa-IR')}</span>
                           </div>
                        </div>
                        <ChevronLeft size={18} className="text-gray-300" />
                     </div>
                  );
               })
            )}
         </div>
      </div>

      {/* ==================== DESKTOP LAYOUT (Archive View) ==================== */}
      <div className="hidden lg:block space-y-8">
        {/* ... (Desktop Code Unchanged) ... */}
        <div className="flex justify-between items-center border-b border-gray-200 pb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
               <Archive className="text-blue-600" size={32} />
               بایگانی و مدیریت پرونده‌ها
            </h1>
            <p className="text-gray-500 mt-2 text-sm">جستجو و مرور سوابق پزشکی بیماران</p>
          </div>
          <div className="bg-white px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 shadow-sm">
             تعداد کل پرونده‌ها: {records.length}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3 max-w-2xl">
           <Search className="text-gray-400" />
           <input 
              type="text" 
              placeholder="جستجو در نام بیماران..." 
              className="flex-1 outline-none text-gray-700 placeholder-gray-400 text-lg"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
           />
        </div>

        <div>
           {loading ? (
             <div className="flex justify-center p-10">
               <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
             </div>
           ) : filteredPatientNames.length === 0 ? (
             <div className="text-center p-20 bg-white rounded-3xl border border-gray-100 text-gray-400">
                <Archive size={64} className="mx-auto mb-4 opacity-20" />
                <p>پرونده‌ای با این مشخصات یافت نشد.</p>
             </div>
           ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredPatientNames.map((name) => {
                   const patientRecords = groupedPatients[name];
                   const latest = patientRecords[0]; 
                   return (
                      <div key={name} onClick={() => openPatientFile(name)} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group">
                          <div className="flex items-center gap-4">
                              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-sm group-hover:scale-105 transition-transform ${latest.gender === 'male' ? 'bg-gradient-to-br from-blue-500 to-blue-600' : 'bg-gradient-to-br from-pink-500 to-pink-600'}`}>
                                  {latest.name.charAt(0)}
                              </div>
                              <div>
                                  <h3 className="font-bold text-lg text-gray-800 group-hover:text-blue-700 transition-colors">{latest.name}</h3>
                                  <p className="text-sm text-gray-500 mt-1">{latest.age} ساله • {patientRecords.length} مراجعه</p>
                              </div>
                          </div>
                          <div className="mt-4 pt-4 border-t border-gray-50 flex justify-between items-center text-xs text-gray-400">
                             <span>آخرین ویزیت: {new Date(latest.visitDate).toLocaleDateString('fa-IR')}</span>
                             <span className="flex items-center gap-1 group-hover:text-blue-600 transition-colors font-bold">مشاهده <ChevronLeft size={14} /></span>
                          </div>
                      </div>
                   );
                })}
             </div>
           )}
        </div>
      </div>

      {/* ==================== SHARED MODALS / SHEETS ==================== */}
      <div className={`hidden lg:flex fixed inset-0 z-50 bg-black/50 backdrop-blur-sm items-center justify-center p-4 transition-opacity ${selectedPatientName ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
          {selectedPatientName && (
            <div className="bg-white w-full max-w-5xl h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-fade-in relative">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-2xl ${selectedPatientHistory[0].gender === 'male' ? 'bg-blue-600' : 'bg-pink-600'}`}>
                            {selectedPatientName.charAt(0)}
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800">{selectedPatientName}</h2>
                            <div className="flex gap-4 text-sm text-gray-500 mt-1">
                                <span>سن: {selectedPatientHistory[0].age}</span>
                                <span>تعداد مراجعات: {selectedPatientHistory.length}</span>
                                <span>شماره تماس: {selectedPatientHistory[0].phoneNumber || '---'}</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={closePatientFile} className="p-2 bg-white rounded-full hover:bg-gray-200 transition-colors">
                        <X size={24} className="text-gray-500" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
                    <div className="max-w-4xl mx-auto space-y-8">
                        {selectedPatientHistory.map((record, index) => (
                            <div key={record.id} className="relative pl-8 md:pl-0">
                                {index !== selectedPatientHistory.length - 1 && (
                                    <div className="absolute top-14 right-[23px] bottom-[-32px] w-0.5 bg-gray-200 z-0 hidden md:block"></div>
                                )}
                                <div className="flex gap-6 items-start">
                                    <div className="hidden md:flex flex-col items-center min-w-[100px] pt-2 z-10">
                                        <div className="w-12 h-12 rounded-full bg-blue-100 border-4 border-white shadow-sm flex items-center justify-center text-blue-600 mb-2">
                                            <Clock size={20} />
                                        </div>
                                        <span className="font-bold text-gray-700">{new Date(record.visitDate).toLocaleDateString('fa-IR')}</span>
                                        <span className="text-xs text-gray-400">{new Date(record.visitDate).toLocaleTimeString('fa-IR', {hour: '2-digit', minute:'2-digit'})}</span>
                                    </div>
                                    <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                                        <div className="flex flex-col md:flex-row justify-between gap-6">
                                            <div className="flex-1 space-y-4">
                                                <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 grid grid-cols-4 gap-2 text-center">
                                                    <div><span className="text-[10px] text-gray-400 uppercase">فشار خون</span><p className="font-bold text-blue-900 text-sm">{record.vitals?.bloodPressure || '-'}</p></div>
                                                    <div><span className="text-[10px] text-gray-400 uppercase">ضربان</span><p className="font-bold text-blue-900 text-sm">{record.vitals?.heartRate || '-'}</p></div>
                                                    <div><span className="text-[10px] text-gray-400 uppercase">دما</span><p className="font-bold text-blue-900 text-sm">{record.vitals?.temperature || '-'}</p></div>
                                                    <div><span className="text-[10px] text-gray-400 uppercase">وزن</span><p className="font-bold text-blue-900 text-sm">{record.vitals?.weight || '-'}</p></div>
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-gray-700 flex items-center gap-2 mb-2"><Activity size={16} className="text-orange-500" />تشخیص پزشک</h4>
                                                    <p className="text-gray-600 bg-gray-50 p-3 rounded-lg text-sm leading-relaxed">{record.diagnosis?.modern.diagnosis || record.prescriptions?.[0]?.manualDiagnosis || record.chiefComplaint || '---'}</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-2 justify-center border-r border-gray-100 pr-6 mr-2">
                                                 <button onClick={() => handleReprint(record)} className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl font-bold hover:bg-indigo-100 transition-colors text-sm"><Printer size={16} />چاپ مجدد نسخه</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
          )}
      </div>

      {selectedPatientName && (
         <div className="lg:hidden fixed inset-0 z-[60] flex flex-col justify-end">
             <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closePatientFile}></div>
             <div className="bg-white rounded-t-[2.5rem] p-6 shadow-2xl relative z-10 max-h-[85vh] overflow-y-auto animate-slide-up">
                 <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6"></div>
                 <div className="flex items-center gap-4 mb-6">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-3xl shadow-lg ${selectedPatientHistory[0].gender === 'male' ? 'bg-blue-600' : 'bg-pink-600'}`}>
                       {selectedPatientName.charAt(0)}
                    </div>
                    <div>
                       <h2 className="text-2xl font-bold text-gray-800">{selectedPatientName}</h2>
                       <p className="text-gray-500 text-sm">{selectedPatientHistory[0].age} ساله • {selectedPatientHistory[0].phoneNumber}</p>
                    </div>
                 </div>
                 <div className="space-y-4">
                    {selectedPatientHistory.map((record) => (
                       <div key={record.id} className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                          <div className="flex justify-between items-center mb-3">
                             <span className="text-xs font-bold text-gray-500 bg-white px-2 py-1 rounded-lg shadow-sm border border-gray-100">
                                {new Date(record.visitDate).toLocaleDateString('fa-IR')}
                             </span>
                             <button onClick={() => handleReprint(record)} className="text-blue-600 bg-blue-50 p-2 rounded-lg"><Printer size={18} /></button>
                          </div>
                          <p className="text-sm font-bold text-gray-800 mb-2">{record.diagnosis?.modern.diagnosis || 'بدون تشخیص نهایی'}</p>
                       </div>
                    ))}
                 </div>
                 <button onClick={closePatientFile} className="w-full bg-gray-100 text-gray-600 font-bold py-4 rounded-2xl mt-6">بستن پرونده</button>
             </div>
         </div>
      )}

    </div>
  );
};

export default Dashboard;
