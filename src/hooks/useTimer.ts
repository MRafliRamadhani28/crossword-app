// src/hooks/useTimer.ts
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export function useTimer(initialSeconds: number) {
  const [timeRemaining, setTimeRemaining] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const onExpireRef = useRef<(() => void) | null>(null);

  const start = useCallback((seconds?: number, onExpire?: () => void) => {
    if (seconds !== undefined) setTimeRemaining(seconds);
    if (onExpire) onExpireRef.current = onExpire;
    setIsRunning(true);
  }, []);

  const stop = useCallback(() => {
    setIsRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const reset = useCallback((seconds?: number) => {
    stop();
    setTimeRemaining(seconds ?? initialSeconds);
  }, [stop, initialSeconds]);

  useEffect(() => {
    if (!isRunning) return;

    intervalRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          onExpireRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  const percentage = initialSeconds > 0 ? (timeRemaining / initialSeconds) * 100 : 0;
  const isUrgent = timeRemaining <= 5 && timeRemaining > 0;
  const isDanger = timeRemaining <= 10 && timeRemaining > 0;

  return { timeRemaining, isRunning, percentage, isUrgent, isDanger, start, stop, reset };
}
