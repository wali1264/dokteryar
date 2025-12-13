
import React, { useState } from 'react';
import { analyzeCulture } from '../services/geminiService';
import { LabAnalysis } from '../types';
import { Upload, Microscope, CheckCircle, AlertTriangle, Activity, ArrowLeft, Loader2, FlaskConical, Dna, FileText } from 'lucide-react';

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
          result.severity === 'medium' ? 'bg-orange-500' : 'bg-green-600'
        }`}>
           <div>
             <h3 className="font-bold text-lg">نتیجه میکروبیولوژی</h3>
             <p className="text-white/90 text-xs mt-1">{result.suspectedOrganism}</p>
           </div>
           {result.severity === 'high' ? <AlertTriangle size={24} /> : <CheckCircle size={24} />}
        </div>
        <div className="p-5 space-y-4">
           <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100">
              <h4 className="font-bold text-indigo-800 text-xs mb-2 flex items-center gap-1"><Microscope size={12}/> مشاهدات میکروسکوپی</h4>
              <p className="text-xs text-indigo-900 leading-relaxed">{result.visualFindings}</p>
           </div>
           <div className="space-y-2">
              <h4 className="font-bold text-gray-700 text-sm">پیشنهادات آزمایشگاه</h4>
              {result.recommendations.map((rec, i) => (
                <div key={i} className="text-sm bg-gray-50 p-2 rounded-lg text-gray-600 border-r-2 border-indigo-400">{rec}</div>
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
         <div className="bg-white p-4 sticky top-0 z-30 shadow-sm border-b border-gray-100">
            <div className="flex justify-between items-center mb-4">
               <div className="flex items-center gap-2">
                  <div className="bg-indigo-100 p-2 rounded-xl text-indigo-600"><FlaskConical size={20} /></div>
                  <h2 className="text-lg font-bold text-gray-800">آزمایشگاه</h2>
               </div>
            </div>
            
            {/* Horizontal Scrollable Tabs for Lab Types */}
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
                        className="w-full p-3 bg-white border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm h-24 resize-none shadow-sm placeholder-gray-300" 
                        placeholder="یادداشت‌های تکنسین (بو، رنگ، قوام...)" 
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
               {loading ? 'کشت هوشمند...' : result ? 'بازگشت' : 'آنالیز نمونه'}
            </button>
         </div>
      </div>

      {/* ======================= DESKTOP VIEW (Original) ======================= */}
      <div className="hidden lg:grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
        {/* Input Section */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col h-fit">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <Microscope className="text-indigo-600" />
            <span>میز کار میکروبیولوژی</span>
          </h2>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">نوع محیط کشت / آزمایش</label>
              <select 
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-indigo-500"
                value={labType}
                onChange={(e) => setLabType(e.target.value)}
              >
                <option value="Blood Agar">Blood Agar (کشت خون/عمومی)</option>
                <option value="MacConkey Agar">MacConkey Agar (ادرار/گوارشی)</option>
                <option value="Chocolate Agar">Chocolate Agar (خلط/هموفیلوس)</option>
                <option value="Antibiogram (Disk Diffusion)">Antibiogram (تست حساسیت آنتی‌بیوتیک)</option>
                <option value="Microscope Slide">اسلاید میکروسکوپی (گرم استین)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">یادداشت‌های تکنسین</label>
              <textarea 
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-indigo-500 h-24 resize-none"
                placeholder="مشاهدات اولیه، بوی خاص، منبع نمونه..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div 
              className="border-2 border-dashed border-indigo-200 bg-indigo-50/50 rounded-2xl h-64 flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer"
            >
              <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleImage} />
              {preview ? (
                <img src={preview} alt="Culture Plate" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center p-4">
                   <div className="w-16 h-16 bg-white text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm group-hover:scale-110 transition-transform">
                     <Upload size={28} />
                   </div>
                   <p className="font-bold text-indigo-900">آپلود عکس پلیت</p>
                   <p className="text-xs text-indigo-600 mt-1">عکس با کیفیت از محیط کشت</p>
                </div>
              )}
            </div>

            <button
              onClick={handleAnalyze}
              disabled={!image || loading}
              className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-200 disabled:opacity-50 hover:bg-indigo-700 transition-colors"
            >
              {loading ? 'در حال پردازش هوشمند...' : 'آنالیز نمونه'}
            </button>
          </div>
        </div>

        {/* Result Section */}
        <div className="space-y-6">
          {result ? (
            <div className="bg-white rounded-3xl shadow-xl overflow-hidden animate-fade-in border border-gray-200">
               <div className={`p-6 text-white flex justify-between items-center ${result.severity === 'high' ? 'bg-red-600' : result.severity === 'medium' ? 'bg-orange-500' : 'bg-green-600'}`}>
                  <h3 className="text-xl font-bold">نتیجه آنالیز هوشمند</h3>
                  <span className="bg-white/20 px-3 py-1 rounded-full text-sm backdrop-blur-sm">
                    {result.severity === 'high' ? 'خطرناک' : result.severity === 'medium' ? 'نیازمند توجه' : 'عادی'}
                  </span>
               </div>
               
               <div className="p-8 space-y-8">
                  <div>
                     <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">تشخیص ارگانیسم</label>
                     <p className="text-3xl font-bold text-gray-800 mt-1">{result.suspectedOrganism}</p>
                  </div>

                  <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                     <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                       <Microscope size={20} />
                       مشاهدات تصویری
                     </h4>
                     <p className="text-gray-600 leading-relaxed">{result.visualFindings}</p>
                  </div>

                  <div>
                     <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                       <CheckCircle size={20} className="text-green-600" />
                       پیشنهادات آزمایشگاه
                     </h4>
                     <div className="grid gap-3">
                       {result.recommendations.map((rec, i) => (
                         <div key={i} className="flex items-center gap-3 p-3 bg-indigo-50 text-indigo-900 rounded-lg">
                           <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                           {rec}
                         </div>
                       ))}
                     </div>
                  </div>
               </div>
            </div>
          ) : (
            <div className="h-full bg-gray-100 border-2 border-dashed border-gray-300 rounded-3xl flex flex-col items-center justify-center text-gray-400 p-10 text-center opacity-70">
              <Microscope size={64} className="mb-4" />
              <p>منتظر دریافت تصویر نمونه برای آنالیز میکروبیولوژی...</p>
              <p className="text-sm mt-2">تشخیص کلونی‌ها، همولیز و پیشنهاد آنتی‌بیوتیک</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Laboratory;
