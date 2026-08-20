import { useEffect, useRef } from 'react';

const EDITABLE_SELECTOR = 'input, textarea, [contenteditable="true"]';

/**
 * Keeps a horizontally-scrollable table fixed while an editor receives focus
 * or its controlled value is updated. Manual horizontal scrolling remains enabled.
 */
export function useStableTableScroll<T extends HTMLElement = HTMLDivElement>() {
  const containerRef = useRef<T>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let lockedScrollLeft: number | null = null;
    let lockedWindowX: number | null = null;
    let lockedAncestorScroll: Array<{ element: HTMLElement; scrollLeft: number }> = [];
    let restoreFrame: number | null = null;
    let restoreFollowUpFrame: number | null = null;
    let releaseTimer: number | null = null;

    const isEditable = (target: EventTarget | null) =>
      target instanceof Element && Boolean(target.closest(EDITABLE_SELECTOR));

    const restore = () => {
      if (lockedScrollLeft === null) return;
      container.scrollLeft = lockedScrollLeft;
      lockedAncestorScroll.forEach(({ element, scrollLeft }) => {
        element.scrollLeft = scrollLeft;
      });
      if (lockedWindowX !== null && window.scrollX !== lockedWindowX) {
        window.scrollTo({ left: lockedWindowX, top: window.scrollY, behavior: 'auto' });
      }
    };

    const scheduleRestore = () => {
      restore();
      if (restoreFrame !== null) cancelAnimationFrame(restoreFrame);
      if (restoreFollowUpFrame !== null) cancelAnimationFrame(restoreFollowUpFrame);
      restoreFrame = requestAnimationFrame(() => {
        restore();
        restoreFollowUpFrame = requestAnimationFrame(restore);
      });
      if (releaseTimer !== null) window.clearTimeout(releaseTimer);
      // Controlled inputs may trigger layout/autosave work after React's next frames.
      // Keep enforcing the captured horizontal position through that entire cycle.
      releaseTimer = window.setTimeout(restore, 250);
    };

    const capturePosition = () => {
      lockedScrollLeft = container.scrollLeft;
      lockedWindowX = window.scrollX;
      lockedAncestorScroll = [];
      let parent = container.parentElement;
      while (parent) {
        if (parent.scrollWidth > parent.clientWidth) {
          lockedAncestorScroll.push({ element: parent, scrollLeft: parent.scrollLeft });
        }
        parent = parent.parentElement;
      }
    };

    const rememberBeforeFocus = (event: Event) => {
      if (isEditable(event.target)) capturePosition();
    };

    const handleFocus = (event: FocusEvent) => {
      if (!isEditable(event.target)) return;
      if (lockedScrollLeft === null) capturePosition();
      scheduleRestore();
    };

    const handleInput = (event: Event) => {
      if (isEditable(event.target)) scheduleRestore();
    };

    const handleFocusOut = (event: FocusEvent) => {
      if (isEditable(event.relatedTarget) && container.contains(event.relatedTarget as Node)) return;
      lockedScrollLeft = null;
      lockedWindowX = null;
      lockedAncestorScroll = [];
    };

    const handleScroll = () => {
      if (lockedScrollLeft !== null && isEditable(document.activeElement)) scheduleRestore();
    };

    container.addEventListener('pointerdown', rememberBeforeFocus, true);
    container.addEventListener('keydown', rememberBeforeFocus, true);
    container.addEventListener('focusin', handleFocus, true);
    container.addEventListener('beforeinput', handleInput, true);
    container.addEventListener('input', handleInput, true);
    container.addEventListener('focusout', handleFocusOut, true);
    container.addEventListener('scroll', handleScroll, true);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      if (restoreFrame !== null) cancelAnimationFrame(restoreFrame);
      if (restoreFollowUpFrame !== null) cancelAnimationFrame(restoreFollowUpFrame);
      if (releaseTimer !== null) window.clearTimeout(releaseTimer);
      container.removeEventListener('pointerdown', rememberBeforeFocus, true);
      container.removeEventListener('keydown', rememberBeforeFocus, true);
      container.removeEventListener('focusin', handleFocus, true);
      container.removeEventListener('beforeinput', handleInput, true);
      container.removeEventListener('input', handleInput, true);
      container.removeEventListener('focusout', handleFocusOut, true);
      container.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, []);

  return containerRef;
}