
import React, { useState } from 'react';
import { analyzeEmergency } from '../services/geminiService';
import { EmergencyAnalysis } from '../types';
import { Ambulance, Flame, Zap, Activity, AlertTriangle, CheckCircle, Upload, Skull, ArrowLeft, Loader2 } from 'lucide-react';

type Tab = 'wound' | 'toxicology' | 'triage';

const Emergency: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('wound');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EmergencyAnalysis | null>(null);

  // Image State (Wound/Toxicology)
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // Triage Data
  const [triageData, setTriageData] = useState({
    gcs: '15',
    hr: '',
    bp: '',
    rr: '',
    spo2: '',
    symptoms: ''
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
    if (activeTab === 'triage') {
        if (!triageData.symptoms) return;
        setLoading(true);
        try {
            const res = await analyzeEmergency(triageData, 'triage');
            setResult(res);
        } catch (e) {
            console.error(e);
            alert('خطا در محاسبه تریاژ');
        } finally {
            setLoading(false);
        }
    } else {
        if (!image) return;
        setLoading(true);
        try {
            const res = await analyzeEmergency(image, activeTab);
            setResult(res);
        } catch (e) {
            console.error(e);
            alert('خطا در آنالیز تصویر');
        } finally {
            setLoading(false);
        }
    }
  };

  const MobileResultCard = () => {
    if (!result) return null;
    return (
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 animate-slide-up mb-24">
        <div className={`p-5 text-white flex justify-between items-center ${
          result.severity === 'critical' ? 'bg-red-600 animate-pulse' : 
          result.severity === 'urgent' ? 'bg-orange-500' : 'bg-green-600'
        }`}>
           <div>
             <h3 className="font-bold text-lg">نتیجه ارزیابی</h3>
             <p className="text-white/90 text-xs mt-1 opacity-90">{result.diagnosis}</p>
           </div>
           <AlertTriangle size={24} />
        </div>
        <div className="p-5 space-y-4">
           {result.triageLevel && (
              <div className="text-center bg-gray-50 text-gray-800 p-4 rounded-2xl border border-gray-100">
                 <h4 className="text-xs text-gray-400 uppercase tracking-widest font-bold">سطح تریاژ</h4>
                 <p className="text-3xl font-black mt-1 text-red-600">{result.triageLevel}</p>
              </div>
           )}
           {result.antidote && (
              <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                 <h4 className="font-bold text-green-800 text-sm mb-1">پادزهر / اقدام فوری</h4>
                 <p className="text-green-900 font-bold">{result.antidote}</p>
              </div>
           )}
           <div className="space-y-2">
              <h4 className="font-bold text-gray-700 text-sm">اقدامات نجات‌بخش</h4>
              {result.actions.map((a, i) => (
                <div key={i} className="text-sm bg-gray-50 p-3 rounded-xl border-r-4 border-red-500 text-gray-700">
                   {a}
                </div>
              ))}
           </div>
        </div>
      </div>
    );
  };

  return (
    <div className="animate-fade-in pb-20 h-full">
      
      {/* ======================= MOBILE VIEW ======================= */}
      <div className="lg:hidden flex flex-col h-full">
        {/* Mobile Header */}
        <div className="bg-white p-4 sticky top-0 z-30 shadow-sm border-b border-gray-100">
           <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                 <div className="bg-red-100 p-2 rounded-xl text-red-600"><Ambulance size={20} /></div>
                 <h2 className="text-lg font-bold text-gray-800">اورژانس و تروما</h2>
              </div>
           </div>
           
           {/* Mobile Tabs */}
           <div className="flex bg-gray-100 p-1 rounded-xl">
              <button onClick={() => { setActiveTab('wound'); setResult(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'wound' ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}>زخم/سوختگی</button>
              <button onClick={() => { setActiveTab('toxicology'); setResult(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'toxicology' ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}>مسمومیت</button>
              <button onClick={() => { setActiveTab('triage'); setResult(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'triage' ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}>تریاژ</button>
           </div>
        </div>

        {/* Mobile Content */}
        <div className="flex-1 overflow-y-auto p-4 pb-32">
           {!result ? (
             <div className="space-y-6 animate-slide-up">
                {(activeTab === 'wound' || activeTab === 'toxicology') && (
                   <div className="space-y-4">
                      <div className="border-2 border-dashed border-red-200 bg-red-50/50 rounded-3xl h-64 flex flex-col items-center justify-center relative overflow-hidden group">
                         <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleImage} />
                         {preview ? (
                           <img src={preview} className="w-full h-full object-cover" alt="Scan" />
                         ) : (
                           <div className="text-center p-4">
                             <div className="w-16 h-16 bg-white text-red-400 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                               {activeTab === 'wound' ? <Flame size={28} /> : <Skull size={28} />}
                             </div>
                             <p className="text-gray-500 font-bold text-sm">تصویر را اینجا لمس کنید</p>
                           </div>
                         )}
                      </div>
                      <p className="text-xs text-gray-400 text-center bg-gray-50 p-2 rounded-lg">
                        {activeTab === 'wound' ? 'تشخیص درصد سوختگی و عمق زخم' : 'شناسایی قرص یا ماده سمی'}
                      </p>
                   </div>
                )}

                {activeTab === 'triage' && (
                   <div className="space-y-4">
                      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
                         <div>
                            <label className="text-xs font-bold text-gray-500 mb-1 block">هوشیاری (GCS)</label>
                            <select className="w-full p-3 bg-gray-50 rounded-xl outline-none text-sm font-bold" value={triageData.gcs} onChange={e => setTriageData({...triageData, gcs: e.target.value})}>
                               {[15,14,13,12,11,10,9,8,7,6,5,4,3].map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                         </div>
                         <div className="grid grid-cols-2 gap-3">
                            <input type="number" placeholder="HR" className="p-3 bg-gray-50 rounded-xl text-sm font-bold text-center" value={triageData.hr} onChange={e => setTriageData({...triageData, hr: e.target.value})} />
                            <input type="text" placeholder="BP" className="p-3 bg-gray-50 rounded-xl text-sm font-bold text-center" value={triageData.bp} onChange={e => setTriageData({...triageData, bp: e.target.value})} />
                            <input type="number" placeholder="RR" className="p-3 bg-gray-50 rounded-xl text-sm font-bold text-center" value={triageData.rr} onChange={e => setTriageData({...triageData, rr: e.target.value})} />
                            <input type="number" placeholder="SpO2" className="p-3 bg-gray-50 rounded-xl text-sm font-bold text-center" value={triageData.spo2} onChange={e => setTriageData({...triageData, spo2: e.target.value})} />
                         </div>
                         <textarea className="w-full p-3 bg-gray-50 rounded-xl text-sm h-24 resize-none" placeholder="علائم (درد قفسه سینه، تروما...)" value={triageData.symptoms} onChange={e => setTriageData({...triageData, symptoms: e.target.value})} />
                      </div>
                   </div>
                )}
             </div>
           ) : (
             <MobileResultCard />
           )}
        </div>

        {/* Mobile Bottom Action - Floating above Nav */}
        <div className="fixed bottom-[5.5rem] left-0 right-0 px-4 z-40">
           <button 
             onClick={result ? () => setResult(null) : handleAnalyze}
             disabled={loading || (!result && activeTab !== 'triage' && !image) || (!result && activeTab === 'triage' && !triageData.symptoms)}
             className={`w-full py-4 rounded-2xl font-bold shadow-2xl flex items-center justify-center gap-2 transition-all ${result ? 'bg-gray-100 text-gray-600' : 'bg-red-600 text-white shadow-red-200'}`}
           >
             {loading ? <Loader2 className="animate-spin" /> : result ? <ArrowLeft /> : <Zap />}
             {loading ? 'در حال پردازش...' : result ? 'بازگشت / تست جدید' : 'شروع عملیات اورژانسی'}
           </button>
        </div>
      </div>

      {/* ======================= DESKTOP VIEW (Original) ======================= */}
      <div className="hidden lg:grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
        <div className="flex items-center gap-3 mb-6 col-span-2">
          <Ambulance className="text-red-600 w-10 h-10" />
          <div>
            <h2 className="text-3xl font-bold text-gray-800">دپارتمان اورژانس و تروماتولوژی</h2>
            <p className="text-gray-500">Department of Emergency & Trauma</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-white rounded-2xl p-2 shadow-sm border border-gray-100 max-w-3xl col-span-2">
          <button onClick={() => { setActiveTab('wound'); setResult(null); setImage(null); setPreview(null); }} className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'wound' ? 'bg-red-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}><Flame /> زخم و سوختگی</button>
          <button onClick={() => { setActiveTab('toxicology'); setResult(null); setImage(null); setPreview(null); }} className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'toxicology' ? 'bg-red-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}><Skull /> سم‌شناسی</button>
          <button onClick={() => { setActiveTab('triage'); setResult(null); }} className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'triage' ? 'bg-red-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}><Zap /> تریاژ هوشمند</button>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 h-fit">
          {(activeTab === 'wound' || activeTab === 'toxicology') && (
            <div className="space-y-6">
              <h3 className="font-bold text-gray-800">{activeTab === 'wound' ? 'آپلود تصویر زخم یا سوختگی' : 'آپلود تصویر دارو/سم'}</h3>
              <p className="text-sm text-gray-500">{activeTab === 'wound' ? 'تشخیص نوع زخم، درصد و درجه سوختگی و عفونت.' : 'شناسایی قرص‌ها و مواد سمی ناشناس برای تعیین پادزهر.'}</p>
              <div className="border-2 border-dashed border-red-200 bg-red-50/30 rounded-2xl h-80 flex flex-col items-center justify-center relative overflow-hidden group">
                 <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleImage} />
                 {preview ? <img src={preview} className="w-full h-full object-contain" alt="Scan" /> : <div className="text-center p-4">{activeTab === 'wound' ? <Flame className="mx-auto text-red-400 w-12 h-12 mb-3" /> : <Skull className="mx-auto text-red-400 w-12 h-12 mb-3" />}<p className="text-gray-600 font-medium">تصویر را اینجا رها کنید</p></div>}
              </div>
            </div>
          )}
          {activeTab === 'triage' && (
            <div className="space-y-4">
               <h3 className="font-bold text-gray-800 mb-4">محاسبه‌گر تریاژ (ESI Triage)</h3>
               <div className="space-y-2"><label className="text-sm font-medium text-gray-700">سطح هوشیاری (GCS)</label><select className="w-full p-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-red-500" value={triageData.gcs} onChange={e => setTriageData({...triageData, gcs: e.target.value})}>{[15,14,13,12,11,10,9,8,7,6,5,4,3].map(n => <option key={n} value={n}>{n}</option>)}</select></div>
               <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><label className="text-sm font-medium text-gray-700">ضربان قلب (HR)</label><input type="number" className="w-full p-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-red-500" value={triageData.hr} onChange={e => setTriageData({...triageData, hr: e.target.value})} /></div><div className="space-y-2"><label className="text-sm font-medium text-gray-700">فشار خون (BP)</label><input type="text" className="w-full p-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-red-500" value={triageData.bp} onChange={e => setTriageData({...triageData, bp: e.target.value})} /></div></div>
               <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><label className="text-sm font-medium text-gray-700">تعداد تنفس (RR)</label><input type="number" className="w-full p-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-red-500" value={triageData.rr} onChange={e => setTriageData({...triageData, rr: e.target.value})} /></div><div className="space-y-2"><label className="text-sm font-medium text-gray-700">اکسیژن خون (SpO2)</label><input type="number" className="w-full p-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-red-500" value={triageData.spo2} onChange={e => setTriageData({...triageData, spo2: e.target.value})} /></div></div>
               <div className="space-y-2"><label className="text-sm font-medium text-gray-700">علائم و شرح حال کوتاه</label><textarea className="w-full p-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-red-500 h-24 resize-none" placeholder="مثال: درد شدید قفسه سینه، عرق سرد..." value={triageData.symptoms} onChange={e => setTriageData({...triageData, symptoms: e.target.value})} /></div>
            </div>
          )}
          <button onClick={handleAnalyze} disabled={loading || (activeTab !== 'triage' && !image)} className="w-full mt-6 bg-red-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-red-200 hover:bg-red-700 disabled:opacity-50">{loading ? 'در حال آنالیز فوری...' : 'شروع عملیات اورژانسی'}</button>
        </div>

        <div className="space-y-6">
           {result ? (
             <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-200 animate-fade-in">
                <div className={`p-6 text-white flex justify-between items-center ${result.severity === 'critical' ? 'bg-red-600 animate-pulse' : result.severity === 'urgent' ? 'bg-orange-500' : 'bg-green-600'}`}><div><h3 className="text-xl font-bold">نتیجه ارزیابی اورژانس</h3><p className="text-white/80 text-sm mt-1">{result.diagnosis}</p></div><AlertTriangle size={32} /></div>
                <div className="p-6 space-y-6">
                   {result.triageLevel && <div className="text-center bg-gray-900 text-white p-6 rounded-2xl shadow-lg"><h4 className="text-gray-400 text-sm uppercase tracking-widest font-bold">سطح تریاژ</h4><p className={`text-4xl font-black mt-2 ${result.triageLevel.includes('1') || result.triageLevel.includes('Red') ? 'text-red-500' : result.triageLevel.includes('2') || result.triageLevel.includes('Orange') ? 'text-orange-500' : result.triageLevel.includes('3') || result.triageLevel.includes('Yellow') ? 'text-yellow-400' : 'text-green-400'}`}>{result.triageLevel}</p></div>}
                   {result.antidote && <div className="bg-green-50 p-4 rounded-xl border border-green-100 flex items-start gap-3"><CheckCircle className="text-green-600 shrink-0" /><div><h4 className="font-bold text-green-800">پادزهر / اقدام فوری</h4><p className="text-green-900 font-bold text-lg">{result.antidote}</p></div></div>}
                   <div><h4 className="font-bold text-gray-800 mb-3 border-b pb-2">یافته‌های کلیدی</h4><ul className="space-y-2">{result.findings.map((f, i) => (<li key={i} className="flex items-start gap-2 text-gray-700 text-sm"><span className="w-1.5 h-1.5 bg-red-500 rounded-full mt-1.5 flex-shrink-0"></span>{f}</li>))}</ul></div>
                   <div className="bg-red-50 p-4 rounded-xl"><h4 className="font-bold text-red-800 mb-2">اقدامات نجات‌بخش (Action Plan)</h4><ul className="space-y-2">{result.actions.map((a, i) => (<li key={i} className="text-sm font-bold text-red-900 bg-white p-2 rounded-lg border border-red-100 shadow-sm">• {a}</li>))}</ul></div>
                </div>
             </div>
           ) : (
             <div className="h-full bg-gray-100 rounded-3xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 p-8 text-center opacity-70"><Zap size={48} className="mb-4" /><p>منتظر داده‌ها برای عملیات نجات...</p></div>
           )}
        </div>
      </div>
    </div>
  );
};

export default Emergency;
