
import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { Users, FileText, BookOpen, Activity, Clock, TrendingUp, AlertCircle, Printer, Search, X, ZoomIn, ZoomOut, Maximize, MonitorPlay } from 'lucide-react';
import { Patient, Prescription } from '../types';

type TimeFilter = '24H' | '48H' | 'ALL';

export const Dashboard: React.FC = () => {
  const { patients, prescriptions, library, aiUsageLog, doctorProfile } = useStore();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('24H');
  const [reportPatientSearch, setReportPatientSearch] = useState('');
  const [selectedPatientForReport, setSelectedPatientForReport] = useState<Patient | null>(null);
  
  // Scaling Logic
  const [printScale, setPrintScale] = useState(0.5);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  // Auto-Fit Logic
  useEffect(() => {
    if (selectedPatientForReport) {
        fitToScreen();
        window.addEventListener('resize', fitToScreen);
    }
    return () => window.removeEventListener('resize', fitToScreen);
  }, [selectedPatientForReport]);

  const fitToScreen = () => {
    if (previewContainerRef.current) {
        const containerHeight = window.innerHeight - 100;
        const paperHeightPx = 1122;
        const scale = Math.min(1, (containerHeight / paperHeightPx) - 0.05);
        setPrintScale(scale);
    }
  };

  // --- Filtering Logic ---
  const filterByTime = (dateString: string) => {
    if (timeFilter === 'ALL') return true;
    const date = new Date(dateString).getTime();
    const now = Date.now();
    const hours = timeFilter === '24H' ? 24 : 48;
    return (now - date) < (hours * 60 * 60 * 1000);
  };

  const filteredPatients = patients.filter(p => filterByTime(p.registeredAt));
  const filteredPrescriptions = prescriptions.filter(p => filterByTime(p.date));
  const filteredAiUsage = aiUsageLog.filter(dateStr => filterByTime(dateStr));

  // --- Clinical Intelligence ---
  const getTopDiagnoses = () => {
    const diagnoses: Record<string, number> = {};
    filteredPrescriptions.forEach(rx => {
      const d = rx.diagnosis || 'تشخیص نامشخص';
      diagnoses[d] = (diagnoses[d] || 0) + 1;
    });
    return Object.entries(diagnoses)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  };

  const getTopMedications = () => {
    const meds: Record<string, number> = {};
    filteredPrescriptions.forEach(rx => {
      rx.medications.forEach(m => {
        if(m.name) meds[m.name] = (meds[m.name] || 0) + 1;
      });
    });
    return Object.entries(meds)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  };

  // --- Patient Search for Report ---
  const filteredReportPatients = patients.filter(p => 
      reportPatientSearch && (
          p.fullName.toLowerCase().includes(reportPatientSearch.toLowerCase()) || 
          p.phone.includes(reportPatientSearch)
      )
  );

  const getPatientHistory = (pid: string) => prescriptions.filter(rx => rx.patientId === pid).reverse();

  // --- Render Components ---
  const StatCard = ({ title, value, icon: Icon, color, subtext }: any) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 transition-transform hover:scale-[1.02]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-500 text-sm font-medium mb-1">{title}</p>
          <h3 className="text-3xl font-bold text-gray-900">{value}</h3>
          {subtext && <p className="text-xs text-gray-400 mt-2">{subtext}</p>}
        </div>
        <div className={`p-3 rounded-xl ${color} shadow-lg shadow-opacity-20 text-white`}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">داشبورد تحلیلی مطب</h2>
          <p className="text-gray-500 mt-1">گزارش لحظه‌ای عملکرد و وضعیت بیماران</p>
        </div>
        <div className="bg-white border border-gray-200 p-1 rounded-xl flex gap-1 shadow-sm">
             <button onClick={() => setTimeFilter('24H')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${timeFilter === '24H' ? 'bg-medical-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}>۲۴ ساعت اخیر</button>
             <button onClick={() => setTimeFilter('48H')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${timeFilter === '48H' ? 'bg-medical-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}>۴۸ ساعت اخیر</button>
             <button onClick={() => setTimeFilter('ALL')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${timeFilter === 'ALL' ? 'bg-medical-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}>کل دوران</button>
        </div>
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
          title="بیماران جدید" 
          value={filteredPatients.length} 
          subtext={`کل بیماران: ${patients.length}`}
          icon={Users} 
          color="bg-blue-500" 
        />
        <StatCard 
          title="نسخه‌های صادر شده" 
          value={filteredPrescriptions.length} 
          subtext={`کل نسخه‌ها: ${prescriptions.length}`}
          icon={FileText} 
          color="bg-emerald-500" 
        />
        <StatCard 
          title="فعالیت هوش مصنوعی" 
          value={filteredAiUsage.length} 
          subtext="تعداد درخواست‌های پردازش شده"
          icon={Activity} 
          color="bg-orange-500" 
        />
        <StatCard 
          title="منابع دانش" 
          value={library.length} 
          subtext="کتاب‌ها و مقالات موجود"
          icon={BookOpen} 
          color="bg-violet-500" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Clinical Intelligence Report */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
           <h3 className="font-bold text-lg text-gray-800 mb-6 flex items-center gap-2">
               <TrendingUp className="text-medical-600"/>
               گزارش هوش تجاری (Clinical Intelligence)
               <span className="text-xs font-normal text-gray-400 mr-auto bg-gray-50 px-2 py-1 rounded">فیلتر: {timeFilter === '24H' ? '۲۴ ساعت' : timeFilter === '48H' ? '۴۸ ساعت' : 'کل'}</span>
           </h3>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div>
                   <h4 className="text-sm font-bold text-gray-500 mb-4">شایع‌ترین تشخیص‌ها</h4>
                   {getTopDiagnoses().length > 0 ? (
                       <ul className="space-y-3">
                           {getTopDiagnoses().map(([diag, count], i) => (
                               <li key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                                   <span className="font-bold text-gray-700 truncate max-w-[70%]">{diag}</span>
                                   <span className="bg-medical-100 text-medical-700 px-2 py-0.5 rounded-md text-xs font-bold">{count} مورد</span>
                               </li>
                           ))}
                       </ul>
                   ) : (
                       <p className="text-sm text-gray-400 italic">داده‌ای برای این بازه موجود نیست.</p>
                   )}
               </div>
               <div>
                   <h4 className="text-sm font-bold text-gray-500 mb-4">پرمصرف‌ترین داروها</h4>
                   {getTopMedications().length > 0 ? (
                       <ul className="space-y-3">
                           {getTopMedications().map(([med, count], i) => (
                               <li key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                                   <span className="font-bold text-gray-700 ltr">{med}</span>
                                   <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md text-xs font-bold">{count} نسخه</span>
                               </li>
                           ))}
                       </ul>
                   ) : (
                       <p className="text-sm text-gray-400 italic">داده‌ای برای این بازه موجود نیست.</p>
                   )}
               </div>
           </div>
        </div>

        {/* Generate Full Patient Record */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-xl text-white shadow-lg flex flex-col">
            <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                <Printer size={20} className="text-medical-400" />
                چاپ پرونده جامع بیمار
            </h3>
            <p className="text-slate-400 text-sm mb-6">گزارش کامل شامل مشخصات، سوابق، حساسیت‌ها و تایم‌لاین تمام مراجعات.</p>
            
            <div className="relative mt-auto">
                <input 
                    type="text" 
                    placeholder="جستجو نام بیمار..." 
                    className="w-full p-3 pl-10 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-400 focus:ring-2 focus:ring-medical-500 outline-none"
                    value={reportPatientSearch}
                    onChange={(e) => setReportPatientSearch(e.target.value)}
                />
                <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                
                {reportPatientSearch && (
                    <div className="absolute w-full mt-2 bg-white rounded-lg shadow-xl overflow-hidden z-10 max-h-48 overflow-y-auto">
                        {filteredReportPatients.map(p => (
                            <div 
                                key={p.id}
                                onClick={() => {
                                    setSelectedPatientForReport(p);
                                    setReportPatientSearch('');
                                }}
                                className="p-3 hover:bg-gray-100 cursor-pointer text-gray-800 text-sm border-b last:border-0"
                            >
                                <p className="font-bold">{p.fullName}</p>
                                <p className="text-xs text-gray-500">{p.phone}</p>
                            </div>
                        ))}
                         {filteredReportPatients.length === 0 && <p className="p-3 text-gray-400 text-xs text-center">بیماری یافت نشد.</p>}
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* Full Record Print Modal */}
      {selectedPatientForReport && (
          <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm flex flex-col z-[200] print-modal-container">
               {/* Toolbar */}
               <div className="bg-slate-800 text-white p-4 flex justify-between items-center z-50 shadow-md preview-toolbar border-b border-slate-700">
                    <div className="flex items-center gap-4">
                        <h3 className="font-bold flex items-center gap-2 text-lg"><Printer size={20}/> پرونده جامع بیمار</h3>
                         <div className="flex items-center gap-1 bg-slate-700 rounded-lg p-1">
                            <button onClick={() => setPrintScale(s => Math.max(0.3, s - 0.1))} className="p-1.5 hover:bg-slate-600 rounded text-slate-300 hover:text-white" title="کوچک‌نمایی"><ZoomOut size={18}/></button>
                            <span className="text-xs font-mono min-w-[3ch] text-center text-slate-300">{Math.round(printScale * 100)}%</span>
                            <button onClick={() => setPrintScale(s => Math.min(1.5, s + 0.1))} className="p-1.5 hover:bg-slate-600 rounded text-slate-300 hover:text-white" title="بزرگ‌نمایی"><ZoomIn size={18}/></button>
                            <div className="w-px h-4 bg-slate-600 mx-1"></div>
                            <button onClick={fitToScreen} className="px-3 py-1.5 hover:bg-slate-600 rounded text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1" title="Fit to Screen">
                                <MonitorPlay size={14}/> Auto Fit
                            </button>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setSelectedPatientForReport(null)} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg font-bold transition-colors">بستن</button>
                        <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold shadow-lg flex items-center gap-2 transition-colors"><Printer size={18}/> چاپ نهایی</button>
                    </div>
               </div>

               {/* Scrollable Preview */}
               <div className="flex-1 screen-preview-container p-8" ref={previewContainerRef}>
                  <div 
                      className="paper-sheet"
                      style={{ 
                        transform: `scale(${printScale})`, 
                        marginTop: '20px',
                        marginBottom: '100px'
                      }}
                  >
                        <div className="paper-content p-[12mm] text-black">
                            <div className="border-b-2 border-black pb-4 mb-6 text-center">
                                <h1 className="text-2xl font-bold mb-1">{doctorProfile.fullName}</h1>
                                <p className="text-lg">{doctorProfile.specialty}</p>
                                <p className="text-sm mt-1">پرونده جامع پزشکی بیمار</p>
                            </div>

                            {/* Patient Info */}
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-8">
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div><span className="font-bold">نام بیمار:</span> {selectedPatientForReport.fullName}</div>
                                    <div><span className="font-bold">شماره تماس:</span> {selectedPatientForReport.phone}</div>
                                    <div><span className="font-bold">سن / جنسیت:</span> {selectedPatientForReport.age} ساله / {selectedPatientForReport.gender}</div>
                                    <div><span className="font-bold">تاریخ ثبت پرونده:</span> {new Date(selectedPatientForReport.registeredAt).toLocaleDateString('fa-IR')}</div>
                                </div>
                                <div className="border-t border-gray-200 pt-4 mt-2">
                                    <p className="mb-2"><span className="font-bold text-red-600">حساسیت‌ها:</span> {selectedPatientForReport.allergies || '---'}</p>
                                    <p><span className="font-bold text-blue-600">سوابق پزشکی:</span> {selectedPatientForReport.medicalHistory || '---'}</p>
                                </div>
                            </div>

                            {/* Visit Timeline */}
                            <h3 className="text-xl font-bold mb-4 border-b pb-2">تاریخچه مراجعات و نسخه‌ها</h3>
                            <div className="space-y-6">
                                {getPatientHistory(selectedPatientForReport.id).length === 0 ? (
                                    <p className="text-center text-gray-500 italic">هیچ سابقه‌ی مراجعه‌ای ثبت نشده است.</p>
                                ) : (
                                    getPatientHistory(selectedPatientForReport.id).map((rx, idx) => (
                                        <div key={idx} className="border border-gray-300 rounded-lg p-4 break-inside-avoid">
                                            <div className="flex justify-between items-center mb-3 bg-gray-100 p-2 rounded">
                                                <span className="font-bold">تاریخ ویزیت: {new Date(rx.date).toLocaleDateString('fa-IR')}</span>
                                                <span className="text-sm font-mono">{new Date(rx.date).toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'})}</span>
                                            </div>
                                            
                                            <div className="mb-3">
                                                <span className="font-bold text-sm bg-gray-200 px-2 py-1 rounded">تشخیص نهایی:</span>
                                                <p className="mt-1 mr-2 text-justify">{rx.diagnosis || 'ثبت نشده'}</p>
                                            </div>

                                            <div className="pl-4 border-r-2 border-gray-200 mr-2">
                                                <p className="font-bold text-sm text-gray-600 mb-2">اقلام دارویی:</p>
                                                <ul className="space-y-1">
                                                    {rx.medications.map((m, i) => (
                                                        <li key={i} className="text-sm flex justify-between border-b border-dotted border-gray-300 last:border-0 pb-1">
                                                            <span className="font-bold ltr text-left">{m.name}</span>
                                                            <span className="ltr text-right">{m.dosage} - {m.instructions}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            
                            {/* Footer */}
                            <div className="mt-12 text-center text-xs text-gray-400 pt-4 border-t">
                                این گزارش به صورت سیستمی توسط نرم‌افزار دکتریار در تاریخ {new Date().toLocaleDateString('fa-IR')} تولید شده است.
                            </div>
                        </div>
                  </div>
               </div>
          </div>
      )}
    </div>
  );
};
