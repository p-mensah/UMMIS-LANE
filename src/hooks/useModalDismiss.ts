import { useEffect } from 'react';

/**
 * Hook to handle modal keyboard dismissal (Escape key) and body scroll locking.
 */
export function useModalDismiss(isOpen: boolean, onClose: () => void) {
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);
}
