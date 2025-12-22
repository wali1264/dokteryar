
import React, { useState } from 'react';
import { analyzeGenetics } from '../services/geminiService';
import { GeneticsAnalysis } from '../types';
import { Dna, FileText, Pill, Users, AlertCircle, CheckCircle, Upload, Activity, ArrowLeft, Loader2, Sparkles, ChevronRight, GitBranch } from 'lucide-react';

type Tab = 'report' | 'pharma' | 'family';

const Genetics: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('report');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GeneticsAnalysis | null>(null);

  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const [pharmaData, setPharmaData] = useState({ drug: '', profile: '' });
  const [familyText, setFamilyText] = useState('');

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage(file);
      setPreview(URL.createObjectURL(file));
      setResult(null);
    }
  };

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      let res;
      if (activeTab === 'report') {
         if (!image) return;
         res = await analyzeGenetics(image, 'report');
      } else if (activeTab === 'pharma') {
         if (!pharmaData.drug) return;
         res = await analyzeGenetics(pharmaData, 'pharma');
      } else {
         if (!familyText.trim()) return;
         res = await analyzeGenetics(familyText, 'family');
      }
      setResult(res);
    } catch (e) {
      console.error(e);
      alert('خطا در آنالیز ژنتیکی');
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
          result.severity === 'concern' ? 'bg-orange-500' : 'bg-fuchsia-600'
        }`}>
           <div>
             <h3 className="font-bold text-lg">گزارش مشاوره ژنتیک</h3>
             <p className="text-white/90 text-[10px] mt-0.5 tracking-widest font-bold uppercase">{result.diagnosis}</p>
           </div>
           {result.severity === 'critical' ? <AlertCircle size={24} /> : <Dna size={24} />}
        </div>
        <div className="p-5 space-y-4">
           {result.confidence && (
              <div className="space-y-1">
                 <div className="flex justify-between text-[10px] font-bold text-gray-400"><span>دقت تحلیل توالی</span><span>{result.confidence}</span></div>
                 <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-fuchsia-500 transition-all duration-1000" style={{ width: result.confidence }}></div></div>
              </div>
           )}

           {result.inheritancePattern && (
              <div className="bg-fuchsia-50 p-3 rounded-xl border border-fuchsia-100 flex items-center gap-3">
                 <div className="p-2 bg-white rounded-lg shadow-sm text-fuchsia-600"><GitBranch size={16} /></div>
                 <div><span className="text-[8px] text-fuchsia-400 font-bold uppercase tracking-widest">الگوی توارث احتمالی</span><p className="text-sm font-black text-fuchsia-900">{result.inheritancePattern}</p></div>
              </div>
           )}

           <div className="space-y-2">
              <h4 className="font-bold text-gray-700 text-xs uppercase">یافته‌های ژنومیک</h4>
              {result.findings.map((f, i) => (
                <div key={i} className="text-xs bg-gray-50 p-2.5 rounded-lg text-gray-600 border-r-2 border-fuchsia-400 font-bold">{f}</div>
              ))}
           </div>

           {result.nextSteps && result.nextSteps.length > 0 && (
              <div className="bg-slate-900 p-4 rounded-2xl text-white shadow-lg">
                 <h4 className="font-black text-xs mb-3 flex items-center gap-2 text-fuchsia-400"><Sparkles size={14} /> پیشنهاد گام بعدی بالینی</h4>
                 <div className="space-y-2">
                    {result.nextSteps.map((step, i) => (
                       <div key={i} className="flex gap-2 items-start text-xs opacity-90"><ChevronRight size={14} className="text-fuchsia-400 shrink-0" /><span>{step}</span></div>
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
                  <div className="bg-fuchsia-100 p-2 rounded-xl text-fuchsia-600"><Dna size={20} /></div>
                  <h2 className="text-lg font-bold text-gray-800 tracking-tight">ژنتیک پزشکی</h2>
               </div>
            </div>
            <div className="flex bg-gray-100 p-1 rounded-xl">
               <button onClick={() => { setActiveTab('report'); setResult(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'report' ? 'bg-white shadow text-fuchsia-600' : 'text-gray-500'}`}>گزارش</button>
               <button onClick={() => { setActiveTab('pharma'); setResult(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'pharma' ? 'bg-white shadow text-fuchsia-600' : 'text-gray-500'}`}>دارو</button>
               <button onClick={() => { setActiveTab('family'); setResult(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'family' ? 'bg-white shadow text-fuchsia-600' : 'text-gray-500'}`}>شجره‌نامه</button>
            </div>
         </div>

         <div className="flex-1 overflow-y-auto p-4 pb-32">
            {!result ? (
               <div className="space-y-6 animate-slide-up">
                  {activeTab === 'report' && (
                     <div className="space-y-4">
                        <div className="border-2 border-dashed border-fuchsia-200 bg-fuchsia-50/50 rounded-3xl h-64 flex flex-col items-center justify-center relative overflow-hidden group">
                           <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleImage} />
                           {preview ? <img src={preview} className="w-full h-full object-contain" alt="Report" /> : <div className="text-center"><FileText className="mx-auto text-fuchsia-400 mb-2" /><p className="text-gray-500 text-xs font-bold">عکس گزارش کاریوتایپ یا NGS</p></div>}
                        </div>
                     </div>
                  )}
                  {activeTab === 'pharma' && (
                     <div className="bg-white p-4 rounded-2xl border border-gray-100 space-y-4 shadow-sm">
                        <input type="text" className="w-full p-3 bg-gray-50 rounded-xl outline-none font-bold text-sm" placeholder="نام دارو (Warfarin, Clopidogrel...)" value={pharmaData.drug} onChange={e => setPharmaData({...pharmaData, drug: e.target.value})} />
                     </div>
                  )}
                  {activeTab === 'family' && (
                     <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                        <textarea className="w-full p-3 bg-gray-50 rounded-xl outline-none h-48 resize-none text-sm font-bold leading-relaxed" placeholder="شرح بیماری‌های وراثتی در خانواده..." value={familyText} onChange={e => setFamilyText(e.target.value)} />
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
               disabled={loading}
               className={`w-full py-4 rounded-2xl font-bold shadow-2xl flex items-center justify-center gap-2 transition-all ${result ? 'bg-gray-100 text-gray-600' : 'bg-fuchsia-600 text-white shadow-fuchsia-200'}`}
            >
               {loading ? <Loader2 className="animate-spin" /> : result ? <ArrowLeft /> : <Activity />}
               {loading ? 'واکاوی کدون‌های ژنتیکی...' : result ? 'بازگشت' : 'شروع آنالیز دقیق'}
            </button>
         </div>
      </div>

      <div className="hidden lg:grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
             <h2 className="text-2xl font-black text-gray-800 mb-8 flex items-center gap-3">
              <Dna className="text-fuchsia-600" size={32} />
              <span>کنسول فوق‌تخصصی ژنتیک پزشکی (Expert-Link)</span>
            </h2>
            <div className="flex bg-gray-100 p-1.5 rounded-2xl mb-8">
              <button onClick={() => { setActiveTab('report'); setResult(null); setImage(null); }} className={`flex-1 py-4 px-6 rounded-xl font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'report' ? 'bg-fuchsia-600 text-white shadow-xl' : 'text-gray-500 hover:bg-gray-50'}`}><FileText /> مفسر گزارش</button>
              <button onClick={() => { setActiveTab('pharma'); setResult(null); }} className={`flex-1 py-4 px-6 rounded-xl font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'pharma' ? 'bg-fuchsia-600 text-white shadow-xl' : 'text-gray-500 hover:bg-gray-50'}`}><Pill /> فارماکوژنتیک</button>
              <button onClick={() => { setActiveTab('family'); setResult(null); }} className={`flex-1 py-4 px-6 rounded-xl font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'family' ? 'bg-fuchsia-600 text-white shadow-xl' : 'text-gray-500 hover:bg-gray-50'}`}><Users /> الگوی توارث</button>
            </div>

            <div className="min-h-[400px]">
               {activeTab === 'report' ? (
                 <div className="relative group h-[400px]">
                    <div className={`border-2 border-dashed rounded-[3rem] h-full flex items-center justify-center relative overflow-hidden transition-all duration-500 ${loading ? 'border-fuchsia-500 bg-fuchsia-50/10' : 'border-gray-200 bg-gray-900'}`}>
                        <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-30" onChange={handleImage} disabled={loading} />
                        {preview ? <img src={preview} alt="Genetics Report" className="w-full h-full object-contain z-10" /> : <div className="text-center p-4 z-10"><Upload size={48} className="mx-auto text-fuchsia-400 mb-6 group-hover:scale-110 transition-transform" /><p className="font-black text-gray-300 text-xl tracking-tight">آپلود گزارش آزمایشگاه ژنتیک</p></div>}
                    </div>
                 </div>
               ) : activeTab === 'pharma' ? (
                 <div className="bg-gray-50 p-8 rounded-[3rem] space-y-6">
                    <div className="space-y-2"><label className="text-xs font-black text-gray-400 uppercase tracking-widest">Target Drug Name</label><input type="text" className="w-full p-4 bg-white border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-fuchsia-50 font-black text-xl" value={pharmaData.drug} onChange={e => setPharmaData({...pharmaData, drug: e.target.value})} /></div>
                    <div className="space-y-2"><label className="text-xs font-black text-gray-400 uppercase tracking-widest">Genetic Profile / Variations (Optional)</label><textarea className="w-full p-4 bg-white border border-gray-100 rounded-2xl outline-none h-32 resize-none font-bold text-gray-600" placeholder="e.g., MTHFR mutation, CYP2D6 status..." value={pharmaData.profile} onChange={e => setPharmaData({...pharmaData, profile: e.target.value})} /></div>
                 </div>
               ) : (
                 <div className="bg-gray-50 p-8 rounded-[3rem] space-y-6">
                    <div className="space-y-2"><label className="text-xs font-black text-gray-400 uppercase tracking-widest">Family History Narrative</label><textarea className="w-full p-4 bg-white border border-gray-100 rounded-2xl outline-none h-64 resize-none font-bold text-gray-700 leading-relaxed" placeholder="شرح کامل سوابق بیماری‌های وراثتی در خانواده..." value={familyText} onChange={e => setFamilyText(e.target.value)} /></div>
                 </div>
               )}
            </div>
            <div className="mt-8"><button onClick={handleAnalyze} disabled={loading} className="w-full bg-fuchsia-600 text-white font-black py-5 rounded-2xl shadow-2xl shadow-fuchsia-200 hover:bg-fuchsia-700 transition-all flex items-center justify-center gap-3 text-lg">{loading ? <><Activity className="animate-spin" /><span>در حال پردازش توالی‌های نوکلئوتیدی...</span></> : <><Dna /><span>تولید ریپورت فوق‌تخصصی ژنتیک</span></>}</button></div>
          </div>
        </div>

        <div className="lg:col-span-5 h-full">
          {result ? (
             <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100 h-full flex flex-col animate-fade-in">
                <div className={`p-8 text-white ${result.severity === 'critical' ? 'bg-red-600' : result.severity === 'concern' ? 'bg-orange-500' : 'bg-fuchsia-600'}`}>
                   <div className="flex justify-between items-start">
                      <div><h3 className="text-2xl font-black">گزارش مشاور ژنتیک</h3><p className="text-white/70 text-xs mt-1 uppercase tracking-widest font-bold">GENETIC CLINIC REPORT / {activeTab}</p></div>
                      <CheckCircle size={40} />
                   </div>
                   {result.confidence && (
                     <div className="mt-8 space-y-2">
                        <div className="flex justify-between text-[10px] font-black uppercase opacity-60"><span>Sequencing Confidence</span><span>{result.confidence}</span></div>
                        <div className="h-1.5 bg-white/20 rounded-full overflow-hidden"><div className="h-full bg-white transition-all duration-1000" style={{ width: result.confidence }}></div></div>
                     </div>
                   )}
                </div>
                <div className="p-8 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
                   <div><h4 className="font-black text-gray-400 text-[10px] uppercase tracking-widest mb-3">Diagnostic Impression</h4><p className="text-gray-900 text-xl font-black leading-relaxed bg-gray-50 p-6 rounded-3xl border border-gray-100">{result.diagnosis}</p></div>
                   
                   {result.inheritancePattern && (
                     <div className="bg-fuchsia-50 p-6 rounded-3xl border border-fuchsia-100 flex items-center gap-4">
                        <div className="p-3 bg-white rounded-2xl shadow-sm text-fuchsia-600"><GitBranch size={24} /></div>
                        <div><h4 className="font-black text-fuchsia-800 text-xs mb-1 uppercase tracking-tighter">Inheritance Pattern</h4><p className="text-xl font-black text-fuchsia-900">{result.inheritancePattern}</p></div>
                     </div>
                   )}

                   {result.drugCompatibility && (
                     <div className={`p-6 rounded-3xl border ${result.drugCompatibility.status.includes('Safe') ? 'bg-green-50 border-green-100 text-green-900' : 'bg-red-50 border-red-100 text-red-900'}`}>
                        <div className="flex justify-between items-center mb-2"><h4 className="font-black text-sm uppercase">{result.drugCompatibility.drug}</h4><span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white border border-black/5">{result.drugCompatibility.status}</span></div>
                        <p className="text-xs font-bold leading-relaxed">{result.drugCompatibility.recommendation}</p>
                     </div>
                   )}

                   <div><h4 className="font-black text-gray-400 text-[10px] uppercase tracking-widest mb-4">Detailed Genomic Findings</h4><ul className="space-y-4">{result.findings.map((f, i) => (<li key={i} className="flex items-start gap-4 text-sm text-gray-700 font-bold"><div className="mt-1.5 w-2 h-2 bg-fuchsia-500 rounded-full shrink-0"></div><span>{f}</span></li>))}</ul></div>
                   {result.nextSteps && result.nextSteps.length > 0 && (<div className="mt-6 pt-6 border-t border-gray-100"><h4 className="font-black text-slate-700 text-xs mb-4 flex items-center gap-2"><Sparkles size={16} className="text-fuchsia-500" /> همکاری تخصصی (Laboratory Protocol)</h4><div className="grid gap-3">{result.nextSteps.map((step, i) => (<div key={i} className="bg-slate-900 p-4 rounded-2xl text-fuchsia-200 text-sm font-bold flex items-center gap-3 border border-slate-800"><ChevronRight size={18} className="text-indigo-400" />{step}</div>))}</div></div>)}
                </div>
                <div className="p-6 bg-gray-50 text-[10px] text-gray-400 text-center font-bold tracking-widest uppercase">Expert-Link Genetics Module / Genomic AI</div>
             </div>
          ) : (
              <div className="h-full bg-gray-50 rounded-[3rem] border-4 border-dashed border-gray-100 flex flex-col items-center justify-center text-gray-300 p-12 text-center">
                 <Dna size={80} className="mb-6 opacity-10" />
                 <p className="text-xl font-black tracking-tight text-gray-400">منتظر دریافت داده‌های ژنومیک...</p>
                 <p className="text-sm mt-4 font-bold max-w-xs leading-relaxed">گزارش نهایی شامل تحلیل جهش‌های بیماری‌زا (Pathogenic Variants)، تعیین الگوی توارث و انطباق دارو با ژنوتیپ بیمار خواهد بود.</p>
              </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Genetics;
