'use client';

import { motion } from 'framer-motion';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  text?: string;
  fullScreen?: boolean;
}

const sizeMap = {
  sm: 'w-5 h-5',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
};

export function LoadingSpinner({ size = 'md', text, fullScreen = false }: LoadingSpinnerProps) {
  const spinnerSize = sizeMap[size];

  const spinner = (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className="relative">
        {/* Outer ring */}
        <motion.div
          className={`${spinnerSize} rounded-full border-2 border-zinc-700`}
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
        />
        {/* Inner spinning ring */}
        <motion.div
          className={`absolute inset-0 ${spinnerSize} rounded-full border-2 border-transparent border-t-yellow-400 border-r-yellow-400`}
          animate={{ rotate: 360 }}
          transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
        />
        {/* Pulsing center dot */}
        {size !== 'sm' && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            animate={{ scale: [0.5, 1, 0.5], opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="w-2 h-2 bg-yellow-400 rounded-full" />
          </motion.div>
        )}
      </div>
      {text && (
        <motion.p
          className="text-zinc-400 text-sm font-medium"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          {text}
        </motion.p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
        {spinner}
      </div>
    );
  }

  return spinner;
}

// Skeleton loading untuk card/placeholder
export function SkeletonCard() {
  return (
    <div className="glass-card p-4 relative overflow-hidden">
      <div className="flex items-center gap-2 mb-3">
        <motion.div
          className="w-6 h-6 bg-zinc-800 rounded"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        <motion.div
          className="h-4 bg-zinc-800 rounded w-20"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: 0.1 }}
        />
      </div>
      <div className="space-y-2">
        <motion.div className="h-8 bg-zinc-800 rounded w-full" animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }} />
        <motion.div className="h-8 bg-zinc-800 rounded w-full" animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }} />
        <motion.div className="h-8 bg-zinc-800 rounded w-3/4" animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }} />
      </div>
    </div>
  );
}

// Loading dots untuk inline text
export function LoadingDots() {
  return (
    <span className="inline-flex gap-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 bg-yellow-400 rounded-full"
          animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </span>
  );
}
