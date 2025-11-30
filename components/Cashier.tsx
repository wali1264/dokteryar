
import React, { useEffect, useState, useRef } from 'react';
import { useStore } from '../store';
import { DollarSign, User, Clock, CheckCircle, Printer, History, TrendingUp, X, Search, UserPlus, Save, AlertTriangle, Briefcase, Plus } from 'lucide-react';
import { Payment, Patient, Gender } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const Cashier: React.FC = () => {
  const { unpaidVisits, unpaidLabRequests, todaysPayments, fetchCashierQueue, processPayment, isLoading, allUsers, createPaidVisit, patients, fetchPatients, addPatient } = useStore();
  const [activeTab, setActiveTab] = useState<'RECEPTION' | 'QUEUE' | 'MISC' | 'HISTORY'>('RECEPTION');
  
  // Reception State
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [visitFee, setVisitFee] = useState(200);

  // Quick Register State
  const [showQuickRegister, setShowQuickRegister] = useState(false);
  const [newPatientForm, setNewPatientForm] = useState({ fullName: '', phone: '', age: '', gender: 'Male' });

  // Misc Payment State
  const [miscTitle, setMiscTitle] = useState('');
  const [miscAmount, setMiscAmount] = useState(50);

  // Printing State
  const [showReceipt, setShowReceipt] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [lastQueueNumber, setLastQueueNumber] = useState<number | null>(null);

  useEffect(() => {
    fetchCashierQueue();
    fetchPatients();
  }, []);

  const totalIncome = todaysPayments.reduce((sum, p) => sum + p.amount, 0);
  const doctors = allUsers.filter(u => u.role === 'doctor' || u.role === 'admin');

  // Reception Handlers
  const handleCreateVisit = async (isPaid: boolean) => {
      if (!selectedPatient || !selectedDoctorId) {
          alert("لطفاً بیمار و پزشک را انتخاب کنید.");
          return;
      }
      
      const confirmMsg = isPaid 
        ? `آیا از ثبت نوبت و دریافت مبلغ ${visitFee} افغانی اطمینان دارید؟`
        : `آیا از ثبت نوبت بدون پرداخت (نسیه) اطمینان دارید؟`;

      if(confirm(confirmMsg)) {
          try {
              const queueNum = await createPaidVisit(selectedPatient.id, selectedDoctorId, visitFee, isPaid);
              setLastQueueNumber(queueNum);
              
              if (isPaid) {
                  // Find new payment for receipt
                  setTimeout(() => {
                      const latest = useStore.getState().todaysPayments[0];
                      if(latest) openReceipt(latest, queueNum);
                  }, 500);
              } else {
                  alert(`نوبت با موفقیت ثبت شد (پرداخت نشده). شماره نوبت: ${queueNum}`);
              }
              
              // Reset Form
              setSelectedPatient(null);
              setPatientSearch('');
          } catch(e) {
              alert("خطا در ثبت نوبت: " + e);
          }
      }
  };

  const handleQuickRegister = async () => {
      if (!newPatientForm.fullName || !newPatientForm.phone || !newPatientForm.age) {
          alert("لطفاً همه فیلدها را پر کنید.");
          return;
      }
      try {
          const newPatient = await addPatient({
              fullName: newPatientForm.fullName,
              phone: newPatientForm.phone,
              age: Number(newPatientForm.age),
              gender: newPatientForm.gender as Gender,
              medicalHistory: 'ثبت سریع',
              allergies: 'بررسی نشده'
          });
          
          if (newPatient) {
              setSelectedPatient(newPatient);
              setPatientSearch(newPatient.fullName);
              setShowQuickRegister(false);
              setNewPatientForm({ fullName: '', phone: '', age: '', gender: 'Male' });
          }
      } catch(e) {
          alert("خطا در ثبت بیمار: " + e);
      }
  };

  // Queue Handlers
  const handlePayVisit = async (visit: any) => {
      if(confirm(`تایید دریافت مبلغ ویزیت برای ${visit.patientName}؟`)) {
          await processPayment('VISIT_FEE', visit.id, 200, visit.patientId);
          setTimeout(() => {
             const latest = useStore.getState().todaysPayments[0];
             if(latest) openReceipt(latest, undefined); // Queue num not tracked for old unpaid
          }, 500);
      }
  };

  const handlePayLab = async (lab: any) => {
      if(confirm(`تایید دریافت مبلغ ${lab.price} افغانی برای ${lab.patientName}؟`)) {
          await processPayment('LAB_TEST', lab.id, lab.price, lab.patientId);
          setTimeout(() => {
             const latest = useStore.getState().todaysPayments[0];
             if(latest) openReceipt(latest, undefined);
          }, 500);
      }
  };

  const handleMiscPayment = async () => {
      if (!miscTitle || !miscAmount) {
          alert("عنوان و مبلغ را وارد کنید.");
          return;
      }
      if (confirm(`تایید دریافت مبلغ ${miscAmount} برای ${miscTitle}؟`)) {
          await processPayment('OTHER', uuidv4(), miscAmount, undefined, miscTitle);
          setMiscTitle('');
          setMiscAmount(50);
          setTimeout(() => {
             const latest = useStore.getState().todaysPayments[0];
             if(latest) openReceipt(latest);
          }, 500);
      }
  };

  const openReceipt = (payment: Payment, queueNum?: number) => {
      setSelectedPayment({ ...payment, queueNumber: queueNum });
      setShowReceipt(true);
  };

  const filteredPatients = patients.filter(p => p.fullName.toLowerCase().includes(patientSearch.toLowerCase()) || p.phone.includes(patientSearch));

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <DollarSign className="text-emerald-600"/>
              صندوق مرکزی & پذیرش
          </h2>
          <p className="text-gray-500 mt-1">مدیریت نوبت‌دهی و پرداخت‌ها</p>
        </div>
        
        <div className="bg-white px-6 py-3 rounded-xl border border-emerald-100 shadow-sm flex items-center gap-4">
            <div>
                <p className="text-xs font-bold text-gray-400 uppercase">موجودی صندوق (امروز)</p>
                <p className="text-2xl font-mono font-bold text-emerald-600 mt-1">{totalIncome.toLocaleString()} <span className="text-sm">AFN</span></p>
            </div>
            <div className="bg-emerald-50 p-2 rounded-lg">
                <TrendingUp className="text-emerald-500" size={24} />
            </div>
        </div>
      </div>

      <div className="flex gap-4 border-b border-gray-200 mb-6">
          <button 
            onClick={() => setActiveTab('RECEPTION')}
            className={`pb-4 px-4 font-bold transition-colors border-b-2 ${activeTab === 'RECEPTION' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
              <span className="flex items-center gap-2"><UserPlus size={18}/> پذیرش جدید</span>
          </button>
          <button 
            onClick={() => setActiveTab('QUEUE')}
            className={`pb-4 px-4 font-bold transition-colors border-b-2 ${activeTab === 'QUEUE' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
              <span className="flex items-center gap-2"><Clock size={18}/> صف بدهکاری</span>
          </button>
          <button 
            onClick={() => setActiveTab('MISC')}
            className={`pb-4 px-4 font-bold transition-colors border-b-2 ${activeTab === 'MISC' ? 'border-amber-600 text-amber-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
              <span className="flex items-center gap-2"><Briefcase size={18}/> خدمات متفرقه</span>
          </button>
          <button 
            onClick={() => setActiveTab('HISTORY')}
            className={`pb-4 px-4 font-bold transition-colors border-b-2 ${activeTab === 'HISTORY' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
              <span className="flex items-center gap-2"><History size={18}/> تراکنش‌های امروز</span>
          </button>
      </div>

      {activeTab === 'RECEPTION' && (
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 animate-fadeIn max-w-2xl mx-auto relative">
              <h3 className="font-bold text-gray-800 mb-6 text-lg">صدور نوبت ویزیت</h3>
              
              <div className="space-y-6">
                  {/* Patient Search */}
                  <div className="relative">
                      <div className="flex justify-between items-end mb-2">
                          <label className="block text-sm font-bold text-gray-700">۱. انتخاب بیمار</label>
                          <button onClick={() => setShowQuickRegister(true)} className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full font-bold hover:bg-indigo-100 flex items-center gap-1">
                              <UserPlus size={14}/> ثبت بیمار جدید
                          </button>
                      </div>
                      
                      <div className="relative">
                          <input 
                            type="text" 
                            className="w-full p-4 pl-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="جستجو نام یا شماره تماس بیمار..."
                            value={selectedPatient ? selectedPatient.fullName : patientSearch}
                            onChange={e => {setPatientSearch(e.target.value); setSelectedPatient(null);}}
                          />
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20}/>
                          {selectedPatient && <button onClick={() => {setSelectedPatient(null); setPatientSearch('')}} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-gray-100 rounded-full hover:bg-gray-200"><X size={16}/></button>}
                      </div>
                      
                      {!selectedPatient && patientSearch && (
                          <div className="absolute w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-20 max-h-60 overflow-y-auto">
                              {filteredPatients.map(p => (
                                  <div key={p.id} onClick={() => setSelectedPatient(p)} className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-0">
                                      <p className="font-bold">{p.fullName}</p>
                                      <p className="text-xs text-gray-500">{p.phone}</p>
                                  </div>
                              ))}
                              {filteredPatients.length === 0 && <p className="p-4 text-gray-500 text-center text-sm">بیماری یافت نشد.</p>}
                          </div>
                      )}
                  </div>

                  {/* Doctor Select */}
                  <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">۲. انتخاب پزشک معالج</label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {doctors.map(doc => (
                              <div 
                                key={doc.id} 
                                onClick={() => setSelectedDoctorId(doc.id!)}
                                className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center gap-3 ${selectedDoctorId === doc.id ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500' : 'bg-white border-gray-200 hover:border-indigo-300'}`}
                              >
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${selectedDoctorId === doc.id ? 'bg-indigo-500' : 'bg-gray-300'}`}>
                                      Dr
                                  </div>
                                  <div>
                                      <p className="font-bold text-gray-800">{doc.fullName}</p>
                                      <p className="text-xs text-gray-500">{doc.specialty}</p>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>

                  {/* Fee */}
                  <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">۳. هزینه ویزیت (افغانی)</label>
                      <input 
                        type="number" 
                        value={visitFee}
                        onChange={e => setVisitFee(Number(e.target.value))}
                        className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-lg font-bold"
                      />
                  </div>

                  <div className="flex gap-3">
                      <button 
                        onClick={() => handleCreateVisit(false)}
                        disabled={!selectedPatient || !selectedDoctorId || isLoading}
                        className="flex-1 bg-amber-100 text-amber-700 py-4 rounded-xl font-bold hover:bg-amber-200 transition-all disabled:opacity-50 flex justify-center items-center gap-2 border border-amber-200"
                      >
                          <AlertTriangle size={20}/>
                          ثبت نوبت (پرداخت نشده)
                      </button>
                      <button 
                        onClick={() => handleCreateVisit(true)}
                        disabled={!selectedPatient || !selectedDoctorId || isLoading}
                        className="flex-[2] bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all disabled:opacity-50 flex justify-center items-center gap-2"
                      >
                          {isLoading ? <span className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></span> : <CheckCircle size={24}/>}
                          ثبت نوبت و دریافت وجه
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* QUICK REGISTER MODAL */}
      {showQuickRegister && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl relative animate-fadeIn">
                  <button onClick={() => setShowQuickRegister(false)} className="absolute left-4 top-4 text-gray-400 hover:text-gray-600"><X size={20}/></button>
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-indigo-700"><UserPlus size={20}/> ثبت سریع بیمار</h3>
                  
                  <div className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1">نام کامل</label>
                          <input type="text" className="w-full p-3 border rounded-xl" value={newPatientForm.fullName} onChange={e => setNewPatientForm({...newPatientForm, fullName: e.target.value})}/>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1">شماره تماس</label>
                          <input type="tel" className="w-full p-3 border rounded-xl" value={newPatientForm.phone} onChange={e => setNewPatientForm({...newPatientForm, phone: e.target.value})}/>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-gray-500 mb-1">سن</label>
                              <input type="number" className="w-full p-3 border rounded-xl" value={newPatientForm.age} onChange={e => setNewPatientForm({...newPatientForm, age: e.target.value})}/>
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-gray-500 mb-1">جنسیت</label>
                              <select className="w-full p-3 border rounded-xl bg-white" value={newPatientForm.gender} onChange={e => setNewPatientForm({...newPatientForm, gender: e.target.value})}>
                                  <option value="Male">مرد</option>
                                  <option value="Female">زن</option>
                              </select>
                          </div>
                      </div>
                      <button onClick={handleQuickRegister} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 flex justify-center items-center gap-2">
                          <Save size={18}/> ثبت و انتخاب
                      </button>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'QUEUE' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fadeIn">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <User size={20} className="text-blue-500"/>
                    ویزیت‌های پرداخت نشده
                    <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-xs">{unpaidVisits.length}</span>
                </h3>
                <div className="space-y-3">
                    {unpaidVisits.length === 0 && <p className="text-gray-400 text-center py-8">لیست خالی است.</p>}
                    {unpaidVisits.map(v => (
                        <div key={v.id} className="p-4 border border-gray-100 rounded-xl bg-gray-50 flex justify-between items-center">
                            <div>
                                <h4 className="font-bold text-gray-800">{v.patientName}</h4>
                                <p className="text-xs text-gray-500 mt-1">دکتر {v.doctorName}</p>
                            </div>
                            <button onClick={() => handlePayVisit(v)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-emerald-700">دریافت وجه</button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <DollarSign size={20} className="text-purple-500"/>
                    درخواست‌های آزمایشگاه
                    <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-xs">{unpaidLabRequests.length}</span>
                </h3>
                <div className="space-y-3">
                    {unpaidLabRequests.length === 0 && <p className="text-gray-400 text-center py-8">لیست خالی است.</p>}
                    {unpaidLabRequests.map(l => (
                        <div key={l.id} className="p-4 border border-gray-100 rounded-xl bg-gray-50 flex justify-between items-center">
                            <div>
                                <h4 className="font-bold text-gray-800">{l.patientName}</h4>
                                <p className="text-sm font-mono text-purple-600 font-bold mt-1">{l.testName}</p>
                            </div>
                            <div className="text-left">
                                <span className="block font-mono font-bold text-lg text-gray-700 mb-1">{l.price} AFN</span>
                                <button onClick={() => handlePayLab(l)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-xs hover:bg-emerald-700 w-full">تایید پرداخت</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}

      {/* MISC INCOME TAB */}
      {activeTab === 'MISC' && (
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 animate-fadeIn max-w-xl mx-auto">
              <h3 className="font-bold text-gray-800 mb-6 text-lg flex items-center gap-2">
                  <Briefcase className="text-amber-600" />
                  ثبت خدمات متفرقه (آزاد)
              </h3>
              
              <div className="space-y-6">
                  <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">عنوان خدمت</label>
                      <input 
                        type="text" 
                        value={miscTitle}
                        onChange={e => setMiscTitle(e.target.value)}
                        className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none font-bold"
                        placeholder="مثال: تزریقات، پانسمان، فروش ماسک..."
                      />
                  </div>
                  <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">مبلغ (افغانی)</label>
                      <input 
                        type="number" 
                        value={miscAmount}
                        onChange={e => setMiscAmount(Number(e.target.value))}
                        className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none font-mono text-lg font-bold"
                      />
                  </div>
                  
                  <div className="pt-4 border-t border-gray-100">
                      <div className="flex gap-2 flex-wrap mb-4">
                          <button onClick={() => {setMiscTitle('تزریقات'); setMiscAmount(50)}} className="bg-gray-100 px-3 py-1 rounded-full text-xs hover:bg-gray-200">تزریقات (۵۰)</button>
                          <button onClick={() => {setMiscTitle('پانسمان'); setMiscAmount(100)}} className="bg-gray-100 px-3 py-1 rounded-full text-xs hover:bg-gray-200">پانسمان (۱۰۰)</button>
                          <button onClick={() => {setMiscTitle('سرم تراپی'); setMiscAmount(200)}} className="bg-gray-100 px-3 py-1 rounded-full text-xs hover:bg-gray-200">سرم تراپی (۲۰۰)</button>
                      </div>
                      
                      <button 
                        onClick={handleMiscPayment}
                        className="w-full bg-amber-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-amber-700 shadow-lg shadow-amber-200 flex justify-center items-center gap-2"
                      >
                          <Plus size={24}/>
                          ثبت و دریافت وجه
                      </button>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'HISTORY' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-fadeIn">
            <table className="w-full text-right">
                <thead className="bg-gray-50 border-b">
                    <tr>
                        <th className="p-4 text-sm text-gray-600">زمان</th>
                        <th className="p-4 text-sm text-gray-600">عنوان / نام بیمار</th>
                        <th className="p-4 text-sm text-gray-600">نوع خدمات</th>
                        <th className="p-4 text-sm text-gray-600">مبلغ</th>
                        <th className="p-4 text-sm text-gray-600">عملیات</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {todaysPayments.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-gray-400">تراکنشی یافت نشد.</td></tr>}
                    {todaysPayments.map(p => (
                        <tr key={p.id} className="hover:bg-gray-50">
                            <td className="p-4 font-mono text-gray-600 text-sm">{new Date(p.createdAt).toLocaleTimeString('fa-IR')}</td>
                            <td className="p-4 font-bold text-gray-800">{p.description || p.patientName || 'ناشناس'}</td>
                            <td className="p-4">
                                {p.paymentType === 'VISIT_FEE' ? (
                                    <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs font-bold">ویزیت / نوبت</span>
                                ) : p.paymentType === 'LAB_TEST' ? (
                                    <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-bold">آزمایشگاه</span>
                                ) : (
                                    <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-bold">خدمات متفرقه</span>
                                )}
                            </td>
                            <td className="p-4 font-mono font-bold text-emerald-600">{p.amount.toLocaleString()}</td>
                            <td className="p-4"><button onClick={() => openReceipt(p)} className="text-gray-400 hover:text-gray-600"><Printer size={18}/></button></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      )}

      {/* RECEIPT MODAL */}
      {showReceipt && selectedPayment && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
              <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm overflow-hidden animate-slideUp">
                  <div className="p-4 bg-gray-100 border-b flex justify-between items-center no-print">
                      <h3 className="font-bold text-gray-700">رسید پرداخت</h3>
                      <button onClick={() => setShowReceipt(false)}><X size={20}/></button>
                  </div>
                  
                  <div className="p-8 bg-white" id="receipt-area">
                      <div className="text-center border-b-2 border-black pb-4 mb-4">
                          <h2 className="text-xl font-black mb-1">کلینیک دکتریار</h2>
                          <p className="text-xs text-gray-500">رسید نوبت / پرداخت</p>
                      </div>
                      
                      {selectedPayment.paymentType === 'VISIT_FEE' && (
                          <div className="text-center mb-6 border-2 border-black rounded-lg p-2">
                              <span className="block text-xs font-bold uppercase text-gray-500">شماره نوبت</span>
                              <span className="block text-6xl font-black">{selectedPayment.queueNumber || lastQueueNumber || '--'}</span>
                          </div>
                      )}
                      
                      <div className="space-y-3 text-sm mb-6">
                          <div className="flex justify-between">
                              <span className="text-gray-500">تاریخ:</span>
                              <span className="font-bold">{new Date(selectedPayment.createdAt).toLocaleDateString('fa-IR')}</span>
                          </div>
                          
                          {selectedPayment.paymentType === 'OTHER' ? (
                              <div className="flex justify-between">
                                  <span className="text-gray-500">شرح:</span>
                                  <span className="font-bold">{selectedPayment.description}</span>
                              </div>
                          ) : (
                              <div className="flex justify-between">
                                  <span className="text-gray-500">نام بیمار:</span>
                                  <span className="font-bold">{selectedPayment.patientName}</span>
                              </div>
                          )}
                          
                          <div className="flex justify-between border-t pt-2 mt-2">
                              <span className="font-bold">مبلغ:</span>
                              <span className="font-black text-lg">{selectedPayment.amount.toLocaleString()} <small>AFN</small></span>
                          </div>
                      </div>
                      
                      <div className="text-center">
                          {selectedPayment.paymentType === 'VISIT_FEE' && <p className="text-[10px] text-gray-400 mb-2">لطفاً تا زمان فراخوان توسط پزشک در سالن انتظار بمانید.</p>}
                          <div className="border-t border-dashed border-gray-300 pt-2">
                             <p className="text-[9px] text-gray-300">Software by Dr.Yar AI</p>
                          </div>
                      </div>
                  </div>

                  <div className="p-4 bg-gray-50 border-t flex gap-3 no-print">
                      <button onClick={() => window.print()} className="flex-1 bg-emerald-600 text-white py-2 rounded-lg font-bold hover:bg-emerald-700 flex justify-center items-center gap-2">
                          <Printer size={18} /> چاپ
                      </button>
                  </div>
              </div>
          </div>
      )}

      <style>{`@media print { body * { visibility: hidden; } #receipt-area, #receipt-area * { visibility: visible; } #receipt-area { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; } .no-print { display: none !important; } }`}</style>
    </div>
  );
};
