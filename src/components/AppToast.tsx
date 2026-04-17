import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, AlertCircle, Info, Loader2, X } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Props {
  isOpen: boolean;
  type: 'info' | 'success' | 'error' | 'loading';
  title?: string;
  message: string;
  isDarkMode: boolean;
  onClose: () => void;
  autoCloseMs?: number;
}

export default function AppToast({ isOpen, type, title, message, isDarkMode, onClose, autoCloseMs }: Props) {
  useEffect(() => {
    if (isOpen && autoCloseMs && type !== 'loading') {
      const t = setTimeout(onClose, autoCloseMs);
      return () => clearTimeout(t);
    }
  }, [isOpen, autoCloseMs, type, onClose]);

  const iconMap = {
    success: <CheckCircle className="w-6 h-6 text-emerald-500" />,
    error: <AlertCircle className="w-6 h-6 text-red-500" />,
    info: <Info className="w-6 h-6 text-blue-500" />,
    loading: <Loader2 className="w-6 h-6 text-graphite animate-spin" style={{ color: isDarkMode ? '#F5F0E8' : '#1a1a2e' }} />,
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-graphite/60 backdrop-blur-sm z-[500] flex items-center justify-center px-6"
          onClick={type !== 'loading' ? onClose : undefined}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "rounded-[2rem] p-6 max-w-xs w-full shadow-2xl border",
              isDarkMode
                ? "bg-graphite border-white/10"
                : "bg-cream border-graphite/5"
            )}
          >
            <div className="flex items-start gap-4">
              <div className="shrink-0 mt-0.5">
                {iconMap[type]}
              </div>
              <div className="flex-1 min-w-0">
                {title && (
                  <p className={cn("text-sm font-bold mb-1", isDarkMode ? "text-cream" : "text-graphite")}>
                    {title}
                  </p>
                )}
                <p className={cn("text-sm leading-relaxed", isDarkMode ? "text-cream/70" : "text-graphite/70")}>
                  {message}
                </p>
              </div>
            </div>
            {type !== 'loading' && (
              <div className="flex justify-end mt-5">
                <button
                  onClick={onClose}
                  className={cn(
                    "px-5 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all active:scale-95",
                    isDarkMode ? "bg-cream text-graphite" : "bg-graphite text-cream"
                  )}
                >
                  OK
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
