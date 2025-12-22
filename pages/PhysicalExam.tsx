
import React, { useState } from 'react';
import { analyzePhysicalExam } from '../services/geminiService';
import { PhysicalExamAnalysis } from '../types';
import { Upload, Eye, Smile, AlertCircle, CheckCircle, Fingerprint, Search, Activity, ArrowLeft, Loader2, Sparkles, ChevronRight, Info } from 'lucide-react';

type ExamType = 'skin' | 'tongue' | 'face';

const PhysicalExam: React.FC = () => {
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [examType, setExamType] = useState<ExamType>('skin');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PhysicalExamAnalysis | null>(null);

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
      const res = await analyzePhysicalExam(image, examType);
      setResult(res);
    } catch (e) {
      console.error(e);
      alert('خطا در تحلیل تصویر');
    } finally {
      setLoading(false);
    }
  };

  const MobileResultCard = () => {
    if (!result) return null;
    return (
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 animate-slide-up mb-24">
        <div className={`p-5 text-white flex justify-between items-center ${
          result.severity === 'high' ? 'bg-red-600' : result.severity === 'medium' ? 'bg-orange-500' : 'bg-teal-600'
        }`}>
           <div>
             <h3 className="font-bold text-lg">گزارش معاینه هوشمند</h3>
             <p className="text-white/90 text-[10px] mt-0.5 uppercase tracking-widest">{result.diagnosis}</p>
           </div>
           {result.severity === 'high' ? <AlertCircle size={24} /> : <CheckCircle size={24} />}
        </div>
        <div className="p-5 space-y-4">
           {result.confidence && (
              <div className="space-y-1">
                 <div className="flex justify-between text-[10px] font-bold text-gray-400"><span>ضریب اطمینان بصری</span><span>{result.confidence}</span></div>
                 <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-teal-500 transition-all duration-1000" style={{ width: result.confidence }}></div></div>
              </div>
           )}
           {result.traditionalAnalysis && (
             <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 shadow-sm">
               <h4 className="font-bold text-amber-800 text-[10px] mb-2 flex items-center gap-1 uppercase tracking-widest"><Smile size={12}/> تحلیل مزاجی و ارگانیک</h4>
               <p className="text-xs text-amber-900 leading-relaxed font-bold">{result.traditionalAnalysis}</p>
             </div>
           )}
           <div className="space-y-2">
              <h4 className="font-bold text-gray-700 text-xs uppercase">یافته‌های بالینی</h4>
              {result.findings.map((f, i) => <div key={i} className="text-xs bg-gray-50 p-2.5 rounded-lg text-gray-600 border-r-2 border-teal-400">{f}</div>)}
           </div>
           {result.nextSteps && (
             <div className="bg-teal-600 p-4 rounded-2xl text-white shadow-lg">
                <h4 className="font-black text-xs mb-3 flex items-center gap-2"><Sparkles size={14} /> پیشنهاد گام بعدی بالینی</h4>
                <p className="text-xs opacity-90 leading-relaxed">{result.nextSteps.join(' • ')}</p>
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
                  <div className="bg-teal-100 p-2 rounded-xl text-teal-600"><Eye size={20} /></div>
                  <h2 className="text-lg font-bold text-gray-800">معاینه فیزیکی تخصصی</h2>
               </div>
            </div>
            
            <div className="flex bg-gray-100 p-1 rounded-xl">
               <button onClick={() => { setExamType('skin'); setResult(null); setImage(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${examType === 'skin' ? 'bg-white shadow text-teal-600' : 'text-gray-500'}`}>پوست</button>
               <button onClick={() => { setExamType('tongue'); setResult(null); setImage(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${examType === 'tongue' ? 'bg-white shadow text-teal-600' : 'text-gray-500'}`}>زبان</button>
               <button onClick={() => { setExamType('face'); setResult(null); setImage(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${examType === 'face' ? 'bg-white shadow text-teal-600' : 'text-gray-500'}`}>چهره</button>
            </div>
         </div>

         <div className="flex-1 overflow-y-auto p-4 pb-32">
            {!result ? (
               <div className="space-y-6 animate-slide-up">
                  <div className="space-y-4">
                     <div className="border-2 border-dashed border-teal-200 bg-teal-50/50 rounded-3xl h-80 flex flex-col items-center justify-center relative overflow-hidden group">
                        <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleImage} />
                        {preview ? <img src={preview} className="w-full h-full object-cover" alt="Exam" /> : <div className="text-center"><Fingerprint size={32} className="mx-auto text-teal-400 mb-2" /><p className="text-gray-500 text-xs font-bold">عکس ناحیه معاینه</p></div>}
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
               className={`w-full py-4 rounded-2xl font-bold shadow-2xl flex items-center justify-center gap-2 transition-all ${result ? 'bg-gray-100 text-gray-600' : 'bg-teal-600 text-white shadow-teal-200'}`}
            >
               {loading ? <Loader2 className="animate-spin" /> : result ? <ArrowLeft /> : <Search />}
               {loading ? 'آنالیز بینایی ماشین...' : result ? 'تست جدید' : 'شروع معاینه تخصصی'}
            </button>
         </div>
      </div>

      {/* ======================= DESKTOP VIEW ======================= */}
      <div className="hidden lg:grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
             <h2 className="text-2xl font-black text-gray-800 mb-8 flex items-center gap-3">
              <Eye className="text-teal-600" size={32} />
              <span>کنسول مشاور درماتولوژی و داخلی (Expert-Link)</span>
            </h2>

            <div className="grid grid-cols-3 gap-4 mb-8">
               <button onClick={() => { setExamType('skin'); setResult(null); }} className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${examType === 'skin' ? 'bg-teal-50 border-teal-500 text-teal-700' : 'bg-white border-gray-100 text-gray-400 hover:border-teal-200'}`}><Fingerprint /> <span className="text-xs font-black">درماتولوژی</span></button>
               <button onClick={() => { setExamType('tongue'); setResult(null); }} className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${examType === 'tongue' ? 'bg-teal-50 border-teal-500 text-teal-700' : 'bg-white border-gray-100 text-gray-400 hover:border-teal-200'}`}><Smile /> <span className="text-xs font-black">زبان‌شناسی</span></button>
               <button onClick={() => { setExamType('face'); setResult(null); }} className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${examType === 'face' ? 'bg-teal-50 border-teal-500 text-teal-700' : 'bg-white border-gray-100 text-gray-400 hover:border-teal-200'}`}><Search /> <span className="text-xs font-black">چهره‌شناسی</span></button>
            </div>

            <div className="relative group">
              <div className={`border-2 border-dashed rounded-3xl h-[450px] flex items-center justify-center relative overflow-hidden transition-all duration-500 ${loading ? 'border-teal-500 bg-teal-50/10' : 'border-gray-200 bg-gray-900'}`}>
                  <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-30" onChange={handleImage} disabled={loading} />
                  {preview ? <img src={preview} alt="Physical Scan" className="w-full h-full object-contain z-10" /> : <div className="text-center p-4 z-10"><Upload size={48} className="mx-auto text-teal-400 mb-6 group-hover:scale-110 transition-transform" /><p className="font-black text-gray-300 text-xl tracking-tight">آپلود تصویر ناحیه معاینه</p></div>}
              </div>
            </div>
            
            <div className="mt-8">
              <button onClick={handleAnalyze} disabled={!image || loading} className="w-full bg-teal-600 text-white font-black py-5 rounded-2xl shadow-2xl shadow-teal-200 disabled:opacity-50 hover:bg-teal-700 transition-all flex items-center justify-center gap-3 text-lg">{loading ? <><Activity className="animate-spin" /><span>در حال پردازش پیکسل‌های بافت...</span></> : <><Search /><span>تولید گزارش فنی معاینه</span></>}</button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 h-full">
          {result ? (
             <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100 h-full flex flex-col animate-fade-in">
                <div className={`p-8 text-white ${result.severity === 'high' ? 'bg-red-600' : result.severity === 'medium' ? 'bg-orange-500' : 'bg-teal-600'}`}>
                   <div className="flex justify-between items-start">
                      <div>
                         <h3 className="text-2xl font-black">گزارش مشاور بالینی</h3>
                         <p className="text-white/70 text-xs mt-1 uppercase tracking-widest font-bold">{examType.toUpperCase()} EXAMINATION REPORT</p>
                      </div>
                      <CheckCircle size={40} />
                   </div>
                   
                   {result.confidence && (
                     <div className="mt-8 space-y-2">
                        <div className="flex justify-between text-[10px] font-black uppercase opacity-60"><span>Machine Vision Confidence</span><span>{result.confidence}</span></div>
                        <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                           <div className="h-full bg-white transition-all duration-1000" style={{ width: result.confidence }}></div>
                        </div>
                     </div>
                   )}
                </div>

                <div className="p-8 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
                   <div>
                      <h4 className="font-black text-gray-400 text-[10px] uppercase tracking-widest mb-3">Clinical Impression</h4>
                      <p className="text-gray-900 text-2xl font-black leading-relaxed bg-gray-50 p-6 rounded-3xl border border-gray-100">{result.diagnosis}</p>
                   </div>
                   
                   <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100">
                      <h4 className="font-black text-amber-800 text-xs mb-4 flex items-center gap-2 uppercase tracking-tighter"><Smile size={18} /> ارتباط سیستمی و مزاجی</h4>
                      <p className="text-sm text-amber-900 leading-relaxed font-bold">{result.traditionalAnalysis}</p>
                   </div>

                   <div>
                      <h4 className="font-black text-gray-400 text-[10px] uppercase tracking-widest mb-4">Morphological Findings</h4>
                      <ul className="space-y-4">
                        {result.findings.map((f, i) => (
                           <li key={i} className="flex items-start gap-4 text-sm text-gray-600 font-bold">
                              <div className="mt-1.5 w-2 h-2 bg-teal-500 rounded-full shrink-0"></div>
                              <span>{f}</span>
                           </li>
                        ))}
                      </ul>
                   </div>

                   {result.nextSteps && result.nextSteps.length > 0 && (
                      <div className="mt-6 pt-6 border-t border-gray-100">
                         <h4 className="font-black text-teal-700 text-xs mb-4 flex items-center gap-2">
                            <Sparkles size={16} />
                            همکاری تشخیصی (Clinical Next Steps)
                         </h4>
                         <div className="grid gap-3">
                            {result.nextSteps.map((step, i) => (
                               <div key={i} className="bg-teal-50 p-4 rounded-2xl text-teal-900 text-sm font-bold flex items-center gap-3 border border-teal-100">
                                  <ChevronRight size={18} className="text-teal-400" />
                                  {step}
                               </div>
                            ))}
                         </div>
                      </div>
                   )}
                </div>
                <div className="p-6 bg-gray-50 text-[10px] text-gray-400 text-center font-bold tracking-widest uppercase">Expert-Link / Dermatology & Internal Suite</div>
             </div>
          ) : (
              <div className="h-full bg-gray-50 rounded-[3rem] border-4 border-dashed border-gray-100 flex flex-col items-center justify-center text-gray-300 p-12 text-center">
                 <Eye size={80} className="mb-6 opacity-10" />
                 <p className="text-xl font-black tracking-tight text-gray-400">منتظر دریافت تصویر معاینه...</p>
                 <p className="text-sm mt-4 font-bold max-w-xs leading-relaxed">آنالیز تخصصی شامل بررسی بافت، تشخیص ضایعه و ارتباط با مشکلات داخلی بیمار خواهد بود.</p>
              </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PhysicalExam;
