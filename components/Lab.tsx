
import React, { useEffect, useState, useRef } from 'react';
import { useStore } from '../store';
import { TestTube, Upload, CheckCircle, Loader, Camera, FileText, History, Printer, Sparkles, AlertTriangle, Plus, Trash2, Save, X, Eye } from 'lucide-react';
import { parseLabReport } from '../services/geminiService';
import { LabRequest, LabResultItem } from '../types';

export const Lab: React.FC = () => {
  const { pendingLabTests, labHistory, fetchLabQueue, fetchLabHistory, completeLabTest, isLoading } = useStore();
  
  const [activeTab, setActiveTab] = useState<'WORKLIST' | 'ARCHIVE'>('WORKLIST');
  const [selectedRequest, setSelectedRequest] = useState<LabRequest | null>(null);
  
  // Structured Form State
  const [rows, setRows] = useState<LabResultItem[]>([
      { testName: '', result: '', unit: '', normalRange: '', flag: 'N' }
  ]);
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  
  // OCR State
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Print State
  const [printRequest, setPrintRequest] = useState<LabRequest | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

  useEffect(() => {
    fetchLabQueue();
    fetchLabHistory();
  }, []);

  // --- Form Handlers ---
  const handleSelectRequest = (req: LabRequest) => {
      setSelectedRequest(req);
      setRows([{ testName: req.testName, result: '', unit: '', normalRange: '', flag: 'N' }]);
      setNotes('');
      setFiles([]);
  };

  const handleRowChange = (index: number, field: keyof LabResultItem, value: string) => {
      const newRows = [...rows];
      // @ts-ignore
      newRows[index][field] = value;
      setRows(newRows);
  };

  const addRow = () => setRows([...rows, { testName: '', result: '', unit: '', normalRange: '', flag: 'N' }]);
  const removeRow = (index: number) => setRows(rows.filter((_, i) => i !== index));

  // --- AI OCR ---
  const handleScanImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsScanning(true);
      try {
          // Add image to files list as evidence
          setFiles(prev => [...prev, file]);
          
          const results = await parseLabReport(file);
          if (results && results.length > 0) {
              setRows(results);
          } else {
              alert("نتوانستیم داده‌ای استخراج کنیم. لطفاً دستی وارد کنید.");
          }
      } catch (error) {
          alert("خطا در اسکن هوشمند: " + error);
      } finally {
          setIsScanning(false);
      }
  };

  const handleSubmit = async () => {
      if(!selectedRequest) return;
      const validRows = rows.filter(r => r.testName.trim() !== '');
      await completeLabTest(selectedRequest.id, files, notes, validRows);
      setSelectedRequest(null);
      alert("نتیجه ثبت شد و برای پزشک ارسال گردید.");
      setActiveTab('ARCHIVE');
  };

  // --- Print Logic ---
  const handlePrint = (req: LabRequest) => {
      setPrintRequest(req);
      setShowPrintModal(true);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto h-screen flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <TestTube className="text-purple-600"/>
              آزمایشگاه هوشمند و رباتیک
          </h2>
          <p className="text-gray-500 mt-1">مدیریت نمونه‌ها، اسکن هوشمند نتایج و چاپ گزارش استاندارد</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200 mb-6">
          <button 
            onClick={() => setActiveTab('WORKLIST')}
            className={`pb-4 px-4 font-bold transition-colors border-b-2 ${activeTab === 'WORKLIST' ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
              <span className="flex items-center gap-2"><TestTube size={18}/> لیست کار (Worklist)</span>
          </button>
          <button 
            onClick={() => setActiveTab('ARCHIVE')}
            className={`pb-4 px-4 font-bold transition-colors border-b-2 ${activeTab === 'ARCHIVE' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
              <span className="flex items-center gap-2"><History size={18}/> آرشیو و چاپ</span>
          </button>
      </div>

      <div className="flex gap-6 flex-1 overflow-hidden">
          
          {/* LEFT SIDE: LIST */}
          <div className="w-1/3 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden shadow-sm">
              <div className="p-4 bg-gray-50 border-b font-bold text-gray-700">
                  {activeTab === 'WORKLIST' ? `در انتظار انجام (${pendingLabTests.length})` : 'آرشیو آزمایش‌ها'}
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {activeTab === 'WORKLIST' ? (
                      pendingLabTests.map(req => (
                          <div 
                            key={req.id} 
                            onClick={() => handleSelectRequest(req)}
                            className={`p-4 rounded-xl cursor-pointer transition-all border ${selectedRequest?.id === req.id ? 'bg-purple-50 border-purple-500 shadow-md ring-1 ring-purple-200' : 'bg-white border-gray-100 hover:bg-gray-50'}`}
                          >
                              <div className="flex justify-between mb-1">
                                  <span className="font-bold text-gray-800">{req.patientName}</span>
                                  <span className="text-[10px] text-green-600 bg-green-100 px-2 py-0.5 rounded-full font-bold">PAID</span>
                              </div>
                              <p className="text-purple-600 font-bold text-sm">{req.testName}</p>
                              <p className="text-xs text-gray-400 mt-1">دکتر {req.doctorName}</p>
                          </div>
                      ))
                  ) : (
                      labHistory.map(req => (
                          <div key={req.id} className="p-4 rounded-xl border bg-white border-gray-100 flex justify-between items-center group hover:shadow-md transition-all">
                              <div>
                                  <h4 className="font-bold text-gray-800">{req.patientName}</h4>
                                  <p className="text-xs text-gray-500">{new Date(req.createdAt).toLocaleDateString('fa-IR')}</p>
                                  <p className="text-xs font-bold text-blue-600 mt-1">{req.testName}</p>
                              </div>
                              <button onClick={() => handlePrint(req)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                                  <Printer size={18} />
                              </button>
                          </div>
                      ))
                  )}
              </div>
          </div>

          {/* RIGHT SIDE: WORKSPACE */}
          <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-lg flex flex-col overflow-hidden">
              {activeTab === 'WORKLIST' && selectedRequest ? (
                  <div className="flex-1 flex flex-col h-full">
                      {/* Header */}
                      <div className="p-6 border-b border-gray-100 bg-purple-50 flex justify-between items-center">
                          <div>
                              <h2 className="text-xl font-bold text-gray-800">{selectedRequest.patientName}</h2>
                              <p className="text-sm text-purple-700 font-bold mt-1">آزمایش درخواستی: {selectedRequest.testName}</p>
                          </div>
                          
                          {/* MAGIC AI BUTTON */}
                          <div className="flex gap-2">
                              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleScanImage} />
                              <button 
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isScanning}
                                className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-xl font-bold shadow-lg shadow-purple-200 hover:shadow-xl transition-all flex items-center gap-2 text-sm animate-pulse-slow"
                              >
                                  {isScanning ? <Loader className="animate-spin" size={16}/> : <Sparkles size={16}/>}
                                  {isScanning ? 'در حال تحلیل تصویر...' : 'اسکن هوشمند برگه (AI-OCR)'}
                              </button>
                          </div>
                      </div>

                      {/* Form Area */}
                      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                          {/* Results Table */}
                          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6 shadow-sm">
                              <table className="w-full text-right text-sm">
                                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-500">
                                      <tr>
                                          <th className="p-3 w-10">#</th>
                                          <th className="p-3">نام تست (Analyte)</th>
                                          <th className="p-3 w-24">نتیجه</th>
                                          <th className="p-3 w-24">واحد</th>
                                          <th className="p-3 w-32">رنج نرمال</th>
                                          <th className="p-3 w-24">وضعیت</th>
                                          <th className="p-3 w-10"></th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                      {rows.map((row, idx) => (
                                          <tr key={idx} className="group hover:bg-purple-50/30">
                                              <td className="p-3 text-center text-gray-300 font-bold">{idx + 1}</td>
                                              <td className="p-1">
                                                  <input 
                                                    className="w-full p-2 rounded border-transparent focus:border-purple-300 focus:bg-white bg-transparent outline-none font-bold text-gray-700 ltr text-left"
                                                    value={row.testName}
                                                    onChange={e => handleRowChange(idx, 'testName', e.target.value)}
                                                    placeholder="Test Name"
                                                  />
                                              </td>
                                              <td className="p-1">
                                                  <input 
                                                    className="w-full p-2 rounded border-transparent focus:border-purple-300 focus:bg-white bg-transparent outline-none font-bold text-gray-900 ltr text-center"
                                                    value={row.result}
                                                    onChange={e => handleRowChange(idx, 'result', e.target.value)}
                                                    placeholder="0.0"
                                                  />
                                              </td>
                                              <td className="p-1">
                                                  <input 
                                                    className="w-full p-2 rounded border-transparent focus:border-purple-300 focus:bg-white bg-transparent outline-none text-gray-500 ltr text-center text-xs"
                                                    value={row.unit}
                                                    onChange={e => handleRowChange(idx, 'unit', e.target.value)}
                                                    placeholder="Unit"
                                                  />
                                              </td>
                                              <td className="p-1">
                                                  <input 
                                                    className="w-full p-2 rounded border-transparent focus:border-purple-300 focus:bg-white bg-transparent outline-none text-gray-500 ltr text-center text-xs"
                                                    value={row.normalRange}
                                                    onChange={e => handleRowChange(idx, 'normalRange', e.target.value)}
                                                    placeholder="Range"
                                                  />
                                              </td>
                                              <td className="p-1">
                                                  <select 
                                                    className={`w-full p-2 rounded outline-none font-bold text-xs ${row.flag === 'H' ? 'bg-red-100 text-red-700' : row.flag === 'L' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}
                                                    value={row.flag}
                                                    onChange={e => handleRowChange(idx, 'flag', e.target.value as any)}
                                                  >
                                                      <option value="N">نرمال</option>
                                                      <option value="H">High (H)</option>
                                                      <option value="L">Low (L)</option>
                                                      <option value="A">Abnormal</option>
                                                  </select>
                                              </td>
                                              <td className="p-1 text-center">
                                                  <button onClick={() => removeRow(idx)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                      <Trash2 size={16} />
                                                  </button>
                                              </td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                              <button onClick={addRow} className="w-full py-2 bg-gray-50 text-gray-500 text-xs font-bold hover:bg-gray-100 transition-colors flex items-center justify-center gap-1 border-t border-gray-100">
                                  <Plus size={14} /> افزودن ردیف
                              </button>
                          </div>

                          {/* Panic Alert */}
                          {rows.some(r => r.flag === 'H' || r.flag === 'L' || r.flag === 'A') && (
                              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 mb-6 animate-pulse-slow">
                                  <AlertTriangle className="text-red-600 mt-1" />
                                  <div>
                                      <h4 className="font-bold text-red-800">هشدار مقادیر بحرانی</h4>
                                      <p className="text-xs text-red-600 mt-1">برخی نتایج خارج از محدوده نرمال هستند. لطفاً قبل از تایید نهایی دقت کنید.</p>
                                  </div>
                              </div>
                          )}

                          <div className="mb-6">
                              <label className="block text-sm font-bold text-gray-700 mb-2">یادداشت تکنسین</label>
                              <textarea 
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                className="w-full h-24 p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-200 outline-none resize-none"
                                placeholder="توضیحات اضافی..."
                              />
                          </div>
                      </div>

                      {/* Footer */}
                      <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                          <button onClick={() => setSelectedRequest(null)} className="px-6 py-3 text-gray-500 font-bold hover:bg-gray-200 rounded-xl">انصراف</button>
                          <button 
                            onClick={handleSubmit}
                            disabled={isLoading}
                            className="bg-purple-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-purple-700 shadow-lg shadow-purple-200 flex items-center gap-2"
                          >
                              {isLoading ? <Loader className="animate-spin"/> : <Save size={18} />}
                              ثبت و ارسال به پزشک
                          </button>
                      </div>
                  </div>
              ) : activeTab === 'WORKLIST' ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50">
                      <TestTube size={64} className="mb-4 opacity-20"/>
                      <p>یک آزمایش را از لیست انتخاب کنید.</p>
                  </div>
              ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50">
                      <Printer size={64} className="mb-4 opacity-20"/>
                      <p>جهت چاپ گزارش، یک مورد را از آرشیو انتخاب کنید.</p>
                  </div>
              )}
          </div>
      </div>

      {/* PRINT PREVIEW MODAL */}
      {showPrintModal && printRequest && (
          <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm flex flex-col z-[200] print-modal-container">
               <div className="bg-slate-800 text-white p-4 flex justify-between items-center z-50 shadow-md preview-toolbar no-print">
                    <h3 className="font-bold flex items-center gap-2 text-lg"><Printer size={20}/> پیش‌نمایش گزارش آزمایشگاه</h3>
                    <div className="flex gap-3">
                        <button onClick={() => setShowPrintModal(false)} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg font-bold">بستن</button>
                        <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2"><Printer size={18}/> چاپ</button>
                    </div>
               </div>

               <div className="flex-1 overflow-auto flex justify-center p-8 screen-preview-container">
                   <div className="paper-sheet bg-white w-[210mm] min-h-[297mm] p-[10mm] text-black shadow-lg relative flex flex-col">
                        {/* Print Header */}
                        <div className="flex justify-between items-center border-b-2 border-purple-800 pb-4 mb-6">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 bg-purple-600 text-white flex items-center justify-center rounded-lg">
                                    <TestTube size={32} />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-black text-gray-900">آزمایشگاه تشخیص طبی دکتریار</h1>
                                    <p className="text-sm text-gray-500">Dr.Yar Clinical Laboratory</p>
                                </div>
                            </div>
                            <div className="text-left text-sm">
                                <p><span className="font-bold">تاریخ:</span> {new Date(printRequest.createdAt).toLocaleDateString('fa-IR')}</p>
                                <p><span className="font-bold">شماره پذیرش:</span> {printRequest.id.substring(0,8).toUpperCase()}</p>
                            </div>
                        </div>

                        {/* Patient Info */}
                        <div className="bg-gray-100 p-4 rounded-lg mb-8 grid grid-cols-2 gap-4 text-sm border border-gray-200">
                             <div><span className="font-bold text-gray-500">نام بیمار:</span> <span className="text-lg font-bold">{printRequest.patientName}</span></div>
                             <div><span className="font-bold text-gray-500">پزشک معالج:</span> <span className="font-bold">{printRequest.doctorName}</span></div>
                             <div><span className="font-bold text-gray-500">نوع آزمایش:</span> <span className="font-bold text-purple-700">{printRequest.testName}</span></div>
                        </div>

                        {/* Results Table */}
                        <div className="flex-1">
                            <table className="w-full text-sm text-right">
                                <thead className="border-b-2 border-black">
                                    <tr>
                                        <th className="py-2 text-left ltr w-1/3">Test Name</th>
                                        <th className="py-2 text-center ltr">Result</th>
                                        <th className="py-2 text-center ltr">Unit</th>
                                        <th className="py-2 text-center ltr">Reference Range</th>
                                        <th className="py-2 text-center ltr">Flag</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {(printRequest.structuredResults || []).map((row, i) => (
                                        <tr key={i}>
                                            <td className="py-3 font-bold ltr text-left">{row.testName}</td>
                                            <td className="py-3 font-bold ltr text-center text-lg">{row.result}</td>
                                            <td className="py-3 ltr text-center text-gray-500">{row.unit}</td>
                                            <td className="py-3 ltr text-center text-gray-500">{row.normalRange}</td>
                                            <td className="py-3 ltr text-center font-bold">
                                                {row.flag === 'H' && <span className="text-red-600">HIGH</span>}
                                                {row.flag === 'L' && <span className="text-blue-600">LOW</span>}
                                                {row.flag === 'A' && <span className="text-amber-600">ABNORMAL</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Footer */}
                        <div className="mt-auto pt-8 border-t-2 border-gray-200 grid grid-cols-2 gap-10">
                             <div>
                                 <p className="font-bold text-sm mb-2">یادداشت:</p>
                                 <p className="text-sm text-gray-600 italic">{printRequest.technicianNotes || '---'}</p>
                             </div>
                             <div className="text-center">
                                 <div className="h-16 mb-2"></div>
                                 <div className="border-t border-gray-400 w-2/3 mx-auto"></div>
                                 <p className="text-xs font-bold text-gray-400 mt-1">امضای مسئول فنی آزمایشگاه</p>
                             </div>
                        </div>
                   </div>
               </div>
          </div>
      )}
    </div>
  );
};
