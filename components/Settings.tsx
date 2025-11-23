
import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { Save, User, Phone, MapPin, Stethoscope, FileBadge, Download, Upload, Database, AlertTriangle, Clock, CheckCircle, Lock, ShieldCheck, X, Image as ImageIcon, Trash2 } from 'lucide-react';

// SECURITY CONSTANT - MUST MATCH THE GENERATOR
const SALT_KEY = "MEDIMIND_AFG_SECURE_KEY_2025_#XK9";

export const Settings: React.FC = () => {
  const { doctorProfile, updateDoctorProfile, importData, backupSettings, updateBackupSettings } = useStore();
  const [formData, setFormData] = useState(doctorProfile);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Security Modal State
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [licenseInput, setLicenseInput] = useState('');
  const [licenseError, setLicenseError] = useState(false);

  useEffect(() => {
    setFormData(doctorProfile);
  }, [doctorProfile]);

  const initiateSave = (e: React.FormEvent) => {
    e.preventDefault();
    setLicenseInput('');
    setLicenseError(false);
    setShowLicenseModal(true);
  };

  const verifyAndSave = async () => {
    if (!formData.fullName.trim()) {
        alert("نام پزشک نمی‌تواند خالی باشد.");
        return;
    }
    
    const normalizedName = formData.fullName.trim().replace(/\s+/g, '').toLowerCase();
    const dataToHash = normalizedName + SALT_KEY;
    const msgBuffer = new TextEncoder().encode(dataToHash);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    const rawCode = hashHex.substring(0, 8).toUpperCase();
    const expectedCode = rawCode.substring(0, 4) + '-' + rawCode.substring(4, 8);
    const cleanInput = licenseInput.trim().toUpperCase();

    if (cleanInput === expectedCode || cleanInput === rawCode) {
        updateDoctorProfile(formData);
        setShowLicenseModal(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    } else {
        setLicenseError(true);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          if (file.size > 2 * 1024 * 1024) { // 2MB limit
              alert("حجم تصویر نباید بیشتر از ۲ مگابایت باشد.");
              return;
          }
          const reader = new FileReader();
          reader.onload = (ev) => {
              setFormData({...formData, headerImage: ev.target?.result as string});
          };
          reader.readAsDataURL(file);
      }
  };

  const removeImage = () => {
      setFormData({...formData, headerImage: ''});
  };

  const handleBackup = () => {
    const state = useStore.getState();
    const backupData = {
      doctorProfile: state.doctorProfile,
      patients: state.patients,
      prescriptions: state.prescriptions,
      prescriptionTemplates: state.prescriptionTemplates,
      library: state.library,
      backupSettings: state.backupSettings,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Medimind_Backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    updateBackupSettings({ lastBackupAt: new Date().toISOString() });
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm("هشدار: با بازیابی فایل پشتیبان، اطلاعات فعلی سیستم با اطلاعات فایل جایگزین خواهد شد. آیا از ادامه عملیات اطمینان دارید؟")) {
       if (fileInputRef.current) fileInputRef.current.value = '';
       return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json.version && (!json.patients || !json.doctorProfile)) {
             throw new Error("Invalid backup file format");
        }
        importData(json);
        alert("اطلاعات با موفقیت بازیابی شد.");
      } catch (error) {
        alert("خطا در خواندن فایل پشتیبان.");
        console.error(error);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 pb-20">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2 flex items-center gap-3">
            <User className="text-medical-600" size={32} />
            تنظیمات پروفایل پزشک
        </h2>
        <p className="text-gray-500">این اطلاعات در سربرگ نسخه‌ها و گزارش‌های چاپی نمایش داده می‌شود.</p>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 relative overflow-hidden">
        <div className="absolute top-0 left-0 bg-amber-100 text-amber-800 px-4 py-1 rounded-br-xl text-xs font-bold flex items-center gap-1 border-b border-r border-amber-200">
             <Lock size={12} />
             حفاظت شده با لایسنس
        </div>

        <form onSubmit={initiateSave} className="space-y-6 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <User size={16} className="text-gray-400" />
                نام و نام خانوادگی پزشک (شناسه لایسنس)
              </label>
              <input 
                type="text"
                required
                placeholder="مثال: دکتر علی محمدی"
                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-medical-500 outline-none font-bold text-gray-800"
                value={formData.fullName}
                onChange={e => setFormData({...formData, fullName: e.target.value})}
              />
              <p className="text-[10px] text-gray-400 mt-1 mr-1">توجه: کد فعال‌سازی بر اساس این نام تولید می‌شود.</p>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <Stethoscope size={16} className="text-gray-400" />
                تخصص
              </label>
              <input 
                type="text"
                required
                placeholder="مثال: متخصص داخلی، فوق تخصص غدد"
                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-medical-500 outline-none"
                value={formData.specialty}
                onChange={e => setFormData({...formData, specialty: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <FileBadge size={16} className="text-gray-400" />
                شماره نظام پزشکی (اختیاری)
              </label>
              <input 
                type="text"
                placeholder="مثال: 123456"
                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-medical-500 outline-none ltr text-right"
                value={formData.medicalSystemNumber}
                onChange={e => setFormData({...formData, medicalSystemNumber: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <Phone size={16} className="text-gray-400" />
                شماره تماس مطب
              </label>
              <input 
                type="text"
                placeholder="021-..."
                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-medical-500 outline-none ltr text-right"
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <MapPin size={16} className="text-gray-400" />
                آدرس مطب
              </label>
              <textarea 
                rows={3}
                placeholder="تهران، خیابان..."
                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-medical-500 outline-none"
                value={formData.address}
                onChange={e => setFormData({...formData, address: e.target.value})}
              />
            </div>

            {/* Header Image Upload */}
            <div className="md:col-span-2 border-t pt-4">
                 <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                    <ImageIcon size={16} className="text-gray-400" />
                    تصویر سربرگ / پس‌زمینه (واترمارک)
                 </label>
                 <div className="flex gap-6 items-start">
                     <div 
                        onClick={() => imageInputRef.current?.click()}
                        className="flex-1 border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors"
                     >
                         <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                         <Upload className="text-gray-400 mb-2" />
                         <span className="text-sm font-bold text-gray-600">انتخاب تصویر (لوگو/سربرگ)</span>
                         <span className="text-xs text-gray-400">فرمت JPG یا PNG (حداکثر ۲ مگابایت)</span>
                     </div>
                     
                     {/* Preview Box */}
                     <div className="w-32 h-40 border border-gray-200 rounded-lg bg-white relative overflow-hidden flex items-center justify-center shadow-sm">
                         {formData.headerImage ? (
                             <>
                                <img src={formData.headerImage} alt="Header" className="absolute inset-0 w-full h-full object-contain opacity-20 filter grayscale" />
                                <span className="relative z-10 text-[10px] font-bold text-gray-500 bg-white/80 px-1 rounded">پیش‌نمایش چاپ</span>
                                <button onClick={(e) => { e.preventDefault(); removeImage(); }} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 z-20">
                                    <Trash2 size={10} />
                                </button>
                             </>
                         ) : (
                             <span className="text-xs text-gray-300 text-center px-2">تصویری انتخاب نشده</span>
                         )}
                     </div>
                 </div>
                 <p className="text-xs text-gray-500 mt-2">
                     نکته: این تصویر در هنگام چاپ به صورت "واترمارک کمرنگ" (Opacity 15%) در پس‌زمینه تمام صفحات قرار می‌گیرد تا متن‌ها خوانا بمانند.
                 </p>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-100 flex justify-end">
            <button 
              type="submit"
              className={`px-8 py-3 rounded-xl text-white font-bold flex items-center gap-2 transition-all shadow-lg ${saved ? 'bg-green-600' : 'bg-medical-600 hover:bg-medical-700'}`}
            >
              <Lock size={20} />
              {saved ? 'ذخیره شد!' : 'ذخیره و فعال‌سازی'}
            </button>
          </div>
        </form>
      </div>

      {/* Backup & Restore Section */}
      <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2 flex items-center gap-3">
              <Database className="text-amber-600" size={32} />
              پشتیبان‌گیری و بازیابی اطلاعات
          </h2>
          <p className="text-gray-500">مدیریت داده‌های نرم‌افزار، انتقال به دستگاه دیگر یا ذخیره نسخه امن.</p>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 space-y-8">
          
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
             <div className="flex justify-between items-center mb-4">
                 <div className="flex items-center gap-3">
                    <Clock size={24} className="text-blue-600" />
                    <div>
                        <h3 className="font-bold text-gray-800 text-lg">پشتیبان‌گیری خودکار هوشمند</h3>
                        <p className="text-sm text-gray-600">نرم‌افزار به صورت خودکار در بازه‌های زمانی مشخص نسخه پشتیبان تهیه می‌کند.</p>
                    </div>
                 </div>
                 <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={backupSettings.enabled}
                        onChange={e => updateBackupSettings({ enabled: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                 </label>
             </div>

             <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 transition-all ${!backupSettings.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                 <div>
                     <label className="block text-sm font-bold text-gray-700 mb-2">بازه‌ی زمانی بکاپ</label>
                     <select 
                        value={backupSettings.intervalHours}
                        onChange={e => updateBackupSettings({ intervalHours: Number(e.target.value) })}
                        className="w-full p-3 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                     >
                         <option value={1}>هر ۱ ساعت</option>
                         <option value={4}>هر ۴ ساعت</option>
                         <option value={12}>هر ۱۲ ساعت</option>
                         <option value={24}>هر ۲۴ ساعت (روزانه)</option>
                     </select>
                 </div>
                 <div className="flex flex-col justify-end">
                     <div className="bg-white p-3 rounded-xl border border-blue-100 flex items-center gap-2 text-sm">
                         <CheckCircle size={16} className="text-green-500" />
                         <span className="font-bold text-gray-600">آخرین بکاپ:</span>
                         <span className="dir-ltr font-mono text-gray-800">
                             {backupSettings.lastBackupAt ? new Date(backupSettings.lastBackupAt).toLocaleString('fa-IR') : 'هنوز انجام نشده'}
                         </span>
                     </div>
                 </div>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="border border-gray-200 rounded-xl p-6 hover:border-medical-300 transition-colors">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
                      <Download size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800 mb-2">دانلود فایل پشتیبان (دستی)</h3>
                  <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                      تمامی اطلاعات شامل بیماران، نسخه‌ها، الگوها و تنظیمات را همین لحظه دانلود کنید.
                  </p>
                  <button onClick={handleBackup} className="w-full py-3 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-blue-50 hover:text-blue-700 border border-gray-200 hover:border-blue-200 transition-colors">
                      دانلود نسخه پشتیبان
                  </button>
              </div>

              <div className="border border-gray-200 rounded-xl p-6 hover:border-amber-300 transition-colors">
                  <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mb-4">
                      <Upload size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800 mb-2">بازیابی اطلاعات</h3>
                  <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                      فایل پشتیبان (.json) را انتخاب کنید تا اطلاعات آن جایگزین اطلاعات فعلی سیستم شود.
                  </p>
                  <div className="relative">
                      <input 
                          type="file" 
                          accept=".json"
                          ref={fileInputRef}
                          onChange={handleRestore}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <button className="w-full py-3 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-amber-50 hover:text-amber-700 border border-gray-200 hover:border-amber-200 transition-colors flex justify-center items-center gap-2">
                          انتخاب و بازیابی فایل
                      </button>
                  </div>
              </div>
          </div>
      </div>

      {showLicenseModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl relative animate-fadeIn border-t-4 border-medical-600">
                <button onClick={() => setShowLicenseModal(false)} className="absolute left-6 top-6 text-gray-400 hover:text-gray-600">
                    <X size={24} />
                </button>
                
                <div className="flex flex-col items-center text-center mb-6">
                    <div className="bg-medical-100 p-4 rounded-full text-medical-600 mb-4">
                        <ShieldCheck size={40} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-800">تایید هویت پزشک</h3>
                    <p className="text-sm text-gray-500 mt-2 px-4 leading-relaxed">
                        جهت فعال‌سازی پنل به نام <span className="font-bold text-gray-800">«{formData.fullName}»</span>، لطفاً کد لایسنس اختصاصی خود را وارد نمایید.
                    </p>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 mr-1">کد فعال‌سازی (License Code)</label>
                        <input 
                            type="text" 
                            className={`w-full p-4 border rounded-xl text-center text-2xl tracking-widest font-mono uppercase outline-none focus:ring-2 ${licenseError ? 'border-red-300 focus:ring-red-200 bg-red-50 text-red-800' : 'border-gray-300 focus:ring-medical-200 text-gray-800'}`}
                            placeholder="XXXX-XXXX"
                            maxLength={9}
                            value={licenseInput}
                            onChange={(e) => {
                                setLicenseError(false);
                                setLicenseInput(e.target.value);
                            }}
                        />
                        {licenseError && <p className="text-red-500 text-xs mt-2 font-bold text-center">کد وارد شده معتبر نمی‌باشد.</p>}
                    </div>

                    <button 
                        onClick={verifyAndSave}
                        className="w-full py-3 bg-medical-600 text-white rounded-xl font-bold hover:bg-medical-700 shadow-lg shadow-medical-500/30 transition-all flex justify-center items-center gap-2"
                    >
                        <CheckCircle size={18} />
                        تایید و ذخیره
                    </button>
                    
                    <p className="text-[10px] text-gray-400 text-center pt-2">
                        برای دریافت کد با پشتیبانی تماس بگیرید.
                    </p>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
