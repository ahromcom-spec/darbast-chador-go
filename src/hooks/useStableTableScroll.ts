import { useEffect, useRef } from 'react';

const EDITABLE_SELECTOR = 'input, textarea, [contenteditable="true"]';

type LockedScroll = { element: HTMLElement; left: number; top: number };

/**
 * Keeps a scrollable table completely still while an editor is focused or its
 * controlled value updates (both axes, including window scroll).
 * Manual scrolling by the user is still respected: any user gesture re-captures
 * the position instead of fighting it.
 */
export function useStableTableScroll<T extends HTMLElement = HTMLDivElement>() {
  const containerRef = useRef<T>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let locked: LockedScroll[] | null = null;
    let lockedWindow: { x: number; y: number } | null = null;
    let frames: number[] = [];
    let releaseTimer: number | null = null;
    let userGestureUntil = 0;

    const isEditable = (target: EventTarget | null) =>
      target instanceof Element && Boolean(target.closest(EDITABLE_SELECTOR));

    const capture = () => {
      const list: LockedScroll[] = [{ element: container, left: container.scrollLeft, top: container.scrollTop }];
      let parent: HTMLElement | null = container.parentElement;
      while (parent) {
        if (parent.scrollWidth > parent.clientWidth || parent.scrollHeight > parent.clientHeight) {
          list.push({ element: parent, left: parent.scrollLeft, top: parent.scrollTop });
        }
        parent = parent.parentElement;
      }
      locked = list;
      lockedWindow = { x: window.scrollX, y: window.scrollY };
    };

    const restore = () => {
      if (!locked || !lockedWindow) return;
      if (Date.now() < userGestureUntil) return;
      locked.forEach(({ element, left, top }) => {
        if (element.scrollLeft !== left) element.scrollLeft = left;
        if (element.scrollTop !== top) element.scrollTop = top;
      });
      if (window.scrollX !== lockedWindow.x || window.scrollY !== lockedWindow.y) {
        window.scrollTo({ left: lockedWindow.x, top: lockedWindow.y, behavior: 'auto' });
      }
    };

    const clearFrames = () => {
      frames.forEach((f) => cancelAnimationFrame(f));
      frames = [];
    };

    const scheduleRestore = () => {
      restore();
      clearFrames();
      // Enforce through React's re-render + layout cycles (several frames).
      let count = 0;
      const step = () => {
        restore();
        count += 1;
        if (count < 8) frames.push(requestAnimationFrame(step));
      };
      frames.push(requestAnimationFrame(step));
      if (releaseTimer !== null) window.clearTimeout(releaseTimer);
      releaseTimer = window.setTimeout(restore, 350);
    };

    const markUserGesture = () => {
      userGestureUntil = Date.now() + 500;
      // The user is scrolling on purpose: adopt the new position afterwards.
      window.setTimeout(() => {
        if (isEditable(document.activeElement)) capture();
      }, 520);
    };

    const rememberBeforeFocus = (event: Event) => {
      if (isEditable(event.target)) capture();
    };

    const handleFocus = (event: FocusEvent) => {
      if (!isEditable(event.target)) return;
      if (!locked) capture();
      scheduleRestore();
    };

    const handleInput = (event: Event) => {
      if (isEditable(event.target)) scheduleRestore();
    };

    const handleFocusOut = (event: FocusEvent) => {
      if (isEditable(event.relatedTarget) && container.contains(event.relatedTarget as Node)) return;
      locked = null;
      lockedWindow = null;
      clearFrames();
    };

    const handleScroll = () => {
      if (locked && isEditable(document.activeElement)) scheduleRestore();
    };

    container.addEventListener('pointerdown', rememberBeforeFocus, true);
    container.addEventListener('keydown', rememberBeforeFocus, true);
    container.addEventListener('focusin', handleFocus, true);
    container.addEventListener('beforeinput', handleInput, true);
    container.addEventListener('input', handleInput, true);
    container.addEventListener('change', handleInput, true);
    container.addEventListener('focusout', handleFocusOut, true);
    container.addEventListener('scroll', handleScroll, true);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('wheel', markUserGesture, { passive: true });
    window.addEventListener('touchmove', markUserGesture, { passive: true });

    return () => {
      clearFrames();
      if (releaseTimer !== null) window.clearTimeout(releaseTimer);
      container.removeEventListener('pointerdown', rememberBeforeFocus, true);
      container.removeEventListener('keydown', rememberBeforeFocus, true);
      container.removeEventListener('focusin', handleFocus, true);
      container.removeEventListener('beforeinput', handleInput, true);
      container.removeEventListener('input', handleInput, true);
      container.removeEventListener('change', handleInput, true);
      container.removeEventListener('focusout', handleFocusOut, true);
      container.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('wheel', markUserGesture);
      window.removeEventListener('touchmove', markUserGesture);
    };
  }, []);

  return containerRef;
}
