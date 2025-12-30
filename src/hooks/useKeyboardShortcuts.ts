import { useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface ShortcutConfig {
  // Enable/disable specific shortcuts
  enableBackNavigation?: boolean;
  enableEscape?: boolean;
  enableEnter?: boolean;
}

export const useKeyboardShortcuts = (config: ShortcutConfig = {}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    enableBackNavigation = true,
    enableEscape = true,
    enableEnter = true,
  } = config;

  // Go back to previous page
  const goBack = useCallback(() => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  }, [navigate]);

  // Go forward
  const goForward = useCallback(() => {
    navigate(1);
  }, [navigate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const tagName = target.tagName.toLowerCase();
      const isEditable = 
        tagName === 'input' || 
        tagName === 'textarea' || 
        target.isContentEditable ||
        target.getAttribute('role') === 'textbox';

      // Don't interfere with typing in inputs
      if (isEditable) {
        // Allow Escape to blur the input
        if (e.key === 'Escape' && enableEscape) {
          target.blur();
          return;
        }
        return;
      }

      // Backspace - Go back (when not in an input)
      if (e.key === 'Backspace' && enableBackNavigation && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        goBack();
        return;
      }

      // Alt + Left Arrow - Go back
      if (e.key === 'ArrowLeft' && e.altKey && enableBackNavigation) {
        e.preventDefault();
        goBack();
        return;
      }

      // Alt + Right Arrow - Go forward
      if (e.key === 'ArrowRight' && e.altKey && enableBackNavigation) {
        e.preventDefault();
        goForward();
        return;
      }

      // Escape - Close dialogs/modals (click on [data-state="open"] close buttons)
      if (e.key === 'Escape' && enableEscape) {
        // Try to find and click close buttons
        const closeButton = document.querySelector(
          '[data-state="open"] [data-radix-dialog-close], ' +
          '[data-state="open"] button[aria-label*="Close"], ' +
          '[data-state="open"] button[aria-label*="بستن"], ' +
          '.dialog-close-button'
        ) as HTMLElement;
        
        if (closeButton) {
          closeButton.click();
          return;
        }
      }

      // Enter - Click focused button or primary action
      if (e.key === 'Enter' && enableEnter && !e.ctrlKey && !e.metaKey) {
        // If a button is focused, let it handle the Enter key naturally
        if (tagName === 'button' || target.getAttribute('role') === 'button') {
          return;
        }

        // Find and click primary action button in dialogs
        const primaryButton = document.querySelector(
          '[data-state="open"] button[data-primary="true"], ' +
          '[data-state="open"] button.bg-primary, ' +
          '[data-state="open"] button[type="submit"]'
        ) as HTMLElement;
        
        if (primaryButton) {
          e.preventDefault();
          primaryButton.click();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enableBackNavigation, enableEscape, enableEnter, goBack, goForward]);

  return {
    goBack,
    goForward,
  };
};

// Global keyboard shortcuts hook for App level
export const useGlobalKeyboardShortcuts = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const tagName = target.tagName.toLowerCase();
      const isEditable = 
        tagName === 'input' || 
        tagName === 'textarea' || 
        target.isContentEditable;

      // Global shortcuts that work everywhere
      
      // Ctrl/Cmd + Home - Go to home page
      if ((e.ctrlKey || e.metaKey) && e.key === 'Home') {
        e.preventDefault();
        navigate('/');
        return;
      }

      // Shortcuts that only work when not editing
      if (!isEditable) {
        // Backspace - Go back
        if (e.key === 'Backspace' && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          if (window.history.length > 1) {
            navigate(-1);
          } else {
            navigate('/');
          }
          return;
        }

        // Alt + Left Arrow - Go back
        if (e.key === 'ArrowLeft' && e.altKey) {
          e.preventDefault();
          if (window.history.length > 1) {
            navigate(-1);
          }
          return;
        }

        // Alt + Right Arrow - Go forward
        if (e.key === 'ArrowRight' && e.altKey) {
          e.preventDefault();
          navigate(1);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [navigate]);
};
