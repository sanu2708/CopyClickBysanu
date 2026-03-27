/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Search, 
  Copy, 
  Trash2, 
  Image as ImageIcon, 
  Type, 
  Link as LinkIcon, 
  Check,
  X,
  Clipboard,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type ClickType = 'text' | 'image' | 'link';

interface Click {
  id: string;
  type: ClickType;
  content: string;
  title?: string;
  createdAt: number;
  tags: string[];
}

export default function App() {
  const [clicks, setClicks] = useState<Click[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newClickContent, setNewClickContent] = useState('');
  const [newClickTitle, setNewClickTitle] = useState('');
  const [newClickType, setNewClickType] = useState<ClickType>('text');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | ClickType>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Load clicks from localStorage
  useEffect(() => {
    const savedClicks = localStorage.getItem('copyclick_clicks');
    if (savedClicks) {
      try {
        setClicks(JSON.parse(savedClicks));
      } catch (e) {
        console.error('Failed to parse saved clicks', e);
      }
    }
  }, []);

  // Save clicks to localStorage
  useEffect(() => {
    localStorage.setItem('copyclick_clicks', JSON.stringify(clicks));
  }, [clicks]);

  const handleAddClick = () => {
    if (!newClickContent.trim()) {
      toast.error('Please enter some content');
      return;
    }

    const newClick: Click = {
      id: crypto.randomUUID(),
      type: newClickType,
      content: newClickContent,
      title: newClickTitle || (newClickType === 'text' ? newClickContent.slice(0, 20) + '...' : 'Untitled Click'),
      createdAt: Date.now(),
      tags: selectedTags,
    };

    setClicks([newClick, ...clicks]);
    setNewClickContent('');
    setNewClickTitle('');
    setIsAdding(false);
    toast.success('Click saved!');
  };

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setClicks(clicks.filter(c => c.id !== id));
    toast.info('Click deleted');
  };

  const handleCopyClick = async (click: Click) => {
    try {
      if (click.type === 'image') {
        const response = await fetch(click.content);
        const blob = await response.blob();
        await navigator.clipboard.write([
          new ClipboardItem({
            [blob.type]: blob
          })
        ]);
      } else {
        await navigator.clipboard.writeText(click.content);
      }
      toast.success('Copied to clipboard!', {
        icon: <Check className="w-4 h-4 text-green-500" />,
      });
    } catch (err) {
      console.error('Failed to copy: ', err);
      toast.error('Failed to copy');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewClickContent(reader.result as string);
        setNewClickType('image');
        if (!newClickTitle) setNewClickTitle(file.name);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleExport = () => {
    if (clicks.length === 0) {
      toast.error('No clicks to export');
      return;
    }
    const dataStr = JSON.stringify(clicks, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `copyclick_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Exported successfully!');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedClicks = JSON.parse(event.target.result as string);
        if (!Array.isArray(importedClicks)) throw new Error('Invalid format');
        
        const existingIds = new Set(clicks.map(c => c.id));
        const newClicks = importedClicks.filter((c: any) => c.id && !existingIds.has(c.id));
        
        if (newClicks.length === 0) {
          toast.info('No new clicks found in file');
        } else {
          setClicks(prev => [...newClicks, ...prev]);
          toast.success(`Imported ${newClicks.length} new clicks!`);
        }
      } catch (err) {
        toast.error('Failed to import: Invalid JSON file');
      }
      if (importInputRef.current) importInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
            setNewClickContent(reader.result as string);
            setNewClickType('image');
            if (!newClickTitle) setNewClickTitle(`Pasted Image ${new Date().toLocaleTimeString()}`);
          };
          reader.readAsDataURL(file);
        }
        e.preventDefault();
        break;
      }
    }
  };

  const filteredClicks = clicks.filter(click => {
    const matchesSearch = 
      click.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      click.content.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesTab = activeTab === 'all' || click.type === activeTab;
    
    return matchesSearch && matchesTab;
  });

  return (
    <div className="w-[400px] h-[550px] overflow-y-auto bg-[#121212] custom-scrollbar">
      <Toaster position="top-center" richColors />
      
      <div className="p-4 pt-3">
        {/* Header */}
        <header className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <img src="/icons/icon48.png" alt="Copyclick Logo" className="w-7 h-7" />
              Copyclick
            </h1>
            <p className="text-gray-500 text-[9px] uppercase tracking-widest font-bold">by Sanu Singh</p>
          </div>
          <button 
            onClick={() => setIsAdding(true)}
            className="bg-orange-500 hover:bg-orange-600 text-white p-1.5 rounded-xl shadow-lg transition-transform active:scale-95"
          >
            <Plus className="w-5 h-5" />
          </button>
        </header>

      {/* Search Bar */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
        <input 
          type="text"
          placeholder="Search your clicks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#1e1e1e] border border-white/10 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all shadow-sm"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-3 px-1 overflow-x-auto no-scrollbar">
        {[
          { id: 'all', label: 'All', icon: Clipboard },
          { id: 'text', label: 'Texts', icon: Type },
          { id: 'image', label: 'Images', icon: ImageIcon },
          { id: 'link', label: 'Links', icon: LinkIcon },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
              activeTab === tab.id 
                ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" 
                : "bg-[#1e1e1e] text-gray-500 hover:text-gray-300 border border-white/5"
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Add Click Modal/Overlay */}
      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setIsAdding(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-[#1e1e1e] border border-white/10 rounded-3xl w-full max-w-md p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white">New Click</h2>
                <button onClick={() => setIsAdding(false)} className="text-gray-500 hover:text-gray-300">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Title (Optional)</label>
                  <input 
                    type="text"
                    placeholder="e.g. My Bio, Work Link..."
                    value={newClickTitle}
                    onChange={(e) => setNewClickTitle(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl bg-[#2d2d2d] border border-white/10 text-white focus:outline-none focus:border-orange-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Content</label>
                  {newClickType === 'image' ? (
                    <div className="relative group">
                      <img src={newClickContent} className="w-full h-40 object-cover rounded-xl border border-white/10" />
                      <button 
                        onClick={() => {setNewClickContent(''); setNewClickType('text');}}
                        className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <textarea 
                      placeholder="Paste your text or link here..."
                      value={newClickContent}
                      onPaste={handlePaste}
                      onChange={(e) => {
                        setNewClickContent(e.target.value);
                        if (e.target.value.startsWith('http')) setNewClickType('link');
                        else setNewClickType('text');
                      }}
                      rows={4}
                      className="w-full px-4 py-2 rounded-xl bg-[#2d2d2d] border border-white/10 text-white focus:outline-none focus:border-orange-500 transition-all resize-none"
                    />
                  )}
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border border-white/10 bg-[#2d2d2d] hover:bg-[#333333] transition-colors text-sm font-medium text-gray-300"
                  >
                    <ImageIcon className="w-4 h-4 text-blue-500" />
                    Image
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleImageUpload} 
                    accept="image/*" 
                    className="hidden" 
                  />
                  <button 
                    onClick={() => setNewClickType('text')}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border transition-colors text-sm font-medium",
                      newClickType === 'text' ? "bg-orange-500/10 border-orange-500/50 text-orange-500" : "border-white/10 bg-[#2d2d2d] hover:bg-[#333333] text-gray-300"
                    )}
                  >
                    <Type className="w-4 h-4" />
                    Text
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Quick Add</label>
                  <div className="flex flex-wrap gap-2">
                    {['©', '®', '™', '•', '→', '←', '↑', '↓', '★', '♥', '✓', '✗'].map(char => (
                      <button 
                        key={char}
                        onClick={() => setNewClickContent(prev => prev + char)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-white/10 bg-[#2d2d2d] hover:bg-[#333333] text-sm text-white"
                      >
                        {char}
                      </button>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={handleAddClick}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98] mt-4"
                >
                  Save Click
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Clicks Grid */}
      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredClicks.map((click) => (
            <motion.div
              layout
              key={click.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={() => handleCopyClick(click)}
              className="click-card group bg-[#1e1e1e] rounded-2xl p-2 border border-white/10 cursor-pointer flex items-center gap-3"
            >
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                click.type === 'text' ? "bg-blue-500/10 text-blue-500" : 
                click.type === 'image' ? "bg-purple-500/10 text-purple-500" : 
                "bg-green-500/10 text-green-500"
              )}>
                {click.type === 'text' && <Type className="w-5 h-5" />}
                {click.type === 'image' && <ImageIcon className="w-5 h-5" />}
                {click.type === 'link' && <LinkIcon className="w-5 h-5" />}
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-100 truncate text-sm">{click.title}</h3>
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {click.type === 'link' && (
                  <a 
                    href={click.content} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 hover:bg-white/10 rounded-lg text-gray-500 hover:text-orange-500 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <button 
                  onClick={(e) => handleDeleteClick(click.id, e)}
                  className="p-2 hover:bg-red-500/10 rounded-lg text-gray-500 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <div className="p-2 text-gray-600">
                  <Copy className="w-4 h-4" />
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredClicks.length === 0 && (
          <div className="text-center py-20">
            <div className="bg-[#1e1e1e] w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10">
              <Clipboard className="w-8 h-8 text-gray-600" />
            </div>
            <h3 className="text-gray-100 font-medium">No clicks found</h3>
            <p className="text-gray-500 text-sm">Start by adding your first click!</p>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <footer className="mt-8 text-center text-[10px] text-gray-500 pb-6">
        <div className="flex justify-center gap-3 mb-4">
          <button 
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e1e1e] border border-white/10 hover:bg-[#252525] transition-colors text-gray-400"
          >
            <ExternalLink className="w-3 h-3" />
            Export
          </button>
          <button 
            onClick={() => importInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e1e1e] border border-white/10 hover:bg-[#252525] transition-colors text-gray-400"
          >
            <Plus className="w-3 h-3 rotate-45" />
            Import
          </button>
          <input 
            type="file" 
            ref={importInputRef} 
            onChange={handleImport} 
            accept=".json" 
            className="hidden" 
          />
        </div>
        <p>Click a click to copy it instantly.</p>
        <p className="mt-1">Clicks are saved locally in your browser.</p>
      </footer>
      </div>
    </div>
  );
}
