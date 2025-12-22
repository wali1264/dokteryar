
import React, { useState } from 'react';
import { analyzeHematology } from '../services/geminiService';
import { HematologyAnalysis } from '../types';
import { Droplet, Microscope, FileText, TrendingUp, AlertCircle, CheckCircle, Upload, Activity, ArrowLeft, Loader2, Sparkles, ChevronRight } from 'lucide-react';

type Tab = 'smear' | 'pathology' | 'markers';

const Hematology: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('smear');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<HematologyAnalysis | null>(null);

  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const [markerData, setMarkerData] = useState({
    name: 'PSA', current: '', unit: 'ng/mL', previous: '', history: ''
  });

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
      if (activeTab === 'markers') {
          res = await analyzeHematology(markerData, 'markers');
      } else {
          if (!image) return;
          res = await analyzeHematology(image, activeTab);
      }
      setResult(res);
    } catch (e) {
      console.error(e);
      alert('خطا در آنالیز خون');
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
          result.severity === 'concern' ? 'bg-orange-500' : 'bg-rose-700'
        }`}>
           <div>
             <h3 className="font-bold text-lg">گزارش هماتولوژی تخصصی</h3>
             <p className="text-white/90 text-[10px] mt-0.5 tracking-widest font-bold uppercase">{result.diagnosis}</p>
           </div>
           {result.severity === 'critical' ? <AlertCircle size={24} /> : <Droplet size={24} />}
        </div>
        <div className="p-5 space-y-4">
           {result.confidence && (
              <div className="space-y-1">
                 <div className="flex justify-between text-[10px] font-bold text-gray-400"><span>اطمینان تشخیص</span><span>{result.confidence}</span></div>
                 <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-rose-500 transition-all duration-1000" style={{ width: result.confidence }}></div></div>
              </div>
           )}
           
           {result.cellTypes && (
             <div className="grid grid-cols-2 gap-2">
                {result.cellTypes.map((c, i) => (
                   <div key={i} className="bg-rose-50 p-2 rounded-xl border border-rose-100 text-center">
                      <span className="text-[8px] text-rose-500 font-bold uppercase block">{c.name}</span>
                      <p className="text-sm font-black text-rose-900">{c.count}</p>
                   </div>
                ))}
             </div>
           )}

           <div className="space-y-2">
              <h4 className="font-bold text-gray-700 text-xs uppercase">یافته‌های میکروسکوپی</h4>
              {result.findings.map((f, i) => (
                <div key={i} className="text-xs bg-gray-50 p-2.5 rounded-lg text-gray-600 border-r-2 border-rose-400 font-bold">{f}</div>
              ))}
           </div>

           {result.nextSteps && result.nextSteps.length > 0 && (
              <div className="bg-slate-900 p-4 rounded-2xl text-white shadow-lg">
                 <h4 className="font-black text-xs mb-3 flex items-center gap-2 text-rose-400"><Sparkles size={14} /> پیشنهاد گام بعدی انکولوژی</h4>
                 <div className="space-y-2">
                    {result.nextSteps.map((step, i) => (
                       <div key={i} className="flex gap-2 items-start text-xs opacity-90"><ChevronRight size={14} className="text-rose-400 shrink-0" /><span>{step}</span></div>
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
                  <div className="bg-rose-100 p-2 rounded-xl text-rose-600"><Droplet size={20} /></div>
                  <h2 className="text-lg font-bold text-gray-800 tracking-tight">خون و سرطان‌شناسی</h2>
               </div>
            </div>
            <div className="flex bg-gray-100 p-1 rounded-xl">
               <button onClick={() => { setActiveTab('smear'); setResult(null); setImage(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'smear' ? 'bg-white shadow text-rose-600' : 'text-gray-500'}`}>لام خون</button>
               <button onClick={() => { setActiveTab('pathology'); setResult(null); setImage(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'pathology' ? 'bg-white shadow text-rose-600' : 'text-gray-500'}`}>پاتولوژی</button>
               <button onClick={() => { setActiveTab('markers'); setResult(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'markers' ? 'bg-white shadow text-rose-600' : 'text-gray-500'}`}>مارکرها</button>
            </div>
         </div>

         <div className="flex-1 overflow-y-auto p-4 pb-32">
            {!result ? (
               <div className="space-y-6 animate-slide-up">
                  {(activeTab === 'smear' || activeTab === 'pathology') && (
                     <div className="space-y-4">
                        <div className="border-2 border-dashed border-rose-200 bg-rose-50/50 rounded-3xl h-64 flex flex-col items-center justify-center relative overflow-hidden group">
                           <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleImage} />
                           {preview ? <img src={preview} className="w-full h-full object-contain" alt="Blood" /> : <div className="text-center"><div className="bg-white p-4 rounded-full shadow-sm mb-4 inline-block"><Microscope size={32} className="text-rose-400" /></div><p className="text-gray-500 text-xs font-bold">آپلود عکس میکروسکوپی یا گزارش</p></div>}
                        </div>
                     </div>
                  )}
                  {activeTab === 'markers' && (
                     <div className="bg-white p-4 rounded-2xl border border-gray-100 space-y-4 shadow-sm">
                        <select className="w-full p-3 bg-gray-50 rounded-xl outline-none font-bold text-sm" value={markerData.name} onChange={e => setMarkerData({...markerData, name: e.target.value})}><option value="PSA">PSA</option><option value="CEA">CEA</option><option value="CA-125">CA-125</option></select>
                        <input type="number" placeholder="مقدار فعلی" className="w-full p-3 bg-gray-50 rounded-xl text-center font-bold" value={markerData.current} onChange={e => setMarkerData({...markerData, current: e.target.value})} />
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
               className={`w-full py-4 rounded-2xl font-bold shadow-2xl flex items-center justify-center gap-2 transition-all ${result ? 'bg-gray-100 text-gray-600' : 'bg-rose-600 text-white shadow-rose-200'}`}
            >
               {loading ? <Loader2 className="animate-spin" /> : result ? <ArrowLeft /> : <Activity />}
               {loading ? 'در حال پایش سلولی...' : result ? 'تست جدید' : 'شروع آنالیز هماتولوژیک'}
            </button>
         </div>
      </div>

      <div className="hidden lg:grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
             <h2 className="text-2xl font-black text-gray-800 mb-8 flex items-center gap-3">
              <Droplet className="text-rose-600" size={32} />
              <span>کنسول فوق‌تخصصی خون و سرطان (Expert-Link)</span>
            </h2>
            <div className="flex bg-gray-100 p-1.5 rounded-2xl mb-8">
              <button onClick={() => { setActiveTab('smear'); setResult(null); setImage(null); }} className={`flex-1 py-4 px-6 rounded-xl font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'smear' ? 'bg-rose-600 text-white shadow-xl' : 'text-gray-500 hover:bg-gray-50'}`}><Microscope /> اسمیر خون</button>
              <button onClick={() => { setActiveTab('pathology'); setResult(null); setImage(null); }} className={`flex-1 py-4 px-6 rounded-xl font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'pathology' ? 'bg-rose-600 text-white shadow-xl' : 'text-gray-500 hover:bg-gray-50'}`}><FileText /> مغز استخوان</button>
              <button onClick={() => { setActiveTab('markers'); setResult(null); }} className={`flex-1 py-4 px-6 rounded-xl font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'markers' ? 'bg-rose-600 text-white shadow-xl' : 'text-gray-500 hover:bg-gray-50'}`}><TrendingUp /> تومور مارکر</button>
            </div>
            <div className="min-h-[400px]">
               {activeTab !== 'markers' ? (
                 <div className="relative group h-[400px]">
                    <div className={`border-2 border-dashed rounded-[3rem] h-full flex items-center justify-center relative overflow-hidden transition-all duration-500 ${loading ? 'border-rose-500 bg-rose-50/10' : 'border-gray-200 bg-gray-900'}`}>
                        <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-30" onChange={handleImage} disabled={loading} />
                        {preview ? <img src={preview} alt="Blood Scan" className="w-full h-full object-contain z-10" /> : <div className="text-center p-4 z-10"><Upload size={48} className="mx-auto text-rose-400 mb-6 group-hover:scale-110 transition-transform" /><p className="font-black text-gray-300 text-xl tracking-tight">آپلود تصویر لام یا بیوپسی</p></div>}
                    </div>
                 </div>
               ) : (
                 <div className="bg-gray-50 p-8 rounded-[3rem] space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase tracking-widest">نوع مارکر</label><select className="w-full p-4 bg-white border border-gray-100 rounded-2xl outline-none font-bold" value={markerData.name} onChange={e => setMarkerData({...markerData, name: e.target.value})}><option value="PSA">PSA (Prostate)</option><option value="CA-125">CA-125 (Ovarian)</option><option value="CEA">CEA (Colon)</option></select></div>
                       <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase tracking-widest">واحد</label><input type="text" className="w-full p-4 bg-white border border-gray-100 rounded-2xl outline-none font-bold text-center" value={markerData.unit} onChange={e => setMarkerData({...markerData, unit: e.target.value})} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase tracking-widest">مقدار فعلی</label><input type="number" step="0.1" className="w-full p-4 bg-white border border-gray-100 rounded-2xl outline-none font-bold text-center text-xl text-rose-600" value={markerData.current} onChange={e => setMarkerData({...markerData, current: e.target.value})} /></div>
                       <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase tracking-widest">مقدار قبلی</label><input type="number" step="0.1" className="w-full p-4 bg-white border border-gray-100 rounded-2xl outline-none font-bold text-center text-xl text-gray-400" value={markerData.previous} onChange={e => setMarkerData({...markerData, previous: e.target.value})} /></div>
                    </div>
                    <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase tracking-widest">تاریخچه درمان (Surgery/Chemo)</label><textarea className="w-full p-4 bg-white border border-gray-100 rounded-2xl outline-none font-bold text-sm h-24 resize-none" value={markerData.history} onChange={e => setMarkerData({...markerData, history: e.target.value})} /></div>
                 </div>
               )}
            </div>
            <div className="mt-8"><button onClick={handleAnalyze} disabled={loading} className="w-full bg-rose-600 text-white font-black py-5 rounded-2xl shadow-2xl shadow-rose-200 hover:bg-rose-700 transition-all flex items-center justify-center gap-3 text-lg">{loading ? <><Activity className="animate-spin" /><span>در حال واکاوی الگوهای سلولی...</span></> : <><Droplet /><span>تولید ریپورت فوق‌تخصصی خون</span></>}</button></div>
          </div>
        </div>

        <div className="lg:col-span-5 h-full">
          {result ? (
             <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100 h-full flex flex-col animate-fade-in">
                <div className={`p-8 text-white ${result.severity === 'critical' ? 'bg-red-600' : result.severity === 'concern' ? 'bg-orange-500' : 'bg-rose-600'}`}>
                   <div className="flex justify-between items-start">
                      <div><h3 className="text-2xl font-black">گزارش مشاور خون</h3><p className="text-white/70 text-xs mt-1 uppercase tracking-widest font-bold">HEMATO-ONCO REPORT / {activeTab}</p></div>
                      <CheckCircle size={40} />
                   </div>
                   {result.confidence && (
                     <div className="mt-8 space-y-2">
                        <div className="flex justify-between text-[10px] font-black uppercase opacity-60"><span>Machine Diagnostic Confidence</span><span>{result.confidence}</span></div>
                        <div className="h-1.5 bg-white/20 rounded-full overflow-hidden"><div className="h-full bg-white transition-all duration-1000" style={{ width: result.confidence }}></div></div>
                     </div>
                   )}
                </div>
                <div className="p-8 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
                   <div><h4 className="font-black text-gray-400 text-[10px] uppercase tracking-widest mb-3">Diagnostic Impression</h4><p className="text-gray-900 text-xl font-black leading-relaxed bg-gray-50 p-6 rounded-3xl border border-gray-100">{result.diagnosis}</p></div>
                   {result.cellTypes && (
                     <div className="grid grid-cols-2 gap-3">
                        {result.cellTypes.map((c, i) => (
                          <div key={i} className="bg-rose-50 p-4 rounded-2xl border border-rose-100 text-center"><span className="text-[10px] font-black text-rose-400 uppercase">{c.name}</span><p className="text-lg font-black text-rose-900">{c.count}</p><p className="text-[10px] text-rose-300 font-bold">{c.status}</p></div>
                        ))}
                     </div>
                   )}
                   {result.markersTrend && (
                     <div className="bg-rose-50 p-6 rounded-3xl border border-rose-100">
                        <h4 className="font-black text-rose-800 text-xs mb-4 flex items-center gap-2 uppercase tracking-tighter"><TrendingUp size={18} /> پایش روند تومور مارکر</h4>
                        {result.markersTrend.map((m, i) => (<div key={i} className="mb-4 last:mb-0"><div className="flex justify-between font-bold text-rose-950 text-sm"><span>{m.name}</span><span className="bg-rose-200 px-2 py-0.5 rounded-lg">{m.trend}</span></div><p className="text-xs text-rose-700 mt-1 font-bold leading-relaxed">{m.significance}</p></div>))}
                     </div>
                   )}
                   <div><h4 className="font-black text-gray-400 text-[10px] uppercase tracking-widest mb-4">Microscopic/Cellular Findings</h4><ul className="space-y-4">{result.findings.map((f, i) => (<li key={i} className="flex items-start gap-4 text-sm text-gray-700 font-bold"><div className="mt-1.5 w-2 h-2 bg-rose-500 rounded-full shrink-0"></div><span>{f}</span></li>))}</ul></div>
                   {result.nextSteps && result.nextSteps.length > 0 && (<div className="mt-6 pt-6 border-t border-gray-100"><h4 className="font-black text-slate-700 text-xs mb-4 flex items-center gap-2"><Sparkles size={16} className="text-rose-500" /> گام‌های تشخیصی همکار (Next Steps)</h4><div className="grid gap-3">{result.nextSteps.map((step, i) => (<div key={i} className="bg-slate-900 p-4 rounded-2xl text-rose-200 text-sm font-bold flex items-center gap-3 border border-slate-800"><ChevronRight size={18} className="text-rose-400" />{step}</div>))}</div></div>)}
                </div>
                <div className="p-6 bg-gray-50 text-[10px] text-gray-400 text-center font-bold tracking-widest uppercase">Expert-Link Hematology Module / Blood AI</div>
             </div>
          ) : (
              <div className="h-full bg-gray-50 rounded-[3rem] border-4 border-dashed border-gray-100 flex flex-col items-center justify-center text-gray-300 p-12 text-center">
                 <Droplet size={80} className="mb-6 opacity-10" />
                 <p className="text-xl font-black tracking-tight text-gray-400">منتظر دریافت نمونه یا مارکر...</p>
                 <p className="text-sm mt-4 font-bold max-w-xs leading-relaxed">آنالیز نهایی شامل بررسی مورفولوژی گلبول‌ها، تفسیر گزارش مغز استخوان و تحلیل هوشمند روند مارکرهای سرطانی خواهد بود.</p>
              </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Hematology;
