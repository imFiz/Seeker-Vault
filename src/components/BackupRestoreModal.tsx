import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, File, Settings, X, CheckSquare, Square } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { BackupEnvelope } from '../utils/backupService';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

interface Props {
  isOpen: boolean;
  envelope: BackupEnvelope | null;
  isDarkMode: boolean;
  onClose: () => void;
  onRestore: (sel: { noteIds: Set<string>; fileIds: Set<string>; includeSettings: boolean }) => Promise<void>;
}

type TabType = 'notes' | 'files' | 'settings';

export default function BackupRestoreModal({ isOpen, envelope, isDarkMode, onClose, onRestore }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>('notes');
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [includeSettings, setIncludeSettings] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Reset selections when envelope changes
  React.useEffect(() => {
    if (envelope) {
      setSelectedNoteIds(new Set(envelope.notes.map(n => n.id)));
      setSelectedFileIds(new Set(envelope.files.map(f => f.id)));
      setIncludeSettings(false);
      setActiveTab('notes');
    }
  }, [envelope]);

  if (!envelope) return null;

  const handleSelectAll = () => {
    if (activeTab === 'notes') {
      setSelectedNoteIds(new Set(envelope.notes.map(n => n.id)));
    } else if (activeTab === 'files') {
      setSelectedFileIds(new Set(envelope.files.map(f => f.id)));
    } else {
      setIncludeSettings(true);
    }
  };

  const handleDeselectAll = () => {
    if (activeTab === 'notes') {
      setSelectedNoteIds(new Set());
    } else if (activeTab === 'files') {
      setSelectedFileIds(new Set());
    } else {
      setIncludeSettings(false);
    }
  };

  const toggleNote = (id: string) => {
    setSelectedNoteIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleFile = (id: string) => {
    setSelectedFileIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      await onRestore({ noteIds: selectedNoteIds, fileIds: selectedFileIds, includeSettings });
    } finally {
      setIsRestoring(false);
    }
  };

  const totalSelected = selectedNoteIds.size + selectedFileIds.size + (includeSettings ? 1 : 0);

  const tabs: { id: TabType; label: string; icon: React.ReactNode; count: number }[] = [
    { id: 'notes', label: 'Notes', icon: <FileText className="w-4 h-4" />, count: envelope.notes.length },
    { id: 'files', label: 'Files', icon: <File className="w-4 h-4" />, count: envelope.files.length },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" />, count: 1 },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-graphite/80 backdrop-blur-sm z-[300] flex items-start justify-center overflow-y-auto"
          style={{ paddingTop: 'max(env(safe-area-inset-top, 48px), 48px)', paddingBottom: '1.5rem', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={e => e.stopPropagation()}
            className={cn(
              "bg-cream rounded-[2.5rem] p-6 max-w-sm w-full space-y-5 shadow-2xl border border-graphite/5 my-auto",
              isDarkMode && "bg-graphite-light border-white/10"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className={cn("text-xl font-serif italic", isDarkMode ? "text-cream" : "text-graphite")}>Restore Backup</h3>
                <p className={cn("text-[10px] uppercase tracking-widest", isDarkMode ? "text-cream/40" : "text-graphite/40")}>
                  {new Date(envelope.createdAt).toLocaleDateString()} · {envelope.itemCount.notes} notes, {envelope.itemCount.files} files
                </p>
              </div>
              <button
                onClick={onClose}
                className={cn("p-2 rounded-full", isDarkMode ? "bg-white/10" : "bg-graphite/5")}
              >
                <X className={cn("w-5 h-5", isDarkMode ? "text-cream" : "text-graphite")} />
              </button>
            </div>

            {/* Tabs */}
            <div className={cn("flex rounded-2xl p-1 gap-1", isDarkMode ? "bg-white/5" : "bg-graphite/5")}>
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all",
                    activeTab === tab.id
                      ? (isDarkMode ? "bg-cream text-graphite" : "bg-graphite text-cream")
                      : (isDarkMode ? "text-cream/50" : "text-graphite/50")
                  )}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  <span className={cn(
                    "text-[9px] rounded-full px-1",
                    activeTab === tab.id
                      ? (isDarkMode ? "bg-graphite/20 text-graphite" : "bg-white/20 text-cream")
                      : (isDarkMode ? "bg-white/10 text-cream/40" : "bg-graphite/10 text-graphite/40")
                  )}>{tab.count}</span>
                </button>
              ))}
            </div>

            {/* Select All / Deselect All */}
            <div className="flex gap-2">
              <button
                onClick={handleSelectAll}
                className={cn("flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider", isDarkMode ? "bg-white/10 text-cream" : "bg-graphite/10 text-graphite")}
              >
                Select All
              </button>
              <button
                onClick={handleDeselectAll}
                className={cn("flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider", isDarkMode ? "bg-white/5 text-cream/50" : "bg-graphite/5 text-graphite/50")}
              >
                Deselect All
              </button>
            </div>

            {/* Tab Content */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {activeTab === 'notes' && (
                envelope.notes.length === 0 ? (
                  <p className={cn("text-center text-xs py-8", isDarkMode ? "text-cream/30" : "text-graphite/30")}>No notes in backup</p>
                ) : (
                  envelope.notes.map(note => (
                    <button
                      key={note.id}
                      onClick={() => toggleNote(note.id)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-all",
                        isDarkMode ? "bg-white/5 hover:bg-white/10" : "bg-graphite/5 hover:bg-graphite/8"
                      )}
                    >
                      {selectedNoteIds.has(note.id)
                        ? <CheckSquare className={cn("w-4 h-4 shrink-0", isDarkMode ? "text-cream" : "text-graphite")} />
                        : <Square className={cn("w-4 h-4 shrink-0", isDarkMode ? "text-cream/30" : "text-graphite/30")} />
                      }
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-xs font-bold truncate", isDarkMode ? "text-cream" : "text-graphite")}>{note.title || 'Untitled'}</p>
                        <p className={cn("text-[9px] uppercase tracking-wide", isDarkMode ? "text-cream/40" : "text-graphite/40")}>
                          {note.category} · {new Date(note.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </button>
                  ))
                )
              )}

              {activeTab === 'files' && (
                envelope.files.length === 0 ? (
                  <p className={cn("text-center text-xs py-8", isDarkMode ? "text-cream/30" : "text-graphite/30")}>No files in backup</p>
                ) : (
                  envelope.files.map(file => (
                    <button
                      key={file.id}
                      onClick={() => toggleFile(file.id)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-all",
                        isDarkMode ? "bg-white/5 hover:bg-white/10" : "bg-graphite/5 hover:bg-graphite/8"
                      )}
                    >
                      {selectedFileIds.has(file.id)
                        ? <CheckSquare className={cn("w-4 h-4 shrink-0", isDarkMode ? "text-cream" : "text-graphite")} />
                        : <Square className={cn("w-4 h-4 shrink-0", isDarkMode ? "text-cream/30" : "text-graphite/30")} />
                      }
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-xs font-bold truncate", isDarkMode ? "text-cream" : "text-graphite")}>{file.name}</p>
                        <p className={cn("text-[9px] uppercase tracking-wide", isDarkMode ? "text-cream/40" : "text-graphite/40")}>
                          {formatSize(file.size)} · {new Date(file.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </button>
                  ))
                )
              )}

              {activeTab === 'settings' && (
                <button
                  onClick={() => setIncludeSettings(v => !v)}
                  className={cn(
                    "w-full flex items-center gap-3 p-4 rounded-2xl text-left transition-all",
                    isDarkMode ? "bg-white/5 hover:bg-white/10" : "bg-graphite/5 hover:bg-graphite/8"
                  )}
                >
                  {includeSettings
                    ? <CheckSquare className={cn("w-4 h-4 shrink-0", isDarkMode ? "text-cream" : "text-graphite")} />
                    : <Square className={cn("w-4 h-4 shrink-0", isDarkMode ? "text-cream/30" : "text-graphite/30")} />
                  }
                  <div>
                    <p className={cn("text-xs font-bold", isDarkMode ? "text-cream" : "text-graphite")}>Include Settings</p>
                    <p className={cn("text-[9px] uppercase tracking-wide", isDarkMode ? "text-cream/40" : "text-graphite/40")}>
                      Dark mode, auto-lock, security preferences
                    </p>
                  </div>
                </button>
              )}
            </div>

            {/* Footer buttons */}
            <div className="space-y-2 pt-2">
              <button
                onClick={handleRestore}
                disabled={isRestoring || totalSelected === 0}
                className={cn(
                  "w-full py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all",
                  isRestoring || totalSelected === 0
                    ? (isDarkMode ? "bg-white/10 text-cream/30" : "bg-graphite/10 text-graphite/30")
                    : (isDarkMode ? "bg-cream text-graphite" : "bg-graphite text-cream")
                )}
              >
                {isRestoring ? 'Restoring...' : `Restore Selected (${totalSelected})`}
              </button>
              <button
                onClick={onClose}
                className={cn(
                  "w-full py-3 rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all",
                  isDarkMode ? "bg-white/5 text-cream/60" : "bg-graphite/5 text-graphite/60"
                )}
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
