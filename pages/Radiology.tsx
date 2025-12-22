
import React, { useState } from 'react';
import { analyzeRadiology } from '../services/geminiService';
import { RadiologyAnalysis } from '../types';
import { Upload, ScanEye, AlertOctagon, CheckCircle2, FileText, Activity, ArrowLeft, Loader2, ChevronRight, Sparkles } from 'lucide-react';

const Radiology: React.FC = () => {
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [modality, setModality] = useState('X-Ray');
  const [region, setRegion] = useState('Chest');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RadiologyAnalysis | null>(null);

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage(file);
      setPreview(URL.createObjectURL(file));
      setResult(null);
    }
  };

  const handleAnalyze = async () => {
    if (!image) return;
    setLoading(true);
    try {
      const res = await analyzeRadiology(image, modality, region);
      setResult(res);
    } catch (e) {
      console.error(e);
      alert('خطا در تحلیل تصویر رادیولوژی');
    } finally {
      setLoading(false);
    }
  };

  const MobileResultCard = () => {
    if (!result) return null;
    return (
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 animate-slide-up mb-24">
        <div className={`p-5 text-white flex justify-between items-center ${
          result.severity === 'critical' ? 'bg-red-600' : 
          result.severity === 'abnormal' ? 'bg-orange-500' : 'bg-green-600'
        }`}>
           <div>
             <h3 className="font-bold text-lg">گزارش تخصصی رادیولوژی</h3>
             <p className="text-white/90 text-[10px] mt-0.5 uppercase tracking-wider">{result.modality} - {result.region}</p>
           </div>
           {result.severity === 'critical' ? <AlertOctagon size={24} /> : <CheckCircle2 size={24} />}
        </div>
        <div className="p-5 space-y-4">
           {result.confidence && (
              <div className="space-y-1">
                 <div className="flex justify-between text-[10px] font-bold text-gray-400">
                    <span>اطمینان تشخیص</span>
                    <span>{result.confidence}</span>
                 </div>
                 <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: result.confidence }}></div>
                 </div>
              </div>
           )}
           <div>
              <h4 className="font-bold text-gray-700 text-xs mb-2 uppercase tracking-wide">Impression</h4>
              <p className="text-gray-800 text-sm font-black leading-relaxed bg-blue-50 p-4 rounded-xl border border-blue-100">{result.impression}</p>
           </div>
           
           <div className="space-y-2">
              <h4 className="font-bold text-gray-500 text-xs uppercase">Findings</h4>
              {result.findings.map((f, i) => (
                <div key={i} className="text-xs bg-gray-50 p-2.5 rounded-lg text-gray-600 border-r-2 border-blue-400">{f}</div>
              ))}
           </div>

           {result.nextSteps && result.nextSteps.length > 0 && (
              <div className="bg-indigo-600 p-4 rounded-2xl text-white shadow-lg shadow-indigo-100">
                 <h4 className="font-black text-xs mb-3 flex items-center gap-2">
                    <Sparkles size={14} />
                    پیشنهاد مشاور رادیولوژیست
                 </h4>
                 <div className="space-y-2">
                    {result.nextSteps.map((step, i) => (
                       <div key={i} className="flex gap-2 items-start text-xs opacity-90">
                          <div className="mt-1 w-1 h-1 rounded-full bg-white shrink-0"></div>
                          <span>{step}</span>
                       </div>
                    ))}
                 </div>
              </div>
           )}
        </div>
      </div>
    );
  };

  return (
    <div className="animate-fade-in pb-20 h-full">
      
      {/* ======================= MOBILE VIEW ======================= */}
      <div className="lg:hidden flex flex-col h-full">
         <div className="bg-white p-4 sticky top-0 z-30 shadow-sm border-b border-gray-100">
            <div className="flex justify-between items-center mb-4">
               <div className="flex items-center gap-2">
                  <div className="bg-blue-100 p-2 rounded-xl text-blue-600"><ScanEye size={20} /></div>
                  <h2 className="text-lg font-bold text-gray-800">رادیولوژی تخصصی</h2>
               </div>
            </div>
            
            <div className="flex gap-2">
               <select className="flex-1 p-2 bg-gray-50 rounded-xl text-xs font-bold outline-none" value={modality} onChange={e => setModality(e.target.value)}>
                  <option value="X-Ray">رادیوگرافی (X-Ray)</option>
                  <option value="CT Scan">سی‌تی اسکن</option>
                  <option value="MRI">ام‌آرآی (MRI)</option>
                  <option value="Ultrasound">سونوگرافی</option>
               </select>
               <select className="flex-1 p-2 bg-gray-50 rounded-xl text-xs font-bold outline-none" value={region} onChange={e => setRegion(e.target.value)}>
                  <option value="Chest">قفسه سینه</option>
                  <option value="Brain">مغز</option>
                  <option value="Abdomen">شکم</option>
                  <option value="Spine">ستون فقرات</option>
                  <option value="Extremity">اندام‌ها</option>
               </select>
            </div>
         </div>

         <div className="flex-1 overflow-y-auto p-4 pb-32">
            {!result ? (
               <div className="space-y-6 animate-slide-up">
                  <div className="space-y-4">
                     <div className="border-2 border-dashed border-blue-200 bg-blue-50/50 rounded-3xl h-96 flex flex-col items-center justify-center relative overflow-hidden group">
                        <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleImage} />
                        {preview ? <img src={preview} className="w-full h-full object-contain bg-black" alt="Scan" /> : <div className="text-center"><Upload className="mx-auto text-blue-400 mb-2" /><p className="text-gray-500 text-xs font-bold">آپلود تصویر پزشکی</p></div>}
                     </div>
                  </div>
               </div>
            ) : (
               <MobileResultCard />
            )}
         </div>

         <div className="fixed bottom-[5.5rem] left-0 right-0 px-4 z-40">
            <button 
               onClick={result ? () => setResult(null) : handleAnalyze}
               disabled={loading || (!result && !image)}
               className={`w-full py-4 rounded-2xl font-bold shadow-2xl flex items-center justify-center gap-2 transition-all ${result ? 'bg-gray-100 text-gray-600' : 'bg-blue-600 text-white shadow-blue-200'}`}
            >
               {loading ? <Loader2 className="animate-spin" /> : result ? <ArrowLeft /> : <ScanEye />}
               {loading ? 'آنالیز رادیولوژیک...' : result ? 'تفسیر تصویر جدید' : 'شروع آنالیز تخصصی'}
            </button>
         </div>
      </div>

      {/* ======================= DESKTOP VIEW ======================= */}
      <div className="hidden lg:grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
             <h2 className="text-2xl font-black text-gray-800 mb-8 flex items-center gap-3">
              <ScanEye className="text-blue-600" size={32} />
              <span>شبکه رادیولوژیست‌های همکار (AI)</span>
            </h2>
            
            <div className="grid grid-cols-2 gap-4 mb-8">
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase mr-1">Modality</label>
                  <select className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-blue-50 font-bold text-gray-700" value={modality} onChange={(e) => setModality(e.target.value)}><option value="X-Ray">رادیوگرافی (X-Ray)</option><option value="CT Scan">سی‌تی اسکن (CT Scan)</option><option value="MRI">ام‌آرآی (MRI)</option><option value="Ultrasound">سونوگرافی (Ultrasound)</option></select>
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase mr-1">Anatomical Region</label>
                  <select className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-blue-50 font-bold text-gray-700" value={region} onChange={(e) => setRegion(e.target.value)}><option value="Chest">قفسه سینه (Chest)</option><option value="Brain">مغز و اعصاب (Brain)</option><option value="Abdomen">شکم و لگن (Abdomen)</option><option value="Spine">ستون فقرات (Spine)</option><option value="Extremity">اندام‌ها (Limb)</option></select>
               </div>
            </div>

            <div className="relative group">
              <div className={`border-2 border-dashed rounded-3xl h-[550px] flex items-center justify-center relative overflow-hidden transition-all duration-500 ${loading ? 'border-blue-500 bg-blue-50/10' : 'border-gray-200 bg-gray-900'}`}>
                  {loading && <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/10 to-transparent animate-scan z-20 pointer-events-none"></div>}
                  <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-30" onChange={handleImage} disabled={loading} />
                  {preview ? <img src={preview} alt="Radiology Scan" className="w-full h-full object-contain z-10" /> : <div className="text-center p-4 z-10"><div className="w-20 h-20 bg-gray-800 text-blue-400 rounded-3xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform"><Upload size={32} /></div><p className="font-black text-gray-300 text-xl tracking-tight">آپلود تصویر رادیولوژی</p><p className="text-xs text-gray-500 mt-2 font-bold">DICOM, JPEG, PNG Supported</p></div>}
              </div>
            </div>
            
            <div className="mt-8">
              <button onClick={handleAnalyze} disabled={!image || loading} className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl shadow-2xl shadow-blue-200 disabled:opacity-50 hover:bg-blue-700 transition-all active:scale-[0.98] flex items-center justify-center gap-3 text-lg">{loading ? <><Activity className="animate-spin" /><span>در حال واکاوی پیکسل‌های تصویر...</span></> : <><ScanEye /><span>تولید گزارش تخصصی ریپورت</span></>}</button>
            </div>
          </div>
        </div>

        {/* Report Section */}
        <div className="lg:col-span-5 h-full">
          {result ? (
             <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100 h-full flex flex-col animate-fade-in">
                <div className={`p-8 text-white ${result.severity === 'critical' ? 'bg-red-600' : result.severity === 'abnormal' ? 'bg-orange-500' : 'bg-green-600'}`}>
                   <div className="flex justify-between items-start">
                      <div>
                         <h3 className="text-2xl font-black">گزارش رادیولوژیست (AI)</h3>
                         <p className="text-white/70 text-xs mt-1 uppercase tracking-widest font-bold">{result.modality} REPORT / {result.region}</p>
                      </div>
                      {result.severity === 'critical' ? <AlertOctagon size={40} /> : <CheckCircle2 size={40} />}
                   </div>
                   
                   {result.confidence && (
                     <div className="mt-6 space-y-2">
                        <div className="flex justify-between text-[10px] font-black uppercase opacity-60"><span>Confidence Index</span><span>{result.confidence}</span></div>
                        <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                           <div className="h-full bg-white transition-all duration-1000" style={{ width: result.confidence }}></div>
                        </div>
                     </div>
                   )}
                </div>

                <div className="p-8 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
                   <div>
                      <h4 className="font-black text-gray-400 text-[10px] uppercase tracking-widest mb-3">Impression</h4>
                      <p className="text-gray-900 text-xl font-black leading-relaxed bg-gray-50 p-6 rounded-3xl border border-gray-100">{result.impression}</p>
                   </div>
                   
                   {result.anatomicalLocation && (
                     <div className="flex items-center gap-3 text-sm">
                        <span className="font-black text-gray-400 uppercase text-[10px]">Location:</span>
                        <span className="text-gray-800 font-bold bg-blue-50 px-3 py-1 rounded-full">{result.anatomicalLocation}</span>
                     </div>
                   )}

                   <div>
                      <h4 className="font-black text-gray-400 text-[10px] uppercase tracking-widest mb-4">Detailed Findings</h4>
                      <ul className="space-y-4">
                        {result.findings.map((f, i) => (
                           <li key={i} className="flex items-start gap-4 text-sm text-gray-600">
                              <div className="mt-1.5 w-2 h-2 bg-blue-500 rounded-full shrink-0"></div>
                              <span className="leading-relaxed font-medium">{f}</span>
                           </li>
                        ))}
                      </ul>
                   </div>

                   {result.nextSteps && result.nextSteps.length > 0 && (
                      <div className="mt-6 pt-6 border-t border-gray-100">
                         <h4 className="font-black text-indigo-700 text-xs mb-4 flex items-center gap-2">
                            <Sparkles size={16} />
                            مشاوره همکار (Clinical Recommendations)
                         </h4>
                         <div className="grid gap-3">
                            {result.nextSteps.map((step, i) => (
                               <div key={i} className="bg-indigo-50 p-4 rounded-2xl text-indigo-900 text-sm font-bold flex items-center gap-3 border border-indigo-100">
                                  <ChevronRight size={18} className="text-indigo-400" />
                                  {step}
                               </div>
                            ))}
                         </div>
                      </div>
                   )}
                </div>
                <div className="p-6 bg-gray-50 text-[10px] text-gray-400 text-center font-bold tracking-widest uppercase">Expert-Link Protocol / Formal Imaging Report</div>
             </div>
          ) : (
              <div className="h-full bg-gray-50 rounded-[3rem] border-4 border-dashed border-gray-100 flex flex-col items-center justify-center text-gray-300 p-12 text-center">
                 <ScanEye size={80} className="mb-6 opacity-10" />
                 <p className="text-xl font-black tracking-tight text-gray-400">منتظر دریافت تصویر برای آنالیز تخصصی...</p>
                 <p className="text-sm mt-4 font-bold max-w-xs leading-relaxed">گزارش نهایی شامل تحلیل پیکسل، درصد اطمینان و پیشنهادات بالینی خواهد بود.</p>
              </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Radiology;
