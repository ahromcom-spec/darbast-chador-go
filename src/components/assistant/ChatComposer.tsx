import { forwardRef, useImperativeHandle, useRef, useState, useCallback, memo } from 'react';
import { Input } from '@/components/ui/input';

export interface ChatComposerHandle {
  setValue: (v: string) => void;
  getValue: () => string;
  clear: () => void;
  focus: () => void;
}

interface Props {
  placeholder?: string;
  disabled?: boolean;
  onEnterSubmit: (text: string) => void;
  className?: string;
}

/**
 * Isolated composer: owns its own input state so parent's heavy tree
 * does NOT re-render on every keystroke (mobile typing lag fix).
 */
export const ChatComposer = memo(
  forwardRef<ChatComposerHandle, Props>(({ placeholder, disabled, onEnterSubmit, className }, ref) => {
    const [value, setValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      setValue: (v: string) => {
        setValue(v);
        // focus after value injection
        requestAnimationFrame(() => inputRef.current?.focus());
      },
      getValue: () => value,
      clear: () => setValue(''),
      focus: () => inputRef.current?.focus(),
    }), [value]);

    const onKey = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const t = value.trim();
        if (!t) return;
        setValue('');
        onEnterSubmit(t);
      }
    }, [value, onEnterSubmit]);

    return (
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKey}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />
    );
  }),
);

ChatComposer.displayName = 'ChatComposer';
