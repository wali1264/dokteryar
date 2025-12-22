
import React, { useState } from 'react';
import { analyzeGynecology } from '../services/geminiService';
import { GynecologyAnalysis } from '../types';
import { Flower, Image, Activity, AlertCircle, CheckCircle, Upload, Search, ArrowLeft, Loader2, Sparkles, ChevronRight, Hash } from 'lucide-react';

type Tab = 'ultrasound' | 'mammography' | 'fertility';

const Gynecology: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('ultrasound');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GynecologyAnalysis | null>(null);

  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const [fertilityData, setFertilityData] = useState({ age: '', regularity: 'regular', symptoms: '', hormones: '' });

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
      const res = activeTab === 'fertility' ? await analyzeGynecology(fertilityData, 'fertility') : await analyzeGynecology(image!, activeTab);
      setResult(res);
    } catch (e) {
      console.error(e);
      alert('خطا در آنالیز');
    } finally {
      setLoading(false);
    }
  };

  const MobileResultCard = () => {
    if (!result) return null;
    return (
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 animate-slide-up mb-24">
        <div className={`p-5 text-white flex justify-between items-center ${
          result.severity === 'critical' ? 'bg-red-600' : result.severity === 'concern' ? 'bg-orange-500' : 'bg-purple-600'
        }`}>
           <div><h3 className="font-bold text-lg">گزارش کلینیک زنان</h3><p className="text-white/90 text-[10px] mt-0.5 tracking-widest font-bold uppercase">{result.diagnosis}</p></div>
           {result.severity === 'critical' ? <AlertCircle size={24} /> : <Flower size={24} />}
        </div>
        <div className="p-5 space-y-4">
           {result.confidence && (
              <div className="space-y-1">
                 <div className="flex justify-between text-[10px] font-bold text-gray-400"><span>اطمینان تشخیص</span><span>{result.confidence}</span></div>
                 <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-purple-500 transition-all duration-1000" style={{ width: result.confidence }}></div></div>
              </div>
           )}
           <div className="space-y-2">
              <h4 className="font-bold text-gray-700 text-xs uppercase">یافته‌های تخصصی</h4>
              {result.findings.map((f, i) => <div key={i} className="text-xs bg-gray-50 p-2.5 rounded-lg text-gray-600 border-r-2 border-purple-400 font-bold">{f}</div>)}
           </div>
           {result.measurements && result.measurements.length > 0 && (
             <div className="bg-purple-50 p-4 rounded-xl border border-purple-100"><h4 className="font-bold text-purple-800 text-xs mb-2 uppercase tracking-widest">Biometry / Lab</h4><div className="grid grid-cols-2 gap-2">{result.measurements.map((m, i) => (<div key={i} className="bg-white p-2 rounded-lg text-[10px] text-gray-700 shadow-sm text-center font-black">{m}</div>))}</div></div>
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
               <div className="flex items-center gap-2"><div className="bg-purple-100 p-2 rounded-xl text-purple-600"><Flower size={20} /></div><h2 className="text-lg font-bold text-gray-800 tracking-tight">زنان و زایمان</h2></div>
            </div>
            <div className="flex bg-gray-100 p-1 rounded-xl">
               <button onClick={() => { setActiveTab('ultrasound'); setResult(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'ultrasound' ? 'bg-white shadow text-purple-600' : 'text-gray-500'}`}>سونو</button>
               <button onClick={() => { setActiveTab('mammography'); setResult(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'mammography' ? 'bg-white shadow text-purple-600' : 'text-gray-500'}`}>مامو</button>
               <button onClick={() => { setActiveTab('fertility'); setResult(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'fertility' ? 'bg-white shadow text-purple-600' : 'text-gray-500'}`}>باروری</button>
            </div>
         </div>
         <div className="flex-1 overflow-y-auto p-4 pb-32">
            {!result ? (
               <div className="space-y-6 animate-slide-up">
                  {(activeTab === 'ultrasound' || activeTab === 'mammography') ? (
                     <div className="border-2 border-dashed border-purple-200 bg-purple-50/50 rounded-3xl h-64 flex flex-col items-center justify-center relative overflow-hidden group">
                        <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleImage} />
                        {preview ? <img src={preview} className="w-full h-full object-contain" alt="Scan" /> : <div className="text-center"><Upload className="mx-auto text-purple-400 mb-2" /><p className="text-gray-500 text-xs font-bold">آپلود تصویر اسکن</p></div>}
                     </div>
                  ) : (
                     <div className="bg-white p-4 rounded-2xl border border-gray-100 space-y-4 shadow-sm"><input type="number" placeholder="سن" className="w-full p-3 bg-gray-50 rounded-xl font-bold text-center" value={fertilityData.age} onChange={e => setFertilityData({...fertilityData, age: e.target.value})} /><input type="text" placeholder="هورمون‌ها" className="w-full p-3 bg-gray-50 rounded-xl font-bold text-center" value={fertilityData.hormones} onChange={e => setFertilityData({...fertilityData, hormones: e.target.value})} /></div>
                  )}
               </div>
            ) : <MobileResultCard />}
         </div>
         <div className="fixed bottom-[5.5rem] left-0 right-0 px-4 z-40">
            <button onClick={result ? () => setResult(null) : handleAnalyze} disabled={loading} className={`w-full py-4 rounded-2xl font-bold shadow-2xl flex items-center justify-center gap-2 transition-all ${result ? 'bg-gray-100 text-gray-600' : 'bg-purple-600 text-white shadow-purple-200'}`}>{loading ? <Loader2 className="animate-spin" /> : result ? <ArrowLeft /> : <Activity />}{loading ? 'در حال آنالیز لایه‌ها...' : result ? 'تست جدید' : 'شروع آنالیز تخصصی'}</button>
         </div>
      </div>

      <div className="hidden lg:grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
             <h2 className="text-2xl font-black text-gray-800 mb-8 flex items-center gap-3"><Flower className="text-purple-600" size={32} /><span>کنسول فوق‌تخصصی زنان و مامایی (Expert-Link)</span></h2>
            <div className="flex bg-gray-100 p-1.5 rounded-2xl mb-8">
              <button onClick={() => { setActiveTab('ultrasound'); setResult(null); setImage(null); }} className={`flex-1 py-4 px-6 rounded-xl font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'ultrasound' ? 'bg-purple-600 text-white shadow-xl' : 'text-gray-500 hover:bg-gray-50'}`}><Activity /> سونوگرافی جنین</button>
              <button onClick={() => { setActiveTab('mammography'); setResult(null); setImage(null); }} className={`flex-1 py-4 px-6 rounded-xl font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'mammography' ? 'bg-purple-600 text-white shadow-xl' : 'text-gray-500 hover:bg-gray-50'}`}><Search /> ماموگرافی</button>
              <button onClick={() => { setActiveTab('fertility'); setResult(null); }} className={`flex-1 py-4 px-6 rounded-xl font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'fertility' ? 'bg-purple-600 text-white shadow-xl' : 'text-gray-500 hover:bg-gray-50'}`}><Flower /> هوش باروری</button>
            </div>
            {activeTab !== 'fertility' ? (
               <div className="relative group"><div className={`border-2 border-dashed rounded-[3rem] h-[500px] flex items-center justify-center relative overflow-hidden transition-all duration-500 ${loading ? 'border-purple-500 bg-purple-50/10' : 'border-gray-200 bg-gray-900'}`}><input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-30" onChange={handleImage} disabled={loading} />{preview ? <img src={preview} alt="OB Scan" className="w-full h-full object-contain z-10" /> : <div className="text-center p-4 z-10"><Upload size={48} className="mx-auto text-purple-400 mb-6 group-hover:scale-110 transition-transform" /><p className="font-black text-gray-300 text-xl tracking-tight">آپلود تصویر سونوگرافی یا ماموگرافی</p></div>}</div></div>
            ) : (
               <div className="bg-gray-50 p-8 rounded-[3rem] space-y-6"><div className="grid grid-cols-2 gap-4"><div><label className="text-xs font-bold text-gray-500 block mb-2">سن</label><input type="number" className="w-full p-4 bg-white border border-gray-100 rounded-2xl font-black text-center" value={fertilityData.age} onChange={e => setFertilityData({...fertilityData, age: e.target.value})} /></div><div><label className="text-xs font-bold text-gray-500 block mb-2">قاعدگی</label><select className="w-full p-4 bg-white border border-gray-100 rounded-2xl font-bold" value={fertilityData.regularity} onChange={e => setFertilityData({...fertilityData, regularity: e.target.value})}><option value="regular">منظم</option><option value="irregular">نامنظم</option><option value="absent">آمنوره</option></select></div></div><div><label className="text-xs font-bold text-gray-500 block mb-2">تفسیر هورمونی</label><textarea className="w-full p-4 bg-white border border-gray-100 rounded-2xl h-32 resize-none font-bold text-gray-700" placeholder="LH, FSH, AMH levels..." value={fertilityData.hormones} onChange={e => setFertilityData({...fertilityData, hormones: e.target.value})} /></div></div>
            )}
            <div className="mt-8"><button onClick={handleAnalyze} disabled={loading || (activeTab !== 'fertility' && !image)} className="w-full bg-purple-600 text-white font-black py-5 rounded-2xl shadow-2xl shadow-purple-200 hover:bg-purple-700 transition-all flex items-center justify-center gap-3 text-lg">{loading ? <><Activity className="animate-spin" /><span>در حال واکاوی الگوهای مورفولوژیک...</span></> : <><Flower /><span>تولید ریپورت فوق‌تخصصی زنان</span></>}</button></div>
          </div>
        </div>
        <div className="lg:col-span-5 h-full">
          {result ? (
             <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100 h-full flex flex-col animate-fade-in"><div className={`p-8 text-white ${result.severity === 'critical' ? 'bg-red-600' : result.severity === 'concern' ? 'bg-orange-500' : 'bg-purple-600'}`}><div className="flex justify-between items-start"><div><h3 className="text-2xl font-black">گزارش مشاور زنان</h3><p className="text-white/70 text-xs mt-1 uppercase tracking-widest font-bold">OB-GYN CLINIC REPORT / {activeTab}</p></div><CheckCircle size={40} /></div>{result.confidence && <div className="mt-8 space-y-2"><div className="flex justify-between text-[10px] font-black uppercase opacity-60"><span>Machine Diagnostic Confidence</span><span>{result.confidence}</span></div><div className="h-1.5 bg-white/20 rounded-full overflow-hidden"><div className="h-full bg-white transition-all duration-1000" style={{ width: result.confidence }}></div></div></div>}</div><div className="p-8 space-y-8 flex-1 overflow-y-auto custom-scrollbar"><div><h4 className="font-black text-gray-400 text-[10px] uppercase tracking-widest mb-3">Diagnostic Impression</h4><p className="text-gray-900 text-xl font-black leading-relaxed bg-gray-50 p-6 rounded-3xl border border-gray-100">{result.diagnosis}</p></div>{result.measurements && result.measurements.length > 0 && (<div className="bg-purple-50 p-6 rounded-3xl border border-purple-100"><h4 className="font-black text-purple-800 text-xs mb-4 flex items-center gap-2 uppercase tracking-tighter"><Activity size={18} /> پارامترهای بیومتری</h4><div className="grid grid-cols-2 gap-3">{result.measurements.map((m, i) => (<div key={i} className="bg-white p-3 rounded-2xl border border-purple-100 text-center font-black text-purple-900 text-sm shadow-sm">{m}</div>))}</div></div>)}<div><h4 className="font-black text-gray-400 text-[10px] uppercase tracking-widest mb-4">Detailed Technical Findings</h4><ul className="space-y-4">{result.findings.map((f, i) => (<li key={i} className="flex items-start gap-4 text-sm text-gray-700 font-bold"><div className="mt-1.5 w-2 h-2 bg-purple-500 rounded-full shrink-0"></div><span>{f}</span></li>))}</ul></div><div className="bg-gray-50 p-6 rounded-3xl"><h4 className="font-black text-gray-800 text-xs mb-4 uppercase">توصیه‌های بالینی</h4><ul className="space-y-2">{result.recommendations.map((r, i) => (<li key={i} className="text-sm font-bold text-gray-600 leading-relaxed">• {r}</li>))}</ul></div></div><div className="p-6 bg-gray-50 text-[10px] text-gray-400 text-center font-bold tracking-widest uppercase">Expert-Link OB-GYN Module / FemTech AI</div></div>
          ) : <div className="h-full bg-gray-50 rounded-[3rem] border-4 border-dashed border-gray-100 flex flex-col items-center justify-center text-gray-300 p-12 text-center"><Flower size={80} className="mb-6 opacity-10" /><p className="text-xl font-black tracking-tight text-gray-400">منتظر دریافت تصویر برای آنالیز...</p></div>}
        </div>
      </div>
    </div>
  );
};

export default Gynecology;
