
import React, { useState } from 'react';
import { analyzeGastroenterology } from '../services/geminiService';
import { GastroenterologyAnalysis } from '../types';
import { Utensils, Microscope, Activity, AlertCircle, CheckCircle, Upload, MapPin, Flame, ArrowLeft, Loader2, Sparkles, ChevronRight } from 'lucide-react';

type Tab = 'meal' | 'endoscopy' | 'pain';

const Gastroenterology: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('meal');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GastroenterologyAnalysis | null>(null);

  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const [painLocation, setPainLocation] = useState<string | null>(null);
  const [painSymptoms, setPainSymptoms] = useState('');

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage(file);
      setPreview(URL.createObjectURL(file));
      setResult(null);
    }
  };

  const handleAnalyze = async () => {
    if (activeTab === 'pain') {
        if (!painLocation || !painSymptoms) return;
        setLoading(true);
        try {
            const input = `Location: ${painLocation}. Symptoms: ${painSymptoms}`;
            const res = await analyzeGastroenterology(input, 'pain');
            setResult(res);
        } catch (e) {
            console.error(e);
            alert('خطا در تحلیل درد');
        } finally {
            setLoading(false);
        }
    } else {
        if (!image) return;
        setLoading(true);
        try {
            const res = await analyzeGastroenterology(image, activeTab);
            setResult(res);
        } catch (e) {
            console.error(e);
            alert('خطا در آنالیز تصویر');
        } finally {
            setLoading(false);
        }
    }
  };

  const PainZone = ({ id, label, color }: { id: string, label: string, color: string }) => (
    <button
      onClick={() => setPainLocation(id)}
      className={`p-4 rounded-xl text-xs font-black transition-all border-2 ${
        painLocation === id 
          ? 'bg-emerald-600 text-white border-emerald-800 scale-105 shadow-lg' 
          : `${color} bg-opacity-10 border-transparent hover:bg-opacity-20 text-gray-700`
      }`}
    >
      {label}
    </button>
  );

  const MobileResultCard = () => {
    if (!result) return null;
    return (
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 animate-slide-up mb-24">
        <div className={`p-5 text-white flex justify-between items-center ${
          result.severity === 'critical' ? 'bg-red-600' : 
          result.severity === 'concern' ? 'bg-orange-500' : 'bg-emerald-600'
        }`}>
           <div>
             <h3 className="font-bold text-lg">گزارش گوارش و آندوسکوپی</h3>
             <p className="text-white/90 text-[10px] mt-0.5 font-bold uppercase tracking-widest">{result.diagnosis}</p>
           </div>
           {result.severity === 'critical' ? <AlertCircle size={24} /> : <Microscope size={24} />}
        </div>
        <div className="p-5 space-y-4">
           {result.confidence && (
              <div className="space-y-1">
                 <div className="flex justify-between text-[10px] font-bold text-gray-400">
                    <span>اطمینان بالینی</span>
                    <span>{result.confidence}</span>
                 </div>
                 <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: result.confidence }}></div>
                 </div>
              </div>
           )}
           
           {result.organ && (
              <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 text-center">
                 <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">ارگان درگیر احتمالی</span>
                 <p className="text-lg font-black text-emerald-800 mt-0.5">{result.organ}</p>
              </div>
           )}

           <div className="space-y-2">
              <h4 className="font-bold text-gray-700 text-xs uppercase">یافته‌های آندوسکوپیک</h4>
              {result.findings.map((f, i) => (
                <div key={i} className="text-xs bg-gray-50 p-2.5 rounded-lg text-gray-600 border-r-2 border-emerald-400">{f}</div>
              ))}
           </div>

           {result.nextSteps && result.nextSteps.length > 0 && (
              <div className="bg-slate-900 p-4 rounded-2xl text-white shadow-lg">
                 <h4 className="font-black text-xs mb-3 flex items-center gap-2 text-emerald-400">
                    <Sparkles size={14} />
                    گام‌های تشخیصی بعدی
                 </h4>
                 <div className="space-y-2">
                    {result.nextSteps.map((step, i) => (
                       <div key={i} className="flex gap-2 items-start text-xs opacity-90">
                          <ChevronRight size={14} className="text-emerald-400 shrink-0" />
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
      <div className="lg:hidden flex flex-col h-full">
         <div className="bg-white p-4 sticky top-0 z-30 shadow-sm border-b border-gray-100">
            <div className="flex justify-between items-center mb-4">
               <div className="flex items-center gap-2">
                  <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600"><Utensils size={20} /></div>
                  <h2 className="text-lg font-bold text-gray-800 tracking-tight">گوارش و کبد</h2>
               </div>
            </div>
            
            <div className="flex bg-gray-100 p-1 rounded-xl">
               <button onClick={() => { setActiveTab('meal'); setResult(null); setImage(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'meal' ? 'bg-white shadow text-emerald-600' : 'text-gray-500'}`}>تغذیه</button>
               <button onClick={() => { setActiveTab('endoscopy'); setResult(null); setImage(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'endoscopy' ? 'bg-white shadow text-emerald-600' : 'text-gray-500'}`}>آندوسکوپی</button>
               <button onClick={() => { setActiveTab('pain'); setResult(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'pain' ? 'bg-white shadow text-emerald-600' : 'text-gray-500'}`}>نقشه درد</button>
            </div>
         </div>

         <div className="flex-1 overflow-y-auto p-4 pb-32">
            {!result ? (
               <div className="space-y-6 animate-slide-up">
                  {(activeTab === 'meal' || activeTab === 'endoscopy') && (
                     <div className="space-y-4">
                        <div className="border-2 border-dashed border-emerald-200 bg-emerald-50/50 rounded-3xl h-64 flex flex-col items-center justify-center relative overflow-hidden group">
                           <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleImage} />
                           {preview ? <img src={preview} className="w-full h-full object-contain" alt="GI" /> : <div className="text-center"><div className="bg-white p-4 rounded-full shadow-sm mb-4 inline-block"><Microscope size={32} className="text-emerald-400" /></div><p className="text-gray-500 text-xs font-bold">آپلود عکس غذا یا آندوسکوپی</p></div>}
                        </div>
                     </div>
                  )}
                  {activeTab === 'pain' && (
                     <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-2 aspect-square max-w-sm mx-auto bg-gray-100 p-2 rounded-2xl shadow-inner">
                           <PainZone id="RUQ" label="RUQ" color="bg-orange-200" />
                           <PainZone id="Epigastric" label="Epi" color="bg-red-200" />
                           <PainZone id="LUQ" label="LUQ" color="bg-orange-200" />
                           <PainZone id="RightFlank" label="R.Flank" color="bg-yellow-200" />
                           <PainZone id="Periumbilical" label="Umb" color="bg-purple-200" />
                           <PainZone id="LeftFlank" label="L.Flank" color="bg-yellow-200" />
                           <PainZone id="RLQ" label="RLQ" color="bg-blue-200" />
                           <PainZone id="Suprapubic" label="Supra" color="bg-green-200" />
                           <PainZone id="LLQ" label="LLQ" color="bg-blue-200" />
                        </div>
                        <input type="text" className="w-full p-4 bg-white border border-gray-100 rounded-2xl outline-none font-bold text-gray-700 shadow-sm" placeholder="علائم همراه (تهوع، اسهال...)" value={painSymptoms} onChange={e => setPainSymptoms(e.target.value)} />
                     </div>
                  )}
               </div>
            ) : (
               <MobileResultCard />
            )}
         </div>

         <div className="fixed bottom-[5.5rem] left-0 right-0 px-4 z-40">
            <button 
               onClick={result ? () => setResult(null) : handleAnalyze}
               disabled={loading || (activeTab !== 'pain' && !image) || (activeTab === 'pain' && (!painLocation || !painSymptoms))}
               className={`w-full py-4 rounded-2xl font-bold shadow-2xl flex items-center justify-center gap-2 transition-all ${result ? 'bg-gray-100 text-gray-600' : 'bg-emerald-600 text-white shadow-emerald-200'}`}
            >
               {loading ? <Loader2 className="animate-spin" /> : result ? <ArrowLeft /> : <MapPin />}
               {loading ? 'تحلیل سیستم گوارش...' : result ? 'تست جدید' : 'شروع آنالیز تخصصی'}
            </button>
         </div>
      </div>

      <div className="hidden lg:grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
             <h2 className="text-2xl font-black text-gray-800 mb-8 flex items-center gap-3">
              <Microscope className="text-emerald-600" size={32} />
              <span>کنسول مشاور گوارش و کبد (Expert-Link)</span>
            </h2>

            <div className="flex bg-gray-100 p-1.5 rounded-2xl mb-8">
              <button onClick={() => { setActiveTab('meal'); setResult(null); setImage(null); }} className={`flex-1 py-4 px-6 rounded-xl font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'meal' ? 'bg-emerald-600 text-white shadow-xl' : 'text-gray-500 hover:bg-gray-50'}`}><Utensils /> کالری و مزاج</button>
              <button onClick={() => { setActiveTab('endoscopy'); setResult(null); setImage(null); }} className={`flex-1 py-4 px-6 rounded-xl font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'endoscopy' ? 'bg-emerald-600 text-white shadow-xl' : 'text-gray-500 hover:bg-gray-50'}`}><Microscope /> آندوسکوپی</button>
              <button onClick={() => { setActiveTab('pain'); setResult(null); }} className={`flex-1 py-4 px-6 rounded-xl font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'pain' ? 'bg-emerald-600 text-white shadow-xl' : 'text-gray-500 hover:bg-gray-50'}`}><MapPin /> نقشه‌برداری درد</button>
            </div>

            {activeTab === 'pain' ? (
               <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-3 aspect-square max-w-md mx-auto bg-gray-50 p-4 rounded-[3rem] shadow-inner">
                    <PainZone id="RUQ" label="ربع بالا راست" color="bg-orange-200" />
                    <PainZone id="Epigastric" label="اپی‌گاستر" color="bg-red-200" />
                    <PainZone id="LUQ" label="ربع بالا چپ" color="bg-orange-200" />
                    <PainZone id="RightFlank" label="پهلو راست" color="bg-yellow-200" />
                    <PainZone id="Periumbilical" label="ناف" color="bg-purple-200" />
                    <PainZone id="LeftFlank" label="پهلو چپ" color="bg-yellow-200" />
                    <PainZone id="RLQ" label="ربع پایین راست" color="bg-blue-200" />
                    <PainZone id="Suprapubic" label="زیر شکم" color="bg-green-200" />
                    <PainZone id="LLQ" label="ربع پایین چپ" color="bg-blue-200" />
                  </div>
                  <input type="text" className="w-full p-5 bg-gray-50 border border-gray-100 rounded-3xl outline-none focus:ring-4 focus:ring-emerald-50 font-bold text-gray-700" placeholder="علائم همراه و شدت درد (Visual Analog Scale)..." value={painSymptoms} onChange={e => setPainSymptoms(e.target.value)} />
               </div>
            ) : (
               <div className="relative group">
                  <div className={`border-2 border-dashed rounded-[3rem] h-[500px] flex items-center justify-center relative overflow-hidden transition-all duration-500 ${loading ? 'border-emerald-500 bg-emerald-50/10' : 'border-gray-200 bg-gray-900'}`}>
                      <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-30" onChange={handleImage} disabled={loading} />
                      {preview ? <img src={preview} alt="Endoscopy Scan" className="w-full h-full object-contain z-10" /> : <div className="text-center p-4 z-10"><Upload size={48} className="mx-auto text-emerald-400 mb-6 group-hover:scale-110 transition-transform" /><p className="font-black text-gray-300 text-xl tracking-tight">آپلود تصویر آندوسکوپی یا وعده غذایی</p></div>}
                  </div>
               </div>
            )}
            
            <div className="mt-8">
              <button onClick={handleAnalyze} disabled={loading || (activeTab !== 'pain' && !image) || (activeTab === 'pain' && (!painLocation || !painSymptoms))} className="w-full bg-emerald-600 text-white font-black py-5 rounded-2xl shadow-2xl shadow-emerald-200 disabled:opacity-50 hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 text-lg">{loading ? <><Activity className="animate-spin" /><span>در حال واکاوی الگوهای مخاطی...</span></> : <><Microscope /><span>تولید ریپورت فوق‌تخصصی گوارش</span></>}</button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 h-full">
          {result ? (
             <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100 h-full flex flex-col animate-fade-in">
                <div className={`p-8 text-white ${result.severity === 'critical' ? 'bg-red-600' : result.severity === 'concern' ? 'bg-orange-500' : 'bg-emerald-600'}`}>
                   <div className="flex justify-between items-start">
                      <div>
                         <h3 className="text-2xl font-black">گزارش آندوسکوپیست</h3>
                         <p className="text-white/70 text-xs mt-1 uppercase tracking-widest font-bold">GI CLINIC REPORT / {activeTab}</p>
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
                      <h4 className="font-black text-gray-400 text-[10px] uppercase tracking-widest mb-3">Clinical Impression</h4>
                      <p className="text-gray-900 text-2xl font-black leading-relaxed bg-gray-50 p-6 rounded-3xl border border-gray-100">{result.diagnosis}</p>
                   </div>
                   
                   {result.organ && (
                     <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
                        <h4 className="font-black text-emerald-800 text-xs mb-4 flex items-center gap-2 uppercase tracking-tighter"><MapPin size={18} /> کانون درگیری احتمالی</h4>
                        <p className="text-xl text-emerald-900 leading-relaxed font-black">{result.organ}</p>
                     </div>
                   )}

                   <div>
                      <h4 className="font-black text-gray-400 text-[10px] uppercase tracking-widest mb-4">Detailed Findings</h4>
                      <ul className="space-y-4">
                        {result.findings.map((f, i) => (
                           <li key={i} className="flex items-start gap-4 text-sm text-gray-700 font-bold">
                              <div className="mt-1.5 w-2 h-2 bg-emerald-500 rounded-full shrink-0"></div>
                              <span>{f}</span>
                           </li>
                        ))}
                      </ul>
                   </div>

                   {result.nextSteps && result.nextSteps.length > 0 && (
                      <div className="mt-6 pt-6 border-t border-gray-100">
                         <h4 className="font-black text-slate-700 text-xs mb-4 flex items-center gap-2">
                            <Sparkles size={16} className="text-emerald-500" />
                            پیشنهاد مشاور (Pathology/Lab)
                         </h4>
                         <div className="grid gap-3">
                            {result.nextSteps.map((step, i) => (
                               <div key={i} className="bg-slate-900 p-4 rounded-2xl text-emerald-200 text-sm font-bold flex items-center gap-3 border border-slate-800">
                                  <ChevronRight size={18} className="text-emerald-400" />
                                  {step}
                               </div>
                            ))}
                         </div>
                      </div>
                   )}
                </div>
                <div className="p-6 bg-gray-50 text-[10px] text-gray-400 text-center font-bold tracking-widest uppercase">Expert-Link GI Module / Endoscopy Suite</div>
             </div>
          ) : (
              <div className="h-full bg-gray-50 rounded-[3rem] border-4 border-dashed border-gray-100 flex flex-col items-center justify-center text-gray-300 p-12 text-center">
                 <Utensils size={80} className="mb-6 opacity-10" />
                 <p className="text-xl font-black tracking-tight text-gray-400">منتظر دریافت تصویر برای آنالیز...</p>
                 <p className="text-sm mt-4 font-bold max-w-xs leading-relaxed">گزارش نهایی شامل تحلیل مخاط، شناسایی پاتولوژی‌های دیواره و انطباق نقشه درد با آناتومی داخلی خواهد بود.</p>
              </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Gastroenterology;
