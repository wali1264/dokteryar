
import React, { useState } from 'react';
import { analyzeGastroenterology } from '../services/geminiService';
import { GastroenterologyAnalysis } from '../types';
import { Utensils, Microscope, Activity, AlertCircle, CheckCircle, Upload, MapPin, Flame, ArrowLeft, Loader2 } from 'lucide-react';

type Tab = 'meal' | 'endoscopy' | 'pain';

const Gastroenterology: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('meal');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GastroenterologyAnalysis | null>(null);

  // Meal/Endoscopy State (Files)
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // Pain Mapper State
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
      className={`p-4 rounded-xl text-sm font-bold transition-all border-2 ${
        painLocation === id 
          ? 'bg-red-600 text-white border-red-800 scale-105 shadow-lg' 
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
          result.severity === 'concern' ? 'bg-orange-500' : 'bg-green-600'
        }`}>
           <div>
             <h3 className="font-bold text-lg">نتیجه گوارش</h3>
             <p className="text-white/90 text-xs mt-1">{result.diagnosis}</p>
           </div>
           {result.severity === 'critical' ? <AlertCircle size={24} /> : <CheckCircle size={24} />}
        </div>
        <div className="p-5 space-y-4">
           {result.mizaj && (
             <div className="flex gap-4">
                <div className="flex-1 bg-amber-50 p-3 rounded-xl border border-amber-100 text-center">
                   <h4 className="font-bold text-amber-800 text-xs mb-1">طبع (مزاج)</h4>
                   <p className="text-lg font-bold text-gray-800">{result.mizaj}</p>
                </div>
             </div>
           )}
           {result.organ && (
              <div className="bg-red-50 p-3 rounded-xl border border-red-100 text-center">
                 <span className="text-xs text-red-500 font-bold uppercase">عضو درگیر</span>
                 <p className="text-xl font-bold text-red-800 mt-1">{result.organ}</p>
              </div>
           )}
           <div className="space-y-2">
              <h4 className="font-bold text-gray-700 text-sm">یافته‌های بالینی</h4>
              {result.findings.map((f, i) => <div key={i} className="text-sm bg-gray-50 p-2 rounded-lg text-gray-600 border-r-2 border-emerald-400">{f}</div>)}
           </div>
           <div className="bg-emerald-50 p-3 rounded-xl">
              <h4 className="font-bold text-emerald-800 text-sm mb-1">توصیه‌ها</h4>
              <ul className="space-y-1">
                {result.recommendations.map((r, i) => <li key={i} className="text-xs text-emerald-900">• {r}</li>)}
              </ul>
           </div>
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
                  <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600"><Utensils size={20} /></div>
                  <h2 className="text-lg font-bold text-gray-800">گوارش و کبد</h2>
               </div>
            </div>
            
            <div className="flex bg-gray-100 p-1 rounded-xl">
               <button onClick={() => { setActiveTab('meal'); setResult(null); setImage(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'meal' ? 'bg-white shadow text-emerald-600' : 'text-gray-500'}`}>غذا/مزاج</button>
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
                           {preview ? <img src={preview} className="w-full h-full object-cover" alt="Scan" /> : <div className="text-center"><div className="bg-white p-3 rounded-full mb-3 shadow-sm inline-block">{activeTab === 'meal' ? <Utensils size={24} className="text-emerald-400" /> : <Microscope size={24} className="text-emerald-400" />}</div><p className="text-gray-500 text-xs font-bold">{activeTab === 'meal' ? 'عکس غذا' : 'عکس آندوسکوپی'}</p></div>}
                        </div>
                        <p className="text-xs text-gray-400 text-center bg-gray-50 p-2 rounded-lg">
                           {activeTab === 'meal' ? 'تحلیل کالری و طبع غذا (سرد/گرم)' : 'تشخیص پولیپ و زخم معده'}
                        </p>
                     </div>
                  )}

                  {activeTab === 'pain' && (
                     <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-2 aspect-square max-w-sm mx-auto bg-gray-100 p-2 rounded-2xl">
                           <PainZone id="RUQ" label="کبد/صفرا" color="bg-orange-200" />
                           <PainZone id="Epigastric" label="معده" color="bg-red-200" />
                           <PainZone id="LUQ" label="طحال" color="bg-orange-200" />
                           
                           <PainZone id="RightFlank" label="کلیه راست" color="bg-yellow-200" />
                           <PainZone id="Periumbilical" label="ناف" color="bg-purple-200" />
                           <PainZone id="LeftFlank" label="کلیه چپ" color="bg-yellow-200" />
                           
                           <PainZone id="RLQ" label="آپاندیس" color="bg-blue-200" />
                           <PainZone id="Suprapubic" label="مثانه/رحم" color="bg-green-200" />
                           <PainZone id="LLQ" label="روده" color="bg-blue-200" />
                        </div>
                        <input type="text" className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold text-gray-700 shadow-sm border border-gray-100" placeholder="علائم همراه (تهوع، تب...)" value={painSymptoms} onChange={e => setPainSymptoms(e.target.value)} />
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
               {loading ? <Loader2 className="animate-spin" /> : result ? <ArrowLeft /> : <Activity />}
               {loading ? 'تحلیل درد...' : result ? 'بازگشت' : 'شروع آنالیز'}
            </button>
         </div>
      </div>

      {/* ======================= DESKTOP VIEW (Original) ======================= */}
      <div className="hidden lg:grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
        <div className="flex items-center gap-3 mb-6 col-span-2">
          <Utensils className="text-emerald-600 w-10 h-10" />
          <div>
            <h2 className="text-3xl font-bold text-gray-800">دپارتمان گوارش، کبد و تغذیه</h2>
            <p className="text-gray-500">Gastroenterology & Nutritional Intelligence</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-white rounded-2xl p-2 shadow-sm border border-gray-100 max-w-3xl col-span-2">
          <button onClick={() => { setActiveTab('meal'); setResult(null); setImage(null); setPreview(null); }} className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'meal' ? 'bg-emerald-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}><Utensils /> اسکنر غذا و مزاج</button>
          <button onClick={() => { setActiveTab('endoscopy'); setResult(null); setImage(null); setPreview(null); }} className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'endoscopy' ? 'bg-emerald-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}><Microscope /> آندوسکوپی هوشمند</button>
          <button onClick={() => { setActiveTab('pain'); setResult(null); }} className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'pain' ? 'bg-emerald-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}><MapPin /> نقشه درد شکمی</button>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 h-fit">
          {(activeTab === 'meal' || activeTab === 'endoscopy') && (
            <div className="space-y-6">
              <h3 className="font-bold text-gray-800">{activeTab === 'meal' ? 'آپلود عکس غذا' : 'آپلود تصویر آندوسکوپی/کولونوسکوپی'}</h3>
              <p className="text-sm text-gray-500">{activeTab === 'meal' ? 'برای محاسبه کالری و تشخیص طبع (سرد/گرم) غذا.' : 'برای تشخیص زخم، پولیپ، و التهابات گوارشی.'}</p>
              <div className="border-2 border-dashed border-emerald-200 bg-emerald-50/30 rounded-2xl h-80 flex flex-col items-center justify-center relative overflow-hidden group">
                 <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleImage} />
                 {preview ? <img src={preview} className="w-full h-full object-contain" alt="Scan" /> : <div className="text-center p-4">{activeTab === 'meal' ? <Utensils className="mx-auto text-emerald-400 w-12 h-12 mb-3" /> : <Microscope className="mx-auto text-emerald-400 w-12 h-12 mb-3" />}<p className="text-gray-600 font-medium">تصویر را اینجا رها کنید</p></div>}
              </div>
            </div>
          )}

          {activeTab === 'pain' && (
            <div className="space-y-6">
               <h3 className="font-bold text-gray-800 mb-4">نقشه تعاملی درد شکم (Abdominal Pain Mapper)</h3>
               <p className="text-sm text-gray-500 mb-4">محل دقیق درد بیمار را روی شبکه زیر انتخاب کنید.</p>
               <div className="grid grid-cols-3 gap-2 aspect-square max-w-sm mx-auto bg-gray-100 p-2 rounded-2xl">
                  <PainZone id="RUQ" label="ربع بالا راست (RUQ)" color="bg-orange-200" />
                  <PainZone id="Epigastric" label="اپی‌گاستر (Epigastric)" color="bg-red-200" />
                  <PainZone id="LUQ" label="ربع بالا چپ (LUQ)" color="bg-orange-200" />
                  <PainZone id="RightFlank" label="پهلو راست" color="bg-yellow-200" />
                  <PainZone id="Periumbilical" label="ناف (Periumbilical)" color="bg-purple-200" />
                  <PainZone id="LeftFlank" label="پهلو چپ" color="bg-yellow-200" />
                  <PainZone id="RLQ" label="ربع پایین راست (RLQ)" color="bg-blue-200" />
                  <PainZone id="Suprapubic" label="زیر شکم (Suprapubic)" color="bg-green-200" />
                  <PainZone id="LLQ" label="ربع پایین چپ (LLQ)" color="bg-blue-200" />
               </div>
               <div className="mt-4"><label className="text-sm font-bold text-gray-700 block mb-2">علائم همراه</label><input type="text" className="w-full p-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" placeholder="مثال: تهوع، تب، نفخ..." value={painSymptoms} onChange={e => setPainSymptoms(e.target.value)} /></div>
            </div>
          )}

          <button onClick={handleAnalyze} disabled={loading || (activeTab !== 'pain' && !image) || (activeTab === 'pain' && (!painLocation || !painSymptoms))} className="w-full mt-6 bg-emerald-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 disabled:opacity-50">{loading ? 'در حال تحلیل گوارشی...' : 'شروع آنالیز'}</button>
        </div>

        <div className="space-y-6">
           {result ? (
             <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-200 animate-fade-in">
                <div className={`p-6 text-white flex justify-between items-center ${result.severity === 'critical' ? 'bg-red-600' : result.severity === 'concern' ? 'bg-orange-500' : 'bg-green-600'}`}><div><h3 className="text-xl font-bold">نتیجه آنالیز</h3><p className="text-white/80 text-sm mt-1">{result.diagnosis}</p></div>{result.severity === 'critical' ? <AlertCircle size={32} /> : <CheckCircle size={32} />}</div>
                <div className="p-6 space-y-6">
                   {result.mizaj && <div className="flex gap-4"><div className="flex-1 bg-amber-50 p-4 rounded-xl border border-amber-100"><h4 className="font-bold text-amber-800 mb-1 flex items-center gap-2"><Flame size={18} />طبع غذا (مزاج)</h4><p className="text-lg font-bold text-gray-800">{result.mizaj}</p></div></div>}
                   {result.nutrients && result.nutrients.length > 0 && <div className="bg-gray-50 p-4 rounded-xl"><h4 className="font-bold text-gray-700 mb-2">ارزش غذایی</h4><div className="flex flex-wrap gap-2">{result.nutrients.map((n, i) => (<span key={i} className="bg-white px-3 py-1 rounded-full text-xs text-gray-600 border border-gray-200 shadow-sm">{n}</span>))}</div></div>}
                   {result.organ && <div className="bg-red-50 p-4 rounded-xl border border-red-100 text-center"><span className="text-xs text-red-500 font-bold uppercase">عضو درگیر احتمالی</span><p className="text-2xl font-bold text-red-800">{result.organ}</p></div>}
                   <div><h4 className="font-bold text-gray-800 mb-3 border-b pb-2">یافته‌های بالینی</h4><ul className="space-y-2">{result.findings.map((f, i) => (<li key={i} className="flex items-start gap-2 text-gray-700 text-sm"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5 flex-shrink-0"></span>{f}</li>))}</ul></div>
                   <div className="bg-emerald-50 p-4 rounded-xl"><h4 className="font-bold text-emerald-800 mb-2">توصیه‌ها</h4><ul className="space-y-1">{result.recommendations.map((r, i) => (<li key={i} className="text-sm text-emerald-900">• {r}</li>))}</ul></div>
                </div>
             </div>
           ) : (
             <div className="h-full bg-gray-100 rounded-3xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 p-8 text-center opacity-70"><Utensils size={48} className="mb-4" /><p>منتظر داده‌ها برای آنالیز گوارش...</p></div>
           )}
        </div>
      </div>
    </div>
  );
};

export default Gastroenterology;
