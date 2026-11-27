import { expect, test } from 'bun:test';
import { DEFAULT_TRUNCATABLE_CHARS, isTextTruncated, previewText } from '../src/lib/expandableText';

const SHORT_ADDRESS = 'میدان آزادی، خیابان استقلال، پلاک ۱۲';
const LONG_ADDRESS =
  'میدان آزادی، خیابان استقلال، کوچه بهار، پلاک ۱۲، واحد ۴، طبقه سوم، ساختمان آفتاب، تهران';
const LONG_DESCRIPTION =
  'نصب داربست فلزی دور ساختمان در حال نماکاری، نیازمند ایمنی اضافه در ضلع شمالی و هماهنگی با پیمانکار نما برای توقف آسانسور بار';

test('short text is not treated as cut off, so its box stays plain', () => {
  expect(isTextTruncated(SHORT_ADDRESS)).toBe(false);
  expect(previewText(SHORT_ADDRESS)).toBe(SHORT_ADDRESS);
});

test('a short multi-line value is still shown in full', () => {
  const text = 'خط اول\nخط دوم';
  expect(isTextTruncated(text)).toBe(false);
  expect(previewText(text)).toBe(text);
});

test('long address and long location description are flagged as cut off', () => {
  expect(isTextTruncated(LONG_ADDRESS)).toBe(true);
  expect(isTextTruncated(LONG_DESCRIPTION)).toBe(true);
  expect(isTextTruncated(LONG_ADDRESS, DEFAULT_TRUNCATABLE_CHARS)).toBe(true);
});

test('preview keeps the beginning of the text and marks the cut with an ellipsis', () => {
  const preview = previewText(LONG_ADDRESS);
  expect(preview.endsWith('…')).toBe(true);
  expect(LONG_ADDRESS.startsWith(preview.slice(0, -1))).toBe(true);
  expect(preview.length).toBeLessThanOrEqual(DEFAULT_TRUNCATABLE_CHARS + 1);
});

test('preview never splits a word in half', () => {
  const preview = previewText(LONG_DESCRIPTION);
  const body = preview.slice(0, -1);
  const nextChar = LONG_DESCRIPTION[body.length];
  expect(nextChar === ' ' || nextChar === '\n' || nextChar === '\t').toBe(true);
});

test('empty or whitespace-only text produces no preview and no expand affordance', () => {
  expect(isTextTruncated('')).toBe(false);
  expect(isTextTruncated('   \n  ')).toBe(false);
  expect(previewText('')).toBe('');
  expect(previewText('   \n  ')).toBe('');
});
