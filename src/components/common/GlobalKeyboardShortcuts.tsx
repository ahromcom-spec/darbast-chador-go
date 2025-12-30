import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const GlobalKeyboardShortcuts = () => {
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

        // Alt + Left Arrow - Go back (standard browser shortcut)
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

        // Escape - Try to close any open dialog
        if (e.key === 'Escape') {
          // Radix dialogs already handle Escape, but let's ensure focus management
          const openDialog = document.querySelector('[data-state="open"][role="dialog"]');
          if (openDialog) {
            const closeButton = openDialog.querySelector('[data-radix-dialog-close], button[aria-label*="Close"], button[aria-label*="بستن"]') as HTMLElement;
            if (closeButton) {
              closeButton.click();
              return;
            }
          }
        }
      }
    };

    // Handle mouse back/forward buttons
    const handleMouseNavigation = (e: MouseEvent) => {
      // Mouse button 3 = back, button 4 = forward (on some mice)
      if (e.button === 3) {
        e.preventDefault();
        if (window.history.length > 1) {
          navigate(-1);
        }
      } else if (e.button === 4) {
        e.preventDefault();
        navigate(1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mouseup', handleMouseNavigation);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mouseup', handleMouseNavigation);
    };
  }, [navigate]);

  // This component doesn't render anything
  return null;
};
