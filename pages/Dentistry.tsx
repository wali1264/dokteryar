
import React, { useState } from 'react';
import { analyzeDentistry } from '../services/geminiService';
import { DentistryAnalysis } from '../types';
// Added Activity to the imports to resolve the error on line 183
import { Smile, Scan, AlertCircle, CheckCircle, Search, Upload, ArrowLeft, Loader2, Grid, Sparkles, ChevronRight, Hash, Activity } from 'lucide-react';

type Tab = 'caries' | 'opg' | 'smile';

const Dentistry: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('caries');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DentistryAnalysis | null>(null);

  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const [selectedTeeth, setSelectedTeeth] = useState<number[]>([]);

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
      const res = await analyzeDentistry(image, activeTab);
      setResult(res);
    } catch (e) {
      console.error(e);
      alert('خطا در آنالیز دندانپزشکی');
    } finally {
      setLoading(false);
    }
  };

  const toggleTooth = (n: number) => {
    setSelectedTeeth(prev => prev.includes(n) ? prev.filter(t => t !== n) : [...prev, n]);
  };

  const MobileResultCard = () => {
    if (!result) return null;
    return (
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 animate-slide-up mb-24">
        <div className={`p-5 text-white flex justify-between items-center ${
          result.severity === 'critical' ? 'bg-red-600' : 
          result.severity === 'concern' ? 'bg-orange-500' : 'bg-cyan-600'
        }`}>
           <div>
             <h3 className="font-bold text-lg">گزارش جراح فک و صورت</h3>
             <p className="text-white/90 text-[10px] mt-0.5 tracking-widest font-bold uppercase">{result.diagnosis}</p>
           </div>
           {result.severity === 'critical' ? <AlertCircle size={24} /> : <Smile size={24} />}
        </div>
        <div className="p-5 space-y-4">
           {result.confidence && (
              <div className="space-y-1">
                 <div className="flex justify-between text-[10px] font-bold text-gray-400">
                    <span>اطمینان فنی</span>
                    <span>{result.confidence}</span>
                 </div>
                 <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-cyan-500 transition-all duration-1000" style={{ width: result.confidence }}></div></div>
              </div>
           )}
           
           {result.toothNumbers && result.toothNumbers.length > 0 && (
             <div className="bg-cyan-50 p-3 rounded-xl border border-cyan-100">
                <h4 className="font-bold text-cyan-800 text-[10px] mb-2 flex items-center gap-1 uppercase tracking-widest"><Hash size={12}/> دندان‌های درگیر (ISO)</h4>
                <div className="flex flex-wrap gap-2">
                  {result.toothNumbers.map((t, i) => (
                     <span key={i} className="bg-white px-3 py-1 rounded-full text-[10px] text-cyan-700 shadow-sm font-black border border-cyan-100">{t}</span>
                  ))}
                </div>
             </div>
           )}

           <div className="space-y-2">
              <h4 className="font-bold text-gray-700 text-xs uppercase">یافته‌های پاراکلینیک</h4>
              {result.findings.map((f, i) => (
                <div key={i} className="text-xs bg-gray-50 p-2.5 rounded-lg text-gray-600 border-r-2 border-cyan-400 font-bold">{f}</div>
              ))}
           </div>

           {result.nextSteps && result.nextSteps.length > 0 && (
              <div className="bg-slate-900 p-4 rounded-2xl text-white shadow-lg">
                 <h4 className="font-black text-xs mb-3 flex items-center gap-2 text-cyan-400"><Sparkles size={14} /> پیشنهاد جراحی/بالینی</h4>
                 <div className="space-y-2">
                    {result.nextSteps.map((step, i) => (
                       <div key={i} className="flex gap-2 items-start text-xs opacity-90"><ChevronRight size={14} className="text-cyan-400 shrink-0" /><span>{step}</span></div>
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
      <div className="lg:hidden flex flex-col h-full">
         <div className="bg-white p-4 sticky top-0 z-30 shadow-sm border-b border-gray-100">
            <div className="flex justify-between items-center mb-4">
               <div className="flex items-center gap-2">
                  <div className="bg-cyan-100 p-2 rounded-xl text-cyan-600"><Smile size={20} /></div>
                  <h2 className="text-lg font-bold text-gray-800 tracking-tight">جراحی دهان و دندان</h2>
               </div>
            </div>
            <div className="flex bg-gray-100 p-1 rounded-xl">
               <button onClick={() => { setActiveTab('caries'); setResult(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'caries' ? 'bg-white shadow text-cyan-600' : 'text-gray-500'}`}>پوسیدگی</button>
               <button onClick={() => { setActiveTab('opg'); setResult(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'opg' ? 'bg-white shadow text-cyan-600' : 'text-gray-500'}`}>رادیوگرافی</button>
               <button onClick={() => { setActiveTab('smile'); setResult(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'smile' ? 'bg-white shadow text-cyan-600' : 'text-gray-500'}`}>لبخند</button>
            </div>
         </div>

         <div className="flex-1 overflow-y-auto p-4 pb-32">
            {!result ? (
               <div className="space-y-6 animate-slide-up">
                  <div className="border-2 border-dashed border-cyan-200 bg-cyan-50/50 rounded-3xl h-64 flex flex-col items-center justify-center relative overflow-hidden group">
                     <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleImage} />
                     {preview ? <img src={preview} className="w-full h-full object-contain" alt="Dental" /> : <div className="text-center"><Upload className="mx-auto text-cyan-400 mb-2" /><p className="text-gray-500 text-xs font-bold">آپلود عکس دندان یا OPG</p></div>}
                  </div>
                  <div className="grid grid-cols-8 gap-1 p-2 bg-gray-100 rounded-2xl">
                     {[11,12,13,14,15,16,17,18,21,22,23,24,25,26,27,28].map(n => (
                        <button key={n} onClick={() => toggleTooth(n)} className={`h-8 rounded-lg text-[10px] font-black transition-all ${selectedTeeth.includes(n) ? 'bg-cyan-600 text-white' : 'bg-white text-gray-400'}`}>{n}</button>
                     ))}
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
               className={`w-full py-4 rounded-2xl font-bold shadow-2xl flex items-center justify-center gap-2 transition-all ${result ? 'bg-gray-100 text-gray-600' : 'bg-cyan-600 text-white shadow-cyan-200'}`}
            >
               {loading ? <Loader2 className="animate-spin" /> : result ? <ArrowLeft /> : <Scan />}
               {loading ? 'تحلیل پیکسل‌های مینا...' : result ? 'بازگشت' : 'شروع آنالیز فنی'}
            </button>
         </div>
      </div>

      <div className="hidden lg:grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
             <h2 className="text-2xl font-black text-gray-800 mb-8 flex items-center gap-3">
              <Smile className="text-cyan-600" size={32} />
              <span>کنسول فوق‌تخصصی جراحی فک و صورت (Expert-Link)</span>
            </h2>

            <div className="flex bg-gray-100 p-1.5 rounded-2xl mb-8">
              <button onClick={() => { setActiveTab('caries'); setResult(null); setImage(null); }} className={`flex-1 py-4 px-6 rounded-xl font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'caries' ? 'bg-cyan-600 text-white shadow-xl' : 'text-gray-500 hover:bg-gray-50'}`}><Search /> پوسیدگی و پریو</button>
              <button onClick={() => { setActiveTab('opg'); setResult(null); setImage(null); }} className={`flex-1 py-4 px-6 rounded-xl font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'opg' ? 'bg-cyan-600 text-white shadow-xl' : 'text-gray-500 hover:bg-gray-50'}`}><Scan /> رادیوگرافی (OPG)</button>
              <button onClick={() => { setActiveTab('smile'); setResult(null); }} className={`flex-1 py-4 px-6 rounded-xl font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'smile' ? 'bg-cyan-600 text-white shadow-xl' : 'text-gray-500 hover:bg-gray-50'}`}><Smile /> آنالیز زیبایی</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
               <div className="md:col-span-3">
                  <div className="relative group">
                    <div className={`border-2 border-dashed rounded-[3rem] h-[400px] flex items-center justify-center relative overflow-hidden transition-all duration-500 ${loading ? 'border-cyan-500 bg-cyan-50/10' : 'border-gray-200 bg-gray-900'}`}>
                        <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-30" onChange={handleImage} disabled={loading} />
                        {preview ? <img src={preview} alt="Dental Scan" className="w-full h-full object-contain z-10" /> : <div className="text-center p-4 z-10"><Upload size={48} className="mx-auto text-cyan-400 mb-6 group-hover:scale-110 transition-transform" /><p className="font-black text-gray-300 text-xl tracking-tight">آپلود تصویر یا کلیشه رادیولوژی</p></div>}
                    </div>
                  </div>
               </div>
               <div className="bg-gray-50 p-4 rounded-[2rem] border border-gray-100 flex flex-col items-center">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase mb-4 tracking-widest">Dental Charting</h4>
                  <div className="grid grid-cols-2 gap-2 w-full">
                     {[11,12,13,14,15,16,17,18,21,22,23,24,25,26,27,28].map(n => (
                        <button key={n} onClick={() => toggleTooth(n)} className={`p-2 rounded-lg text-xs font-black transition-all ${selectedTeeth.includes(n) ? 'bg-cyan-600 text-white' : 'bg-white text-gray-400 border border-gray-200 shadow-sm hover:border-cyan-200'}`}>{n}</button>
                     ))}
                  </div>
                  <p className="text-[9px] text-gray-400 mt-4 text-center">دندان‌های درگیر را جهت هدایت هوش مصنوعی انتخاب کنید.</p>
               </div>
            </div>
            
            <div className="mt-4">
              <button onClick={handleAnalyze} disabled={!image || loading} className="w-full bg-cyan-600 text-white font-black py-5 rounded-2xl shadow-2xl shadow-cyan-200 disabled:opacity-50 hover:bg-cyan-700 transition-all flex items-center justify-center gap-3 text-lg">{loading ? <><Activity className="animate-spin" /><span>در حال واکاوی بافت‌های سخت دهان...</span></> : <><Scan /><span>تولید ریپورت فوق‌تخصصی دندانپزشکی</span></>}</button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 h-full">
          {result ? (
             <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100 h-full flex flex-col animate-fade-in">
                <div className={`p-8 text-white ${result.severity === 'critical' ? 'bg-red-600' : result.severity === 'concern' ? 'bg-orange-500' : 'bg-cyan-600'}`}>
                   <div className="flex justify-between items-start">
                      <div>
                         <h3 className="text-2xl font-black">گزارش جراح دهان و دندان</h3>
                         <p className="text-white/70 text-xs mt-1 uppercase tracking-widest font-bold">DENTAL-SURGERY REPORT / {activeTab}</p>
                      </div>
                      <CheckCircle size={40} />
                   </div>
                   
                   {result.confidence && (
                     <div className="mt-8 space-y-2">
                        <div className="flex justify-between text-[10px] font-black uppercase opacity-60"><span>Diagnostic Confidence</span><span>{result.confidence}</span></div>
                        <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                           <div className="h-full bg-white transition-all duration-1000" style={{ width: result.confidence }}></div>
                        </div>
                     </div>
                   )}
                </div>

                <div className="p-8 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
                   <div>
                      <h4 className="font-black text-gray-400 text-[10px] uppercase tracking-widest mb-3">Surgical Impression</h4>
                      <p className="text-gray-900 text-2xl font-black leading-relaxed bg-gray-50 p-6 rounded-3xl border border-gray-100">{result.diagnosis}</p>
                   </div>
                   
                   {result.toothNumbers && result.toothNumbers.length > 0 && (
                     <div className="bg-cyan-50 p-6 rounded-3xl border border-cyan-100">
                        <h4 className="font-black text-cyan-800 text-xs mb-4 flex items-center gap-2 uppercase tracking-tighter"><Grid size={18} /> کانون درگیری (ISO Mapping)</h4>
                        <div className="flex flex-wrap gap-2">
                           {result.toothNumbers.map((t, i) => (<span key={i} className="bg-white px-4 py-1 rounded-full text-sm text-cyan-900 font-black shadow-sm border border-cyan-100">{t}</span>))}
                        </div>
                     </div>
                   )}

                   <div>
                      <h4 className="font-black text-gray-400 text-[10px] uppercase tracking-widest mb-4">Detailed Technical Findings</h4>
                      <ul className="space-y-4">
                        {result.findings.map((f, i) => (
                           <li key={i} className="flex items-start gap-4 text-sm text-gray-700 font-bold">
                              <div className="mt-1.5 w-2 h-2 bg-cyan-500 rounded-full shrink-0"></div>
                              <span>{f}</span>
                           </li>
                        ))}
                      </ul>
                   </div>

                   {result.nextSteps && result.nextSteps.length > 0 && (
                      <div className="mt-6 pt-6 border-t border-gray-100">
                         <h4 className="font-black text-slate-700 text-xs mb-4 flex items-center gap-2">
                            <Sparkles size={16} className="text-cyan-500" />
                            پیشنهاد جراحی و پروتکل (Suggested Steps)
                         </h4>
                         <div className="grid gap-3">
                            {result.nextSteps.map((step, i) => (
                               <div key={i} className="bg-slate-900 p-4 rounded-2xl text-cyan-200 text-sm font-bold flex items-center gap-3 border border-slate-800">
                                  <ChevronRight size={18} className="text-indigo-400" />
                                  {step}
                               </div>
                            ))}
                         </div>
                      </div>
                   )}
                </div>
                <div className="p-6 bg-gray-50 text-[10px] text-gray-400 text-center font-bold tracking-widest uppercase">Expert-Link Dentistry / Oral-Maxillofacial Suite</div>
             </div>
          ) : (
              <div className="h-full bg-gray-50 rounded-[3rem] border-4 border-dashed border-gray-100 flex flex-col items-center justify-center text-gray-300 p-12 text-center">
                 <Smile size={80} className="mb-6 opacity-10" />
                 <p className="text-xl font-black tracking-tight text-gray-400">منتظر دریافت تصویر برای آنالیز...</p>
                 <p className="text-sm mt-4 font-bold max-w-xs leading-relaxed">گزارش نهایی شامل تحلیل تحلیل ریشه، شناسایی پوسیدگی‌های پروگزیمال و انطباق با چارت ISO خواهد بود.</p>
              </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dentistry;
