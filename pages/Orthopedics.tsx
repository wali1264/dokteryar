
import React, { useState } from 'react';
import { analyzeOrthopedics } from '../services/geminiService';
import { OrthopedicsAnalysis } from '../types';
import { Bone, User, Upload, Activity, AlertCircle, CheckCircle, Scale, ArrowLeft, Loader2, Sparkles, ChevronRight, Ruler } from 'lucide-react';

type Tab = 'posture' | 'joints';

const Orthopedics: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('posture');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OrthopedicsAnalysis | null>(null);

  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

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
      const res = await analyzeOrthopedics(image, activeTab);
      setResult(res);
    } catch (e) {
      console.error(e);
      alert('خطا در آنالیز ارتوپدی');
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
          result.severity === 'concern' ? 'bg-orange-500' : 'bg-amber-600'
        }`}>
           <div>
             <h3 className="font-bold text-lg">گزارش جراح ارتوپد</h3>
             <p className="text-white/90 text-[10px] mt-0.5 tracking-widest font-bold uppercase">{result.diagnosis}</p>
           </div>
           {result.severity === 'critical' ? <AlertCircle size={24} /> : <Bone size={24} />}
        </div>
        <div className="p-5 space-y-4">
           {result.confidence && (
              <div className="space-y-1">
                 <div className="flex justify-between text-[10px] font-bold text-gray-400"><span>دقت انطباق</span><span>{result.confidence}</span></div>
                 <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-amber-500 transition-all duration-1000" style={{ width: result.confidence }}></div></div>
              </div>
           )}
           
           {result.angles && result.angles.length > 0 && (
              <div className="bg-amber-50 p-3 rounded-xl border border-amber-100">
                 <h4 className="font-bold text-amber-800 text-[10px] mb-2 flex items-center gap-1 uppercase tracking-widest"><Ruler size={12}/> Biometry / Angles</h4>
                 <div className="grid grid-cols-2 gap-2">
                    {result.angles.map((a, i) => (
                       <div key={i} className="bg-white p-2 rounded-lg text-[10px] text-gray-700 shadow-sm text-center font-black">{a}</div>
                    ))}
                 </div>
              </div>
           )}

           <div className="space-y-2">
              <h4 className="font-bold text-gray-700 text-xs uppercase">یافته‌های بیومکانیک</h4>
              {result.findings.map((f, i) => (
                <div key={i} className="text-xs bg-gray-50 p-2.5 rounded-lg text-gray-600 border-r-2 border-amber-400 font-bold">{f}</div>
              ))}
           </div>

           {result.nextSteps && result.nextSteps.length > 0 && (
              <div className="bg-slate-900 p-4 rounded-2xl text-white shadow-lg">
                 <h4 className="font-black text-xs mb-3 flex items-center gap-2 text-amber-400"><Sparkles size={14} /> پیشنهاد جراحی/فیزیوتراپی</h4>
                 <div className="space-y-2">
                    {result.nextSteps.map((step, i) => (
                       <div key={i} className="flex gap-2 items-start text-xs opacity-90"><ChevronRight size={14} className="text-amber-400 shrink-0" /><span>{step}</span></div>
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
                  <div className="bg-amber-100 p-2 rounded-xl text-amber-600"><Bone size={20} /></div>
                  <h2 className="text-lg font-bold text-gray-800 tracking-tight">ارتوپدی و اصلاح ساختار</h2>
               </div>
            </div>
            <div className="flex bg-gray-100 p-1 rounded-xl">
               <button onClick={() => { setActiveTab('posture'); setResult(null); setImage(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'posture' ? 'bg-white shadow text-amber-600' : 'text-gray-500'}`}>پاسچر</button>
               <button onClick={() => { setActiveTab('joints'); setResult(null); setImage(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'joints' ? 'bg-white shadow text-amber-600' : 'text-gray-500'}`}>مفاصل</button>
            </div>
         </div>

         <div className="flex-1 overflow-y-auto p-4 pb-32">
            {!result ? (
               <div className="space-y-6 animate-slide-up">
                  <div className="space-y-4">
                     <div className="border-2 border-dashed border-amber-200 bg-amber-50/50 rounded-3xl h-80 flex flex-col items-center justify-center relative overflow-hidden group">
                        <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleImage} />
                        {preview ? <img src={preview} className="w-full h-full object-cover" alt="Orthopedic" /> : <div className="text-center"><div className="bg-white p-4 rounded-full shadow-sm mb-4 inline-block">{activeTab === 'posture' ? <User size={32} className="text-amber-400" /> : <Bone size={32} className="text-amber-400" />}</div><p className="text-gray-500 text-xs font-bold">آپلود تصویر معاینه</p></div>}
                        {activeTab === 'posture' && !preview && <div className="absolute inset-0 border-x-2 border-black/5 pointer-events-none"></div>}
                     </div>
                     <p className="text-[10px] text-gray-400 text-center font-bold">برای آنالیز پاسچر، عکس تمام قد ایستاده از روبرو یا پهلو الزامی است.</p>
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
               className={`w-full py-4 rounded-2xl font-bold shadow-2xl flex items-center justify-center gap-2 transition-all ${result ? 'bg-gray-100 text-gray-600' : 'bg-amber-600 text-white shadow-amber-200'}`}
            >
               {loading ? <Loader2 className="animate-spin" /> : result ? <ArrowLeft /> : <Scale />}
               {loading ? 'ترسیم خطوط تراز...' : result ? 'تست جدید' : 'شروع آنالیز بیومکانیکال'}
            </button>
         </div>
      </div>

      <div className="hidden lg:grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
             <h2 className="text-2xl font-black text-gray-800 mb-8 flex items-center gap-3">
              <Bone className="text-amber-600" size={32} />
              <span>کنسول مشاور جراحی استخوان و مفاصل (Expert-Link)</span>
            </h2>
            <div className="flex bg-gray-100 p-1.5 rounded-2xl mb-8">
              <button onClick={() => { setActiveTab('posture'); setResult(null); setImage(null); }} className={`flex-1 py-4 px-6 rounded-xl font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'posture' ? 'bg-amber-600 text-white shadow-xl' : 'text-gray-500 hover:bg-gray-50'}`}><User /> اسکنر پاسچر</button>
              <button onClick={() => { setActiveTab('joints'); setResult(null); setImage(null); }} className={`flex-1 py-4 px-6 rounded-xl font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'joints' ? 'bg-amber-600 text-white shadow-xl' : 'text-gray-500 hover:bg-gray-50'}`}><Bone /> آنالیز مفصلی</button>
            </div>
            <div className="relative group h-[500px]">
              <div className={`border-2 border-dashed rounded-[3rem] h-full flex items-center justify-center relative overflow-hidden transition-all duration-500 ${loading ? 'border-amber-500 bg-amber-50/10' : 'border-gray-200 bg-gray-900'}`}>
                  {activeTab === 'posture' && !preview && <div className="absolute inset-0 grid grid-cols-3 pointer-events-none opacity-10"><div className="border-r border-white"></div><div className="border-r border-white"></div><div></div></div>}
                  <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-30" onChange={handleImage} disabled={loading} />
                  {preview ? <img src={preview} alt="Ortho Scan" className="w-full h-full object-contain z-10" /> : <div className="text-center p-4 z-10"><Upload size={48} className="mx-auto text-amber-400 mb-6 group-hover:scale-110 transition-transform" /><p className="font-black text-gray-300 text-xl tracking-tight">آپلود تصویر تمام‌قد یا مفصل</p></div>}
              </div>
            </div>
            <div className="mt-8"><button onClick={handleAnalyze} disabled={!image || loading} className="w-full bg-amber-600 text-white font-black py-5 rounded-2xl shadow-2xl shadow-amber-200 hover:bg-amber-700 transition-all flex items-center justify-center gap-3 text-lg">{loading ? <><Activity className="animate-spin" /><span>در حال ترسیم زوایا و تراز بدنی...</span></> : <><Bone /><span>تولید ریپورت رسمی ارتوپدی</span></>}</button></div>
          </div>
        </div>

        <div className="lg:col-span-5 h-full">
          {result ? (
             <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100 h-full flex flex-col animate-fade-in">
                <div className={`p-8 text-white ${result.severity === 'critical' ? 'bg-red-600' : result.severity === 'concern' ? 'bg-orange-500' : 'bg-amber-600'}`}>
                   <div className="flex justify-between items-start">
                      <div><h3 className="text-2xl font-black">گزارش جراح ارتوپد</h3><p className="text-white/70 text-xs mt-1 uppercase tracking-widest font-bold">ORTHOPEDIC CLINIC REPORT / {activeTab}</p></div>
                      <CheckCircle size={40} />
                   </div>
                   {result.confidence && (
                     <div className="mt-8 space-y-2">
                        <div className="flex justify-between text-[10px] font-black uppercase opacity-60"><span>Machine Biometry Confidence</span><span>{result.confidence}</span></div>
                        <div className="h-1.5 bg-white/20 rounded-full overflow-hidden"><div className="h-full bg-white transition-all duration-1000" style={{ width: result.confidence }}></div></div>
                     </div>
                   )}
                </div>
                <div className="p-8 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
                   <div><h4 className="font-black text-gray-400 text-[10px] uppercase tracking-widest mb-3">Diagnostic Impression</h4><p className="text-gray-900 text-xl font-black leading-relaxed bg-gray-50 p-6 rounded-3xl border border-gray-100">{result.diagnosis}</p></div>
                   {result.angles && result.angles.length > 0 && (
                     <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100">
                        <h4 className="font-black text-amber-800 text-xs mb-4 flex items-center gap-2 uppercase tracking-tighter"><Ruler size={18} /> پارامترهای بیومتری</h4>
                        <div className="grid grid-cols-2 gap-3">
                           {result.angles.map((a, i) => (<div key={i} className="bg-white p-3 rounded-2xl border border-amber-100 text-center font-black text-amber-900 text-sm shadow-sm">{a}</div>))}
                        </div>
                     </div>
                   )}
                   <div><h4 className="font-black text-gray-400 text-[10px] uppercase tracking-widest mb-4">Detailed Findings</h4><ul className="space-y-4">{result.findings.map((f, i) => (<li key={i} className="flex items-start gap-4 text-sm text-gray-700 font-bold"><div className="mt-1.5 w-2 h-2 bg-amber-500 rounded-full shrink-0"></div><span>{f}</span></li>))}</ul></div>
                   <div className="bg-indigo-600 p-6 rounded-3xl text-white shadow-xl shadow-indigo-100"><h4 className="font-black text-xs uppercase mb-4 flex items-center gap-2"><Activity size={16} /> پروتکل توان‌بخشی پیشنهادی</h4><ul className="space-y-3">{result.recommendations.map((r, i) => (<li key={i} className="text-sm font-bold opacity-90 leading-relaxed">• {r}</li>))}</ul></div>
                   {result.nextSteps && result.nextSteps.length > 0 && (<div className="mt-6 pt-6 border-t border-gray-100"><h4 className="font-black text-slate-700 text-xs mb-4 flex items-center gap-2"><Sparkles size={16} className="text-amber-500" /> پیشنهاد پاراکلینیک</h4><div className="grid gap-3">{result.nextSteps.map((step, i) => (<div key={i} className="bg-slate-900 p-4 rounded-2xl text-amber-200 text-sm font-bold flex items-center gap-3 border border-slate-800"><ChevronRight size={18} className="text-amber-400" />{step}</div>))}</div></div>)}
                </div>
                <div className="p-6 bg-gray-50 text-[10px] text-gray-400 text-center font-bold tracking-widest uppercase">Expert-Link Orthopedic Module / Posture AI</div>
             </div>
          ) : (
              <div className="h-full bg-gray-50 rounded-[3rem] border-4 border-dashed border-gray-100 flex flex-col items-center justify-center text-gray-300 p-12 text-center">
                 <Bone size={80} className="mb-6 opacity-10" />
                 <p className="text-xl font-black tracking-tight text-gray-400">منتظر دریافت تصویر برای آنالیز...</p>
                 <p className="text-sm mt-4 font-bold max-w-xs leading-relaxed">گزارش نهایی شامل تحلیل پاسچرال، سنجش زوایای بیومکانیکال و گریدینگ اختصاصی آرتروز بر اساس Kellgren-Lawrence خواهد بود.</p>
              </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Orthopedics;
