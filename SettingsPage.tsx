
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Tag, Info, Share, Download, Upload, ShieldCheck, FileJson } from 'lucide-react';
import { Category } from '../types.ts';
import * as storageService from '../services/storageService.ts';
import { COLORS } from '../constants.ts';

const SettingsPage: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = () => {
    setCategories(storageService.getCategories());
  };

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    
    // Pick a random color from the palette
    const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    
    const newCat: Category = {
      id: storageService.generateId(),
      name: newCategoryName.trim(),
      type: 'expense',
      color: randomColor
    };
    
    storageService.saveCategory(newCat);
    setNewCategoryName('');
    setIsAdding(false);
    loadCategories();
  };

  const handleDelete = (id: string) => {
    if (confirm('确定要删除这个分类吗？')) {
        storageService.deleteCategory(id);
        loadCategories();
    }
  };

  const handleExportBackup = () => {
    try {
        const jsonString = storageService.exportData();
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `ZenLedger_Backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (e) {
        alert('导出失败，请重试');
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const content = event.target?.result as string;
        if (confirm('⚠️ 警告：导入备份将【完全覆盖】当前的记账记录和分类设置。\n\n建议在覆盖前先导出当前数据。\n\n确定要继续恢复吗？')) {
             const success = storageService.importData(content);
             if (success) {
                 alert('✅ 数据恢复成功！');
                 loadCategories(); // Refresh categories
             } else {
                 alert('❌ 恢复失败：文件格式不正确或文件已损坏。');
             }
        }
        // Reset input to allow selecting the same file again if needed
        if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <div 
        className="bg-white px-6 pb-6 flex items-center shadow-sm sticky top-0 z-10 transition-all"
        style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top) + 10px)' }}
      >
        <button onClick={() => navigate(-1)} className="text-slate-500 hover:text-slate-800 mr-4">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-slate-800">设置</h1>
      </div>

      <div className="p-6 space-y-8">
        
        {/* iOS Installation Guide */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-5 rounded-2xl border border-blue-100">
            <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Download size={18} className="text-blue-600"/>
                安装到桌面 (iOS)
            </h3>
            <div className="space-y-3 text-sm text-slate-600">
                <ol className="list-decimal list-inside space-y-2 font-medium">
                    <li className="flex items-center gap-2">
                        Safari 中点击底部 <span className="bg-slate-200 p-1 rounded"><Share size={12} className="inline text-blue-600"/> 分享</span>
                    </li>
                    <li className="flex items-center gap-2">
                        选择 <span className="font-bold text-slate-800">"添加到主屏幕"</span>
                    </li>
                </ol>
            </div>
        </div>

        {/* Category Management Section */}
        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide flex items-center gap-2">
                    <Tag size={16} /> 消费分类
                </h2>
                <button 
                    onClick={() => setIsAdding(!isAdding)}
                    className="text-indigo-600 text-sm font-medium hover:text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full transition-colors"
                >
                    {isAdding ? '取消' : '+ 新增'}
                </button>
            </div>

            {/* Add New Form */}
            {isAdding && (
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-indigo-100 mb-4">
                    <label className="block text-xs font-semibold text-slate-400 mb-2">分类名称</label>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            autoFocus
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            placeholder="例如：奶茶"
                            className="flex-1 bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                        />
                        <button 
                            onClick={handleAddCategory}
                            disabled={!newCategoryName.trim()}
                            className="bg-indigo-600 text-white rounded-xl px-4 font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors"
                        >
                            <Plus size={20} />
                        </button>
                    </div>
                </div>
            )}

            {/* List */}
            <div className="space-y-3">
                {categories.map(cat => (
                    <div key={cat.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center group">
                        <div className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color }} />
                            <span className="font-medium text-slate-700">{cat.name}</span>
                        </div>
                        <button 
                            onClick={() => handleDelete(cat.id)}
                            className="text-slate-300 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-all"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                ))}
            </div>
        </div>

        {/* Data Backup Section */}
        <div>
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
                <ShieldCheck size={16} /> 数据安全
            </h2>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <button 
                    onClick={handleExportBackup}
                    className="w-full flex items-center p-4 hover:bg-slate-50 transition-colors border-b border-slate-100 text-left"
                >
                    <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600 mr-4">
                        <Download size={20} />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold text-slate-800">导出备份</h3>
                        <p className="text-xs text-slate-500">下载 .json 数据文件到本地</p>
                    </div>
                </button>
                
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center p-4 hover:bg-slate-50 transition-colors text-left relative"
                >
                    <div className="bg-orange-100 p-2 rounded-lg text-orange-600 mr-4">
                        <Upload size={20} />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold text-slate-800">恢复备份</h3>
                        <p className="text-xs text-slate-500">从 .json 文件导入数据 (会覆盖当前数据)</p>
                    </div>
                    {/* Hidden Input */}
                    <input 
                        type="file" 
                        ref={fileInputRef}
                        onChange={handleImportBackup}
                        accept=".json"
                        className="hidden" 
                    />
                </button>
            </div>
            
            <div className="mt-4 flex gap-2 text-xs text-slate-400 bg-slate-100 p-3 rounded-lg">
                <Info size={16} className="shrink-0" />
                <p>建议定期导出备份。数据仅存储在您的设备浏览器中，若清除缓存数据将会丢失。</p>
            </div>
        </div>

        {/* App Info */}
        <div className="text-center pt-8 pb-4">
             <div className="flex justify-center mb-2">
                <FileJson className="text-slate-300" size={32} />
             </div>
             <p className="text-xs text-slate-400">ZenLedger Local v1.1.0</p>
             <p className="text-[10px] text-slate-300 mt-1">Privacy Focused • Offline First</p>
        </div>

      </div>
    </div>
  );
};

export default SettingsPage;