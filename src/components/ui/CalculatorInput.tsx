import * as React from "react";
import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { isMathExpression, tryEval } from "@/lib/mathEvaluator";
import { toEnglishDigits } from "@/lib/numberParsing";

interface CalculatorInputProps {
  value: number;
  onChange: (value: number) => void;
  max?: number;
  maxError?: string;
  className?: string;
  placeholder?: string;
  dir?: string;
  suffix?: React.ReactNode;
}

/**
 * An input that supports calculator mode:
 * - Normal mode: accepts numbers with thousand separators
 * - Calculator mode: type "="/"＝" to start an expression like "=20000+5000"
 *   On blur or Enter, it evaluates and shows the result.
 *   While focused, shows the raw expression. When blurred, shows "=20000+5000=25000"
 */
export function CalculatorInput({
  value,
  onChange,
  max = 300000000,
  maxError = "مبلغ نمی‌تواند بیشتر از ۳۰۰ میلیون تومان باشد",
  className,
  placeholder = "0",
  dir = "ltr",
  suffix,
}: CalculatorInputProps) {
  const [rawText, setRawText] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [resolvedExpression, setResolvedExpression] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync display when value changes externally and not focused
  useEffect(() => {
    if (!isFocused) {
      if (resolvedExpression && value > 0) {
        // Keep showing the expression result
      } else {
        setRawText(value === 0 ? "" : value.toLocaleString("en-US"));
        setResolvedExpression(null);
      }
    }
  }, [value, isFocused]);

  const stripLeadingEquals = (input: string) => input.trim().replace(/^[=＝]+/, "");
  const isCalcMode = rawText.trim().startsWith("=") || rawText.trim().startsWith("＝") || isMathExpression(rawText);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;

    // Allow calculator expressions like Excel: =2+3, 2+3, 2x3, 198/000+4/694
    if (input.trim().startsWith("=") || input.trim().startsWith("＝") || isMathExpression(input)) {
      setRawText(input);
      setResolvedExpression(null);
      return;
    }

    // Normal numeric mode
    const val = input
      .replace(/[^0-9۰-۹]/g, "")
      .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
    const numVal = parseInt(val) || 0;
    if (numVal <= max) {
      setRawText(numVal === 0 ? "" : numVal.toLocaleString("en-US"));
      setResolvedExpression(null);
      onChange(numVal);
    }
  };

  const evaluate = () => {
    if (!isCalcMode) return;

    const expression = stripLeadingEquals(rawText);
    const normalized = toEnglishDigits(expression);
    const result = tryEval(normalized);

    if (result !== null && Number.isFinite(result) && result >= 0) {
      const rounded = Math.round(result);
      if (rounded <= max) {
        const resultText = rounded.toLocaleString("en-US");
        setResolvedExpression(`=${expression}=${resultText}`);
        setRawText(resultText);
        onChange(rounded);
      }
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
    // If showing a resolved expression, go back to editable form
    if (resolvedExpression) {
      // Extract the original expression part: "=20+5=25" → "=20+5"
      const parts = resolvedExpression.split("=").filter(Boolean);
      if (parts.length >= 1) {
        setRawText("=" + parts[0]);
      }
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (isCalcMode) {
      evaluate();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && isCalcMode) {
      e.preventDefault();
      evaluate();
      inputRef.current?.blur();
    }
  };

  const displayValue = rawText;

  return (
    <Input
      ref={inputRef}
      type="text"
      inputMode="text"
      title="برای محاسبه مثل اکسل، با = شروع کنید. مثال: =1200+500*2"
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={className}
      dir={dir}
      placeholder={placeholder}
      compactFocus
    />
  );
}
