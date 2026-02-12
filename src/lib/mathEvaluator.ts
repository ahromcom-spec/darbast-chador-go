/**
 * Safe Mathematical Evaluator
 * 
 * Evaluates mathematical expressions safely without using eval().
 * Supports: +, -, *, /, parentheses, and Persian/Arabic digits.
 * Uses precise decimal arithmetic to avoid floating-point errors.
 * 
 * Usage:
 *   safeEval("2 + 3 * 4")        => 14
 *   safeEval("۱۲۰۰ + ۳۰۰")      => 1500
 *   safeEval("(10 + 5) * 2")     => 30
 *   safeCalc(1000, 2000, 'add')  => 3000
 */

import { toEnglishDigits } from './numberParsing';

// --- Token types ---
type TokenType = 'number' | 'op' | 'lparen' | 'rparen';
interface Token {
  type: TokenType;
  value: string | number;
}

/**
 * Tokenize a math expression string into tokens.
 * Supports: numbers (int/float), +, -, *, /, (, )
 */
function tokenize(expr: string): Token[] {
  // Normalize: convert Persian/Arabic digits, remove spaces & commas (thousand sep)
  let normalized = toEnglishDigits(expr.trim());
  normalized = normalized.replace(/,/g, ''); // remove thousand separators
  normalized = normalized.replace(/\s+/g, ''); // remove whitespace

  const tokens: Token[] = [];
  let i = 0;

  while (i < normalized.length) {
    const ch = normalized[i];

    // Number (including decimals)
    if (/[0-9.]/.test(ch)) {
      let numStr = '';
      while (i < normalized.length && /[0-9.]/.test(normalized[i])) {
        numStr += normalized[i];
        i++;
      }
      const num = parseFloat(numStr);
      if (!Number.isFinite(num)) {
        throw new Error(`عدد نامعتبر: ${numStr}`);
      }
      tokens.push({ type: 'number', value: num });
      continue;
    }

    // Operators
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '×' || ch === '÷') {
      const op = ch === '×' ? '*' : ch === '÷' ? '/' : ch;
      
      // Handle unary minus/plus
      if (ch === '-' || ch === '+') {
        const prevToken = tokens[tokens.length - 1];
        const isUnary = !prevToken || prevToken.type === 'op' || prevToken.type === 'lparen';
        if (isUnary) {
          // Collect the number after unary sign
          i++;
          let numStr = '';
          while (i < normalized.length && /[0-9.]/.test(normalized[i])) {
            numStr += normalized[i];
            i++;
          }
          if (numStr === '') {
            // It's a sign before parenthesis like -(...)
            tokens.push({ type: 'number', value: ch === '-' ? -1 : 1 });
            tokens.push({ type: 'op', value: '*' });
            continue;
          }
          const num = parseFloat(numStr);
          if (!Number.isFinite(num)) {
            throw new Error(`عدد نامعتبر: ${ch}${numStr}`);
          }
          tokens.push({ type: 'number', value: ch === '-' ? -num : num });
          continue;
        }
      }

      tokens.push({ type: 'op', value: op });
      i++;
      continue;
    }

    if (ch === '(') {
      tokens.push({ type: 'lparen', value: '(' });
      i++;
      continue;
    }

    if (ch === ')') {
      tokens.push({ type: 'rparen', value: ')' });
      i++;
      continue;
    }

    throw new Error(`کاراکتر نامعتبر: "${ch}"`);
  }

  return tokens;
}

/**
 * Recursive descent parser for math expressions.
 * Respects operator precedence: 
 *   1. Parentheses (highest)
 *   2. Multiplication & Division
 *   3. Addition & Subtraction (lowest)
 */
class Parser {
  private tokens: Token[];
  private pos: number;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
    this.pos = 0;
  }

  parse(): number {
    const result = this.parseExpression();
    if (this.pos < this.tokens.length) {
      throw new Error('عبارت ریاضی نامعتبر است');
    }
    return result;
  }

  private parseExpression(): number {
    let left = this.parseTerm();

    while (this.pos < this.tokens.length) {
      const token = this.tokens[this.pos];
      if (token.type === 'op' && (token.value === '+' || token.value === '-')) {
        this.pos++;
        const right = this.parseTerm();
        left = token.value === '+' ? preciseAdd(left, right) : preciseSubtract(left, right);
      } else {
        break;
      }
    }

    return left;
  }

  private parseTerm(): number {
    let left = this.parseFactor();

    while (this.pos < this.tokens.length) {
      const token = this.tokens[this.pos];
      if (token.type === 'op' && (token.value === '*' || token.value === '/')) {
        this.pos++;
        const right = this.parseFactor();
        if (token.value === '/') {
          if (right === 0) {
            throw new Error('تقسیم بر صفر مجاز نیست');
          }
          left = preciseDiv(left, right);
        } else {
          left = preciseMul(left, right);
        }
      } else {
        break;
      }
    }

    return left;
  }

  private parseFactor(): number {
    const token = this.tokens[this.pos];

    if (!token) {
      throw new Error('عبارت ریاضی ناقص است');
    }

    if (token.type === 'number') {
      this.pos++;
      return token.value as number;
    }

    if (token.type === 'lparen') {
      this.pos++;
      const result = this.parseExpression();
      if (this.pos >= this.tokens.length || this.tokens[this.pos].type !== 'rparen') {
        throw new Error('پرانتز بسته نشده است');
      }
      this.pos++;
      return result;
    }

    throw new Error(`توکن غیرمنتظره: ${token.value}`);
  }
}

// --- Precise arithmetic helpers (avoid floating-point drift) ---

function getDecimalPlaces(n: number): number {
  const s = String(n);
  const dotIndex = s.indexOf('.');
  return dotIndex === -1 ? 0 : s.length - dotIndex - 1;
}

function preciseAdd(a: number, b: number): number {
  const dp = Math.max(getDecimalPlaces(a), getDecimalPlaces(b));
  const factor = Math.pow(10, dp);
  return (Math.round(a * factor) + Math.round(b * factor)) / factor;
}

function preciseSubtract(a: number, b: number): number {
  const dp = Math.max(getDecimalPlaces(a), getDecimalPlaces(b));
  const factor = Math.pow(10, dp);
  return (Math.round(a * factor) - Math.round(b * factor)) / factor;
}

function preciseMul(a: number, b: number): number {
  const dpA = getDecimalPlaces(a);
  const dpB = getDecimalPlaces(b);
  const factor = Math.pow(10, dpA + dpB);
  return (Math.round(a * Math.pow(10, dpA)) * Math.round(b * Math.pow(10, dpB))) / factor;
}

function preciseDiv(a: number, b: number): number {
  // For division, round to reasonable precision
  const result = a / b;
  return Math.round(result * 1e10) / 1e10;
}

// --- Public API ---

/**
 * Safely evaluate a mathematical expression string.
 * Supports Persian/Arabic digits, parentheses, and standard operators.
 * 
 * @param expression - The math expression to evaluate
 * @returns The computed result
 * @throws Error if expression is invalid
 * 
 * @example
 * safeEval("2 + 3 * 4")     // 14
 * safeEval("۱۲۰۰ + ۳۰۰")   // 1500
 * safeEval("(10 + 5) * 2")  // 30
 * safeEval("100,000 + 50,000") // 150000
 */
export function safeEval(expression: string): number {
  if (!expression || !expression.trim()) return 0;
  
  const tokens = tokenize(expression);
  if (tokens.length === 0) return 0;
  
  const parser = new Parser(tokens);
  return parser.parse();
}

/**
 * Try to evaluate an expression; return null on failure instead of throwing.
 */
export function tryEval(expression: string): number | null {
  try {
    return safeEval(expression);
  } catch {
    return null;
  }
}

/**
 * Precise calculator for common operations.
 * Use this for direct calculations where you have two operands.
 */
export function safeCalc(
  a: number,
  b: number,
  operation: 'add' | 'subtract' | 'multiply' | 'divide'
): number {
  switch (operation) {
    case 'add':
      return preciseAdd(a, b);
    case 'subtract':
      return preciseSubtract(a, b);
    case 'multiply':
      return preciseMul(a, b);
    case 'divide':
      if (b === 0) throw new Error('تقسیم بر صفر مجاز نیست');
      return preciseDiv(a, b);
  }
}

/**
 * Sum an array of numbers precisely, avoiding floating-point drift.
 */
export function preciseSum(numbers: number[]): number {
  return numbers.reduce((acc, n) => preciseAdd(acc, n), 0);
}

/**
 * Calculate balance: initial + deposits - withdrawals
 * Uses precise arithmetic throughout.
 */
export function calculateBalance(
  initialBalance: number,
  deposits: number[],
  withdrawals: number[]
): number {
  const totalDeposits = preciseSum(deposits);
  const totalWithdrawals = preciseSum(withdrawals);
  return preciseSubtract(preciseAdd(initialBalance, totalDeposits), totalWithdrawals);
}

/**
 * Check if a string contains a mathematical expression (not just a plain number).
 */
export function isMathExpression(value: string): boolean {
  if (!value || !value.trim()) return false;
  const normalized = toEnglishDigits(value.trim()).replace(/,/g, '').replace(/\s+/g, '');
  return /[+\-*/×÷()]/.test(normalized) && /\d/.test(normalized);
}

/**
 * If the input contains a math expression, evaluate it; otherwise parse as number.
 * This is the main entry point for form fields that accept both plain numbers and expressions.
 */
export function resolveNumericInput(value: string): number {
  if (!value || !value.trim()) return 0;
  
  if (isMathExpression(value)) {
    const result = tryEval(value);
    if (result !== null) return result;
  }
  
  // Fall back to plain number parsing
  const normalized = toEnglishDigits(value.trim()).replace(/,/g, '');
  const num = parseFloat(normalized);
  return Number.isFinite(num) ? num : 0;
}
