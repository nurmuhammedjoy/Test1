import { useCallback, useRef, useState } from 'react';

const DISPLAY_MS = 4000;

// Single-slot toast — a new message replaces whatever's currently showing
// instead of stacking, which keeps the mobile UI from getting cluttered.
export function useToast() {
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const timeoutRef = useRef(null);

  const showToast = useCallback((message, type = 'info') => {
    clearTimeout(timeoutRef.current);
    setToast({ show: true, message, type });
    timeoutRef.current = setTimeout(() => {
      setToast({ show: false, message: '', type: 'info' });
    }, DISPLAY_MS);
  }, []);

  return { toast, showToast };
}
