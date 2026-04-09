'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative inline-flex">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="cursor-help"
      >
        {children}
      </div>

      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl"
            style={{ width: '320px', whiteSpace: 'normal' }}
          >
            <p className="text-xs text-zinc-300 leading-relaxed">{content}</p>
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
              <div className="w-2 h-2 bg-zinc-900 border-r border-b border-zinc-700 rotate-45 transform -translate-y-1/2" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
