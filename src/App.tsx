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

type PickType = 'text' | 'image' | 'link';

interface Pick {
  id: string;
  type: PickType;
  content: string;
  title?: string;
  createdAt: number;
  tags: string[];
}

export default function App() {
  const [picks, setPicks] = useState<Pick[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newPickContent, setNewPickContent] = useState('');
  const [newPickTitle, setNewPickTitle] = useState('');
  const [newPickType, setNewPickType] = useState<PickType>('text');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load picks from localStorage
  useEffect(() => {
    const savedPicks = localStorage.getItem('clickpick_picks');
    if (savedPicks) {
      try {
        setPicks(JSON.parse(savedPicks));
      } catch (e) {
        console.error('Failed to parse saved picks', e);
      }
    }
  }, []);

  // Save picks to localStorage
  useEffect(() => {
    localStorage.setItem('clickpick_picks', JSON.stringify(picks));
  }, [picks]);

  const handleAddPick = () => {
    if (!newPickContent.trim()) {
      toast.error('Please enter some content');
      return;
    }

    const newPick: Pick = {
      id: crypto.randomUUID(),
      type: newPickType,
      content: newPickContent,
      title: newPickTitle || (newPickType === 'text' ? newPickContent.slice(0, 20) + '...' : 'Untitled Pick'),
      createdAt: Date.now(),
      tags: selectedTags,
    };

    setPicks([newPick, ...picks]);
    setNewPickContent('');
    setNewPickTitle('');
    setIsAdding(false);
    toast.success('Pick saved!');
  };

  const handleDeletePick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPicks(picks.filter(p => p.id !== id));
    toast.info('Pick deleted');
  };

  const handleCopyPick = async (pick: Pick) => {
    try {
      if (pick.type === 'image') {
        const response = await fetch(pick.content);
        const blob = await response.blob();
        await navigator.clipboard.write([
          new ClipboardItem({
            [blob.type]: blob
          })
        ]);
      } else {
        await navigator.clipboard.writeText(pick.content);
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
        setNewPickContent(reader.result as string);
        setNewPickType('image');
        if (!newPickTitle) setNewPickTitle(file.name);
      };
      reader.readAsDataURL(file);
    }
  };

  const filteredPicks = picks.filter(pick => 
    pick.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pick.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen max-w-2xl mx-auto p-4 md:p-8">
      <Toaster position="top-center" richColors />
      
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <Clipboard className="w-8 h-8 text-orange-500" />
            Copyclick by Sanu Singh
          </h1>
          <p className="text-gray-500 text-sm mt-1 italic">Your clipboard, reinvented.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white p-3 rounded-full shadow-lg transition-transform active:scale-95"
        >
          <Plus className="w-6 h-6" />
        </button>
      </header>

      {/* Search Bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input 
          type="text"
          placeholder="Search your picks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all shadow-sm"
        />
      </div>

      {/* Add Pick Modal/Overlay */}
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
              className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">New Pick</h2>
                <button onClick={() => setIsAdding(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Title (Optional)</label>
                  <input 
                    type="text"
                    placeholder="e.g. My Bio, Work Link..."
                    value={newPickTitle}
                    onChange={(e) => setNewPickTitle(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:border-orange-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Content</label>
                  {newPickType === 'image' ? (
                    <div className="relative group">
                      <img src={newPickContent} className="w-full h-40 object-cover rounded-xl border border-gray-200" />
                      <button 
                        onClick={() => {setNewPickContent(''); setNewPickType('text');}}
                        className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <textarea 
                      placeholder="Paste your text or link here..."
                      value={newPickContent}
                      onChange={(e) => {
                        setNewPickContent(e.target.value);
                        if (e.target.value.startsWith('http')) setNewPickType('link');
                        else setNewPickType('text');
                      }}
                      rows={4}
                      className="w-full px-4 py-2 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:border-orange-500 transition-all resize-none"
                    />
                  )}
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors text-sm font-medium"
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
                    onClick={() => setNewPickType('text')}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border transition-colors text-sm font-medium",
                      newPickType === 'text' ? "bg-orange-50 border-orange-200 text-orange-600" : "border-gray-200 hover:bg-gray-50"
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
                        onClick={() => setNewPickContent(prev => prev + char)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-sm"
                      >
                        {char}
                      </button>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={handleAddPick}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98] mt-4"
                >
                  Save Pick
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Picks Grid */}
      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredPicks.map((pick) => (
            <motion.div
              layout
              key={pick.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={() => handleCopyPick(pick)}
              className="pick-card group bg-white rounded-2xl p-4 border border-gray-100 cursor-pointer flex items-center gap-4"
            >
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                pick.type === 'text' ? "bg-blue-50 text-blue-500" : 
                pick.type === 'image' ? "bg-purple-50 text-purple-500" : 
                "bg-green-50 text-green-500"
              )}>
                {pick.type === 'text' && <Type className="w-6 h-6" />}
                {pick.type === 'image' && <ImageIcon className="w-6 h-6" />}
                {pick.type === 'link' && <LinkIcon className="w-6 h-6" />}
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 truncate">{pick.title}</h3>
                <p className="text-gray-500 text-sm truncate">
                  {pick.type === 'image' ? 'Image Pick' : pick.content}
                </p>
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {pick.type === 'link' && (
                  <a 
                    href={pick.content} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-orange-500 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <button 
                  onClick={(e) => handleDeletePick(pick.id, e)}
                  className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <div className="p-2 text-gray-300">
                  <Copy className="w-4 h-4" />
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredPicks.length === 0 && (
          <div className="text-center py-20">
            <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clipboard className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-gray-900 font-medium">No picks found</h3>
            <p className="text-gray-500 text-sm">Start by adding your first pick!</p>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <footer className="mt-12 text-center text-xs text-gray-400 pb-8">
        <p>Click a pick to copy it instantly.</p>
        <p className="mt-1">Picks are saved locally in your browser.</p>
      </footer>
    </div>
  );
}
