
import React, { useState } from 'react';
import { analyzeCulture } from '../services/geminiService';
import { LabAnalysis } from '../types';
import { Upload, Microscope, CheckCircle, AlertTriangle, Activity, ArrowLeft, Loader2, FlaskConical, Dna, FileText, ChevronRight, Sparkles } from 'lucide-react';

const Laboratory: React.FC = () => {
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [labType, setLabType] = useState('Blood Agar');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LabAnalysis | null>(null);

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
      const res = await analyzeCulture(image, labType, notes);
      setResult(res);
    } catch (e) {
      console.error(e);
      alert('خطا در آنالیز تصویر');
    } finally {
      setLoading(false);
    }
  };

  const MobileResultCard = () => {
    if (!result) return null;
    return (
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 animate-slide-up mb-24">
        <div className={`p-5 text-white flex justify-between items-center ${
          result.severity === 'high' ? 'bg-red-600' : 
          result.severity === 'medium' ? 'bg-orange-500' : 'bg-indigo-600'
        }`}>
           <div>
             <h3 className="font-bold text-lg">گزارش پاتولوژی (AI)</h3>
             <p className="text-white/90 text-xs mt-1 uppercase font-bold">{result.suspectedOrganism}</p>
           </div>
           {result.severity === 'high' ? <AlertTriangle size={24} /> : <Microscope size={24} />}
        </div>
        <div className="p-5 space-y-4">
           {result.confidence && (
              <div className="space-y-1">
                 <div className="flex justify-between text-[10px] font-bold text-gray-400">
                    <span>اطمینان پاتولوژیست</span>
                    <span>{result.confidence}</span>
                 </div>
                 <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: result.confidence }}></div>
                 </div>
              </div>
           )}
           <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
              <h4 className="font-bold text-indigo-800 text-xs mb-2 flex items-center gap-1 uppercase tracking-wider">Visual Findings</h4>
              <p className="text-xs text-indigo-900 leading-relaxed font-medium">{result.visualFindings}</p>
           </div>
           
           <div className="space-y-2">
              <h4 className="font-bold text-gray-700 text-xs uppercase">Empiric Suggestions</h4>
              {result.recommendations.map((rec, i) => (
                <div key={i} className="text-xs bg-gray-50 p-2.5 rounded-lg text-gray-600 border-r-2 border-indigo-400 font-bold">{rec}</div>
              ))}
           </div>

           {result.nextSteps && result.nextSteps.length > 0 && (
             <div className="bg-slate-900 p-4 rounded-2xl text-white shadow-lg">
                <h4 className="font-black text-xs mb-3 flex items-center gap-2 text-indigo-400">
                   <Sparkles size={14} />
                   گام‌های بالینی همکار
                </h4>
                <div className="space-y-2">
                   {result.nextSteps.map((step, i) => (
                      <div key={i} className="flex gap-2 items-start text-xs opacity-90">
                         <ChevronRight size={14} className="text-indigo-400 shrink-0" />
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
                  <div className="bg-indigo-100 p-2 rounded-xl text-indigo-600"><FlaskConical size={20} /></div>
                  <h2 className="text-lg font-bold text-gray-800 tracking-tight">آزمایشگاه تخصصی</h2>
               </div>
            </div>
            
            <div className="flex overflow-x-auto gap-2 pb-2 no-scrollbar">
               {[
                 { id: 'Blood Agar', label: 'Blood Agar' },
                 { id: 'MacConkey Agar', label: 'MacConkey' },
                 { id: 'Chocolate Agar', label: 'Chocolate' },
                 { id: 'Antibiogram', label: 'Antibiogram' },
                 { id: 'Microscope Slide', label: 'Slide (Gram)' }
               ].map(type => (
                 <button 
                   key={type.id}
                   onClick={() => { setLabType(type.id); setResult(null); }}
                   className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${labType === type.id ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-gray-100 text-gray-500'}`}
                 >
                   {type.label}
                 </button>
               ))}
            </div>
         </div>

         <div className="flex-1 overflow-y-auto p-4 pb-32">
            {!result ? (
               <div className="space-y-6 animate-slide-up">
                  <div className="space-y-4">
                     <div className="border-2 border-dashed border-indigo-200 bg-indigo-50/50 rounded-3xl h-64 flex flex-col items-center justify-center relative overflow-hidden group">
                        <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleImage} />
                        {preview ? <img src={preview} className="w-full h-full object-cover" alt="Lab" /> : <div className="text-center"><div className="bg-white p-3 rounded-full mb-3 shadow-sm inline-block"><Microscope size={24} className="text-indigo-400" /></div><p className="text-gray-500 text-xs font-bold">عکس پلیت/اسلاید</p></div>}
                     </div>
                     <textarea 
                        className="w-full p-3 bg-white border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm h-24 resize-none shadow-sm placeholder-gray-300 font-medium" 
                        placeholder="یادداشت‌های فنی (بو، کلونی، زمان رشد...)" 
                        value={notes} 
                        onChange={e => setNotes(e.target.value)} 
                     />
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
               className={`w-full py-4 rounded-2xl font-bold shadow-2xl flex items-center justify-center gap-2 transition-all ${result ? 'bg-gray-100 text-gray-600' : 'bg-indigo-600 text-white shadow-indigo-200'}`}
            >
               {loading ? <Loader2 className="animate-spin" /> : result ? <ArrowLeft /> : <Microscope />}
               {loading ? 'در حال کشت مجازی...' : result ? 'تست جدید' : 'شروع آنالیز میکروبی'}
            </button>
         </div>
      </div>

      {/* ======================= DESKTOP VIEW ======================= */}
      <div className="hidden lg:grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
             <h2 className="text-2xl font-black text-gray-800 mb-8 flex items-center gap-3">
              <Microscope className="text-indigo-600" size={32} />
              <span>کنسول فوق‌تخصصی میکروبیولوژی (Expert-Link)</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-1">Culture Type / Test</label>
                  <select className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-50 font-bold text-gray-700" value={labType} onChange={(e) => setLabType(e.target.value)}>
                    <option value="Blood Agar">Blood Agar (General)</option>
                    <option value="MacConkey Agar">MacConkey Agar (Gram Negative)</option>
                    <option value="Chocolate Agar">Chocolate Agar (Haemophilus/Neisseria)</option>
                    <option value="Antibiogram">Disk Diffusion (Antibiogram)</option>
                    <option value="Gram Stain">Microscope Slide (Gram Stain)</option>
                  </select>
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-1">Technician Notes</label>
                  <input type="text" className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-50 font-bold text-gray-700" placeholder="Odor, colony color, growth time..." value={notes} onChange={(e) => setNotes(e.target.value)} />
               </div>
            </div>

            <div className="relative group">
              <div className={`border-2 border-dashed rounded-[2rem] h-[450px] flex items-center justify-center relative overflow-hidden transition-all duration-500 ${loading ? 'border-indigo-500 bg-indigo-50/10' : 'border-gray-200 bg-gray-900'}`}>
                  <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-30" onChange={handleImage} disabled={loading} />
                  {preview ? <img src={preview} alt="Lab Scan" className="w-full h-full object-contain z-10" /> : <div className="text-center p-4 z-10"><Upload size={48} className="mx-auto text-indigo-400 mb-6 group-hover:scale-110 transition-transform" /><p className="font-black text-gray-300 text-xl tracking-tight">آپلود عکس پلیت یا اسلاید</p></div>}
              </div>
            </div>
            
            <div className="mt-8">
              <button onClick={handleAnalyze} disabled={!image || loading} className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl shadow-2xl shadow-indigo-200 disabled:opacity-50 hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 text-lg">{loading ? <><Activity className="animate-spin" /><span>در حال واکاوی میکروسکوپی...</span></> : <><Microscope /><span>تولید گزارش رسمی پاتولوژی</span></>}</button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 h-full">
          {result ? (
             <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100 h-full flex flex-col animate-fade-in">
                <div className={`p-8 text-white ${result.severity === 'high' ? 'bg-red-600 animate-pulse' : result.severity === 'medium' ? 'bg-orange-500' : 'bg-indigo-600'}`}>
                   <div className="flex justify-between items-start">
                      <div>
                         <h3 className="text-2xl font-black">گزارش پاتولوژیست (AI)</h3>
                         <p className="text-white/70 text-xs mt-1 uppercase tracking-widest font-bold">Specialized Lab Report / {labType}</p>
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
                      <h4 className="font-black text-gray-400 text-[10px] uppercase tracking-widest mb-3">Diagnostic Impression</h4>
                      <p className="text-gray-900 text-2xl font-black leading-relaxed bg-gray-50 p-6 rounded-3xl border border-gray-100">{result.suspectedOrganism}</p>
                   </div>
                   
                   <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100">
                      <h4 className="font-black text-indigo-800 text-xs mb-4 flex items-center gap-2 uppercase">Visual Findings</h4>
                      <p className="text-sm text-indigo-900 leading-relaxed font-bold">{result.visualFindings}</p>
                   </div>

                   <div>
                      <h4 className="font-black text-gray-400 text-[10px] uppercase tracking-widest mb-4">Empiric Therapy Guidelines</h4>
                      <ul className="space-y-4">
                        {result.recommendations.map((f, i) => (
                           <li key={i} className="flex items-start gap-4 text-sm text-gray-700 font-bold">
                              <div className="mt-1.5 w-2 h-2 bg-indigo-500 rounded-full shrink-0"></div>
                              <span>{f}</span>
                           </li>
                        ))}
                      </ul>
                   </div>

                   {result.nextSteps && result.nextSteps.length > 0 && (
                      <div className="mt-6 pt-6 border-t border-gray-100">
                         <h4 className="font-black text-slate-700 text-xs mb-4 flex items-center gap-2">
                            <Sparkles size={16} className="text-indigo-500" />
                            پیشنهاد مشاور (Pathology Next Steps)
                         </h4>
                         <div className="grid gap-3">
                            {result.nextSteps.map((step, i) => (
                               <div key={i} className="bg-slate-900 p-4 rounded-2xl text-indigo-200 text-sm font-bold flex items-center gap-3 border border-slate-800">
                                  <ChevronRight size={18} className="text-indigo-400" />
                                  {step}
                               </div>
                            ))}
                         </div>
                      </div>
                   )}
                </div>
                <div className="p-6 bg-gray-50 text-[10px] text-gray-400 text-center font-bold tracking-widest uppercase">Expert-Link Protocol / Lab Suite</div>
             </div>
          ) : (
              <div className="h-full bg-gray-50 rounded-[3rem] border-4 border-dashed border-gray-100 flex flex-col items-center justify-center text-gray-300 p-12 text-center">
                 <Microscope size={80} className="mb-6 opacity-10" />
                 <p className="text-xl font-black tracking-tight text-gray-400">منتظر دریافت نمونه برای آنالیز...</p>
                 <p className="text-sm mt-4 font-bold max-w-xs leading-relaxed">گزارش نهایی شامل تحلیل مورفولوژی، گریدینگ و پیشنهاد آنتی‌بیوتیک خواهد بود.</p>
              </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Laboratory;
