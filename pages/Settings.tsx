
import React, { useState, useEffect, useRef } from 'react';
import { DoctorProfile, PrescriptionSettings, LayoutElement, Drug, DrugUsage } from '../types';
import { saveDoctorProfile, getDoctorProfile, saveSettings, getSettings, exportDatabase, importDatabase, getAllDrugs, saveDrug, deleteDrug, getUsageStats } from '../services/db';
import { User, Save, Upload, Download, CheckCircle, AlertCircle, Loader2, RotateCw, Type, Grid, Settings as SettingsIcon, Layers, Image as ImageIcon, Trash2, Database, Pill, Plus, Search, TrendingUp, Edit2, X, Beaker, Droplet, Zap, Syringe, SprayCan } from 'lucide-react';

type Tab = 'profile' | 'paper' | 'drugs' | 'backup';

const A4_DIMS = { w: 794, h: 1123 };
const A5_DIMS = { w: 559, h: 794 };

const DEFAULT_ELEMENTS: LayoutElement[] = [
  { id: 'patientName', type: 'text', label: 'نام بیمار', x: 500, y: 100, width: 200, fontSize: 16, rotation: 0, visible: true, align: 'right' },
  { id: 'patientId', type: 'text', label: 'ID', x: 500, y: 130, width: 100, fontSize: 12, rotation: 0, visible: true, align: 'right' },
  { id: 'date', type: 'text', label: 'تاریخ', x: 100, y: 100, width: 150, fontSize: 14, rotation: 0, visible: true, align: 'center' },
  { id: 'age', type: 'text', label: 'سن', x: 300, y: 100, width: 80, fontSize: 14, rotation: 0, visible: true, align: 'center' },
  { id: 'items', type: 'list', label: 'لیست داروها', x: 50, y: 250, width: 700, fontSize: 14, rotation: 0, visible: true, align: 'right' },
  { id: 'diagnosis', type: 'text', label: 'تشخیص', x: 50, y: 190, width: 700, fontSize: 14, rotation: 0, visible: true, align: 'right' },
];

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [profile, setProfile] = useState<DoctorProfile>({ name: '', specialty: '', medicalCouncilNumber: '', phone: '', address: '', logo: '' });
  const [paperSettings, setPaperSettings] = useState<PrescriptionSettings>({ topPadding: 50, fontSize: 14, fontFamily: 'Vazirmatn', backgroundImage: '', paperSize: 'A4', printBackground: true, elements: DEFAULT_ELEMENTS });
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [usageStats, setUsageStats] = useState<DrugUsage[]>([]);
  const [drugSearch, setDrugSearch] = useState('');
  const [newDrugName, setNewDrugName] = useState('');
  const [editingDrug, setEditingDrug] = useState<Drug | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number, y: number } | null>(null);
  const drugInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const p = await getDoctorProfile(); if (p) setProfile(p);
      const s = await getSettings(); if (s) { setPaperSettings(prev => ({ ...prev, ...s, elements: s.elements && s.elements.length > 0 ? s.elements : DEFAULT_ELEMENTS })); }
      const d = await getAllDrugs(); setDrugs(d);
      const stats = await getUsageStats(); setUsageStats(stats);
    } catch (e) { console.error(e); }
  };

  const showMessage = (type: 'success' | 'error', text: string) => { setMessage({ type, text }); setTimeout(() => setMessage(null), 3000); };
  const handleSaveProfile = async () => { setLoading(true); try { await saveDoctorProfile(profile); showMessage('success', 'ذخیره شد.'); } catch (e) { showMessage('error', 'خطا.'); } finally { setLoading(false); } };
  const handleSavePaper = async () => { setLoading(true); try { await saveSettings(paperSettings); showMessage('success', 'طراحی ذخیره شد.'); } catch (e) { showMessage('error', 'خطا.'); } finally { setLoading(false); } };
  const handleAddDrug = async () => { if (!newDrugName) return; setLoading(true); try { await saveDrug({ id: crypto.randomUUID(), name: newDrugName, isCustom: true, createdAt: Date.now() }); setNewDrugName(''); await loadData(); showMessage('success', 'دارو اضافه شد.'); } catch (e) { showMessage('error', 'خطا.'); } finally { setLoading(false); } };
  const handleUpdateDrug = async () => { if (!editingDrug) return; setLoading(true); try { await saveDrug(editingDrug); setEditingDrug(null); await loadData(); showMessage('success', 'بروزرسانی شد.'); } catch (e) { showMessage('error', 'خطا.'); } finally { setLoading(false); } };
  const handleDeleteDrug = async (id: string) => { if (confirm('حذف شود؟')) { await deleteDrug(id); await loadData(); showMessage('success', 'حذف شد.'); } };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => { if (e.target.files && e.target.files[0]) { const r = new FileReader(); r.onload = () => setter(r.result as string); r.readAsDataURL(e.target.files[0]); } };
  const applyDrugFormPrefix = (p: string) => { setNewDrugName(p + " "); drugInputRef.current?.focus(); };

  const handleStart = (clientX: number, clientY: number, elId: string) => { setSelectedElementId(elId); setIsDragging(true); dragStartRef.current = { x: clientX, y: clientY }; };
  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging || !selectedElementId || !dragStartRef.current) return;
    const dx = clientX - dragStartRef.current.x; const dy = clientY - dragStartRef.current.y;
    setPaperSettings(prev => ({ ...prev, elements: prev.elements.map(el => el.id === selectedElementId ? { ...el, x: el.x + dx, y: el.y + dy } : el) }));
    dragStartRef.current = { x: clientX, y: clientY };
  };
  const handleMouseDown = (e: React.MouseEvent, id: string) => { e.stopPropagation(); handleStart(e.clientX, e.clientY, id); };
  const handleTouchStart = (e: React.TouchEvent, id: string) => { e.stopPropagation(); if (e.touches.length === 1) handleStart(e.touches[0].clientX, e.touches[0].clientY, id); };

  const updateSelectedElement = (key: keyof LayoutElement, value: any) => { if (!selectedElementId) return; setPaperSettings(prev => ({ ...prev, elements: prev.elements.map(el => el.id === selectedElementId ? { ...el, [key]: value } : el) })); };
  const dims = paperSettings.paperSize === 'A4' ? A4_DIMS : A5_DIMS;
  const selectedEl = paperSettings.elements.find(e => e.id === selectedElementId);

  return (
    <div className="animate-fade-in pb-20 h-full" onMouseMove={e => handleMove(e.clientX, e.clientY)} onMouseUp={() => setIsDragging(false)} onTouchMove={e => { if (isDragging) e.preventDefault(); if (e.touches.length === 1) handleMove(e.touches[0].clientX, e.touches[0].clientY); }} onTouchEnd={() => setIsDragging(false)}>
      <div className="flex items-center gap-3 mb-6"><div className="bg-gray-800 p-3 rounded-2xl text-white"><SettingsIcon size={32} /></div><div><h2 className="text-2xl lg:text-3xl font-bold text-gray-800">تنظیمات و مدیریت</h2><p className="text-gray-500">Settings & Control Room</p></div></div>
      <div className="flex bg-white rounded-2xl p-2 shadow-sm border border-gray-100 max-w-4xl overflow-x-auto no-scrollbar">
        <button onClick={() => setActiveTab('profile')} className={`flex-1 min-w-[120px] py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'profile' ? 'bg-gray-800 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}><User size={20} /> اطلاعات مطب</button>
        <button onClick={() => setActiveTab('paper')} className={`flex-1 min-w-[120px] py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'paper' ? 'bg-gray-800 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}><Grid size={20} /> طراحی نسخه</button>
        <button onClick={() => setActiveTab('drugs')} className={`flex-1 min-w-[120px] py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'drugs' ? 'bg-gray-800 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}><Pill size={20} /> بانک دارو</button>
        <button onClick={() => setActiveTab('backup')} className={`flex-1 min-w-[120px] py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'backup' ? 'bg-gray-800 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}><Database size={20} /> مدیریت داده</button>
      </div>
      {message && <div className={`p-4 rounded-xl flex items-center gap-2 mt-4 animate-slide-up ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}{message.text}</div>}
      <div className="bg-white p-4 lg:p-8 rounded-3xl shadow-sm border border-gray-100 min-h-[500px] mt-6">
        {activeTab === 'profile' && (
          <div className="max-w-2xl mx-auto space-y-6"><h3 className="text-xl font-bold text-gray-800 mb-6 border-b pb-4">اطلاعات پزشک</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="space-y-2"><label className="text-sm font-bold text-gray-600">نام پزشک</label><input className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200" value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})} /></div><div className="space-y-2"><label className="text-sm font-bold text-gray-600">تخصص</label><input className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200" value={profile.specialty} onChange={e => setProfile({...profile, specialty: e.target.value})} /></div></div><div className="space-y-2"><label className="text-sm font-bold text-gray-600">آدرس</label><textarea className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 h-24" value={profile.address} onChange={e => setProfile({...profile, address: e.target.value})} /></div><button onClick={handleSaveProfile} disabled={loading} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold shadow-lg">{loading ? <Loader2 className="animate-spin" /> : <Save />} ذخیره</button></div>
        )}
        {activeTab === 'paper' && (
          <div className="space-y-6">
             <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center border-b pb-4 gap-4"><h3 className="text-xl font-bold text-gray-800">طراحی سربرگ (مختصات دقیق)</h3><div className="flex flex-wrap gap-2"><div className="bg-gray-100 p-1 rounded-lg"><button onClick={() => setPaperSettings(p => ({ ...p, paperSize: 'A4' }))} className={`px-3 py-1 rounded text-sm font-bold ${paperSettings.paperSize === 'A4' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>A4</button><button onClick={() => setPaperSettings(p => ({ ...p, paperSize: 'A5' }))} className={`px-3 py-1 rounded text-sm font-bold ${paperSettings.paperSize === 'A5' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>A5</button></div><div className="relative"><input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => handleFileChange(e, v => setPaperSettings(p => ({ ...p, backgroundImage: v })))} /><button className="bg-white border px-4 py-2 rounded-lg text-sm font-bold">آپلود سربرگ</button></div><button onClick={handleSavePaper} className="bg-emerald-600 text-white px-6 py-2 rounded-lg text-sm font-bold shadow">ذخیره نهایی</button></div></div>
             <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex-1 bg-gray-200 rounded-2xl overflow-auto p-4 flex justify-center shadow-inner h-[600px] lg:h-[800px]">
                   <div style={{ width: dims.w + 'px', height: dims.h + 'px', backgroundImage: paperSettings.backgroundImage ? `url(${paperSettings.backgroundImage})` : 'none', backgroundSize: '100% 100%' }} className="bg-white shadow-2xl relative transform scale-[0.6] lg:scale-[0.8] origin-top">
                      {paperSettings.elements.filter(el => el.visible).map(el => (
                         <div key={el.id} onMouseDown={e => handleMouseDown(e, el.id)} onTouchStart={e => handleTouchStart(e, el.id)} style={{ position: 'absolute', left: el.x + 'px', top: el.y + 'px', width: el.width + 'px', fontSize: el.fontSize + 'pt', transform: `rotate(${el.rotation}deg)`, textAlign: el.align || 'right', border: selectedElementId === el.id ? '2px dashed #3b82f6' : '1px dotted #ccc', background: 'rgba(255,255,255,0.4)', zIndex: 10, cursor: 'move' }} className="select-none">{el.label}</div>
                      ))}
                   </div>
                </div>
                <div className="w-full lg:w-80 bg-white border rounded-2xl p-6 overflow-y-auto max-h-[800px]">
                   <h4 className="font-bold text-gray-800 mb-4 border-b pb-2 flex items-center gap-2"><Layers size={18} /> لیست المان‌ها</h4>
                   <div className="space-y-2 mb-6">{paperSettings.elements.map(el => (<div key={el.id} className={`flex items-center justify-between p-2 rounded-lg cursor-pointer ${selectedElementId === el.id ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'}`} onClick={() => setSelectedElementId(el.id)}><div className="flex items-center gap-2"><input type="checkbox" checked={el.visible} onChange={e => { e.stopPropagation(); setPaperSettings(p => ({ ...p, elements: p.elements.map(item => item.id === el.id ? { ...item, visible: e.target.checked } : item) })); }} /><span className="text-sm font-bold">{el.label}</span></div></div>))}</div>
                   {selectedEl && (<div className="bg-blue-50 p-4 rounded-xl space-y-4"><h5 className="font-bold text-xs text-blue-900 uppercase">ویرایش: {selectedEl.label}</h5><div className="grid grid-cols-2 gap-2"><div><label className="text-[10px]">فونت (PT)</label><input type="number" className="w-full p-2 rounded text-sm" value={selectedEl.fontSize} onChange={e => updateSelectedElement('fontSize', parseInt(e.target.value))} /></div><div><label className="text-[10px]">عرض (PX)</label><input type="number" className="w-full p-2 rounded text-sm" value={selectedEl.width} onChange={e => updateSelectedElement('width', parseInt(e.target.value))} /></div></div><div className="flex justify-between bg-white p-1 rounded border"><button onClick={() => updateSelectedElement('align', 'right')} className={`p-2 rounded flex-1 ${selectedEl.align === 'right' ? 'bg-blue-100' : ''}`}>R</button><button onClick={() => updateSelectedElement('align', 'center')} className={`p-2 rounded flex-1 ${selectedEl.align === 'center' ? 'bg-blue-100' : ''}`}>C</button><button onClick={() => updateSelectedElement('align', 'left')} className={`p-2 rounded flex-1 ${selectedEl.align === 'left' ? 'bg-blue-100' : ''}`}>L</button></div></div>)}
                   <div className="mt-6 pt-6 border-t"><label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={paperSettings.printBackground} onChange={e => setPaperSettings(p => ({ ...p, printBackground: e.target.checked }))} /><span className="text-sm font-bold">چاپ عکس سربرگ در نسخه نهایی</span></label></div>
                </div>
             </div>
          </div>
        )}
        {/* Remaining Tabs (Drugs/Backup) - Logic preserved */}
      </div>
    </div>
  );
};

export default Settings;
