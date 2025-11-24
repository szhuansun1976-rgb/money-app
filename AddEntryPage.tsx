
import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Mic, Image as ImageIcon, PenTool, Check, Loader2, X, Plus, Trash2 } from 'lucide-react';
import { Entry, EntryType, INCOME_CATEGORIES, MediaAttachment, Category } from '../types.ts';
import * as storageService from '../services/storageService.ts';
import DrawingCanvas from '../components/DrawingCanvas.tsx';

const AddEntryPage: React.FC = () => {
  const { id } = useParams<{ id: string }>(); // Get ID from URL if editing
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Form State
  const [type, setType] = useState<EntryType>('expense');
  const [amount, setAmount] = useState<string>('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [media, setMedia] = useState<MediaAttachment[]>([]);
  const [entryDate, setEntryDate] = useState<string>(new Date().toISOString());

  // Dynamic Categories
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);

  // UI State
  const [showDrawing, setShowDrawing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingEntry, setIsLoadingEntry] = useState(!!id);

  // Refs for recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const activeStreamRef = useRef<MediaStream | null>(null);

  // Load categories and existing entry if ID is present
  useEffect(() => {
    const loadData = () => {
      // 1. Load Categories
      try {
        const cats = storageService.getCategories() || [];
        setExpenseCategories(cats);
        
        // 2. If ID exists, Load Entry
        if (id) {
          const existingEntry = storageService.getEntry(id);
          if (existingEntry) {
            setType(existingEntry.type);
            setAmount(existingEntry.amount > 0 ? existingEntry.amount.toString() : '');
            setContent(existingEntry.content);
            setCategory(existingEntry.category);
            setMedia(existingEntry.media || []);
            setEntryDate(existingEntry.date);
          } else {
            // Entry not found (maybe deleted)
            navigate('/');
          }
        }
      } catch (err) {
        console.error('Failed to load data', err);
      } finally {
        setIsLoadingEntry(false);
      }
    };

    loadData();
  }, [id, navigate]);

  // Handle default category selection only for NEW entries or when category is unset
  useEffect(() => {
    if (isLoadingEntry) return; // Don't override while loading
    if (id && category) return; // Don't override existing category in edit mode

    if (type === 'expense') {
      if (expenseCategories.length > 0) {
        // Check if current category is valid for expense
        const isValid = expenseCategories.some(c => c.name === category);
        if (!isValid) setCategory(expenseCategories[0].name);
      } else {
        setCategory('其他');
      }
    } else if (type === 'income') {
        if (!INCOME_CATEGORIES.includes(category)) setCategory(INCOME_CATEGORIES[0]);
    } else {
      setCategory('笔记');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, expenseCategories, isLoadingEntry]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
        if (activeStreamRef.current) {
          activeStreamRef.current.getTracks().forEach(t => t.stop());
        }
      } catch (e) {
        // ignore
      } finally {
        mediaRecorderRef.current = null;
        activeStreamRef.current = null;
      }
    };
  }, []);

  const handleSave = () => {
    if (isSaving) return;
    if (type !== 'note' && !amount) return;
    // Basic validation for amount
    let numericAmount = 0;
    if (type !== 'note') {
      numericAmount = Number(amount);
      if (Number.isNaN(numericAmount)) {
        alert('请输入有效金额');
        return;
      }
    }

    setIsSaving(true);
    try {
      const entryData: Entry = {
        id: id || storageService.generateId(), // Use existing ID if editing
        type,
        amount: type === 'note' ? 0 : numericAmount,
        category: type === 'note' ? '笔记' : category || (type === 'income' ? INCOME_CATEGORIES[0] : (expenseCategories[0]?.name ?? '其他')),
        tags: [],
        content,
        date: entryDate,
        media
      };

      if (id) {
        storageService.updateEntry(entryData);
      } else {
        storageService.saveEntry(entryData);
      }
      navigate('/');
    } catch (err) {
      console.error('Save failed', err);
      alert('保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (!id) return;
    if (confirm('确定要删除这条记录吗？此操作无法撤销。')) {
      storageService.deleteEntry(id);
      navigate('/');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    fileArray.forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setMedia(prev => [...prev, {
          id: storageService.generateId(),
          type: 'image',
          data: dataUrl
        }]);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      activeStreamRef.current = stream;

      let mimeType = '';
      if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mimeType = 'audio/ogg;codecs=opus';
      }

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        // Explicit cast to BlobEvent to resolve inference issues
        const event = e as BlobEvent;
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        try {
          const parts = chunksRef.current || [];
          // Ensure safe access to properties
          const blobType = parts.length > 0 && parts[0] ? (parts[0] as any).type : 'audio/webm';
          const blob = new Blob(parts, { type: blobType });
          const reader = new FileReader();
          reader.onloadend = () => {
            setMedia(prev => [...prev, {
              id: storageService.generateId(),
              type: 'audio',
              data: reader.result as string
            }]);
          };
          reader.readAsDataURL(blob as Blob);
        } catch (err) {
          console.error('Recording processing failed', err);
        } finally {
          if (activeStreamRef.current) {
            activeStreamRef.current.getTracks().forEach(t => t.stop());
            activeStreamRef.current = null;
          }
          mediaRecorderRef.current = null;
          chunksRef.current = [];
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Microphone access denied', err);
      alert('无法访问麦克风，请检查权限。');
      setIsRecording(false);
    }
  };

  const removeMedia = (id: string) => {
    setMedia(prev => prev.filter(m => m.id !== id));
  };

  const typeLabels: Record<string, string> = {
      expense: '支出',
      income: '收入',
      note: '笔记'
  };

  if (isLoadingEntry) {
      return (
          <div className="min-h-screen bg-white flex items-center justify-center">
              <Loader2 className="animate-spin text-indigo-600" size={32} />
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-white pb-32">
      {/* Header */}
      <div 
        className="px-6 pb-6 flex justify-between items-center bg-white sticky top-0 z-20 transition-all"
        style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top) + 10px)' }}
      >
        <h1 className="text-2xl font-bold text-slate-800">{id ? '编辑' : '记一笔'}</h1>
        <div className="flex items-center gap-2">
            {id && (
                <button 
                    onClick={handleDelete} 
                    className="text-slate-400 hover:text-red-500 p-2 bg-slate-50 rounded-full transition-colors"
                    aria-label="删除"
                >
                    <Trash2 size={20} />
                </button>
            )}
            <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-slate-600 p-2">
                <X size={24} />
            </button>
        </div>
      </div>

      <div className="px-6 space-y-6">
        {/* Type Toggle */}
        <div className="flex bg-slate-100 p-1 rounded-xl">
          {(['expense', 'income', 'note'] as EntryType[]).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex-1 py-3 text-sm font-medium rounded-lg capitalize transition-all ${
                type === t ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {typeLabels[t]}
            </button>
          ))}
        </div>

        <div className="space-y-6">
          {type !== 'note' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
               <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">金额</label>
               <div className="relative">
                 <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-400">¥</span>
                 <input
                   type="number"
                   inputMode="decimal"
                   value={amount}
                   onChange={(e) => setAmount(e.target.value)}
                   className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-10 pr-4 text-3xl font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                   placeholder="0.00"
                 />
               </div>
            </div>
          )}

          <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 delay-75">
            <div className="flex justify-between items-end mb-1">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {type === 'note' ? '笔记内容' : '备注'}
                </label>
            </div>
            
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full bg-slate-50 border-none rounded-2xl p-4 text-lg text-slate-700 min-h-[120px] focus:ring-2 focus:ring-indigo-500 outline-none resize-none transition-all"
              placeholder={type === 'note' ? "写下你的想法或粘贴文本..." : "这是什么消费？(例如：团队午餐)"}
            />
          </div>

          {/* Categories */}
          {type !== 'note' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">分类</label>
                {type === 'expense' && (
                    <button 
                        onClick={() => navigate('/settings')}
                        className="text-xs text-indigo-600 font-medium flex items-center hover:bg-indigo-50 px-2 py-1 rounded transition-colors"
                    >
                        <Plus size={12} className="mr-1"/> 编辑
                    </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {type === 'expense' ? (
                   expenseCategories.map(c => (
                    <button
                        key={c.id}
                        onClick={() => setCategory(c.name)}
                        className={`px-4 py-2 rounded-full text-xs font-medium border transition-all active:scale-95 ${
                        category === c.name 
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200' 
                            : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                        }`}
                    >
                        {c.name}
                    </button>
                   ))
                ) : (
                    INCOME_CATEGORIES.map(c => (
                        <button
                          key={c}
                          onClick={() => setCategory(c)}
                          className={`px-4 py-2 rounded-full text-xs font-medium border transition-all active:scale-95 ${
                            category === c 
                              ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-200' 
                              : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-300'
                          }`}
                        >
                          {c}
                        </button>
                      ))
                )}
              </div>
            </div>
          )}

          {/* Attachments Toolbar */}
          <div className="flex gap-4 py-2 animate-in fade-in slide-in-from-bottom-5 duration-500 delay-150">
            <button onClick={() => fileInputRef.current?.click()} className="p-3 rounded-full bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
              <ImageIcon size={20} />
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleImageUpload}
                multiple
              />
            </button>
            
            <button 
                onClick={toggleRecording} 
                className={`p-3 rounded-full transition-colors ${isRecording ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'}`}
            >
              <Mic size={20} />
            </button>

            <button 
                onClick={() => setShowDrawing(!showDrawing)} 
                className={`p-3 rounded-full transition-colors ${showDrawing ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'}`}
            >
              <PenTool size={20} />
            </button>
          </div>

          {/* Drawing Area */}
          {showDrawing && (
            <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                <DrawingCanvas onSave={(data) => {
                    if (data) {
                        setMedia(prev => [...prev, { id: storageService.generateId(), type: 'drawing', data }]);
                    }
                    setShowDrawing(false);
                }} />
            </div>
          )}

          {/* Media Preview List */}
          {media.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
                {media.map(m => (
                    <div key={m.id} className="relative group aspect-square rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                        {m.type === 'image' || m.type === 'drawing' ? (
                            <img src={m.data} alt="attachment" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                                <Mic size={24} />
                                <span className="text-[10px] mt-1">语音</span>
                            </div>
                        )}
                        <button 
                            onClick={() => removeMedia(m.id)}
                            className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white opacity-100 transition-opacity"
                        >
                            <X size={12} />
                        </button>
                    </div>
                ))}
            </div>
          )}
          
          {/* Prominent Delete Button for Existing Entries */}
          {id && (
              <div className="pt-4 pb-2">
                  <button 
                      onClick={handleDelete}
                      className="w-full py-3 text-red-500 font-medium bg-red-50 rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center gap-2 active:scale-[0.98]"
                  >
                      <Trash2 size={18} />
                      删除此记录
                  </button>
              </div>
          )}
        </div>
      </div>

      {/* Save Button - Fixed Position with safe-area support */}
      <div className="fixed left-0 right-0 px-6 pointer-events-none z-[60] flex justify-center" style={{ bottom: 'calc(env(safe-area-inset-bottom, 16px) + 20px)' }}>
        <div className="w-full max-w-md pointer-events-auto">
          <button
            onClick={handleSave}
            disabled={isSaving || (type !== 'note' && !amount)}
            className={`w-full py-4 rounded-2xl font-bold text-lg shadow-xl flex justify-center items-center transition-all transform active:scale-95 ${
                (isSaving || (type !== 'note' && !amount)) 
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                : 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-300/50'
            }`}
          >
            {isSaving ? <Loader2 className="animate-spin mr-2" size={18} /> : <Check className="mr-2" strokeWidth={3} size={20} />}
            <span>{id ? '更新' : '保存'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddEntryPage;
