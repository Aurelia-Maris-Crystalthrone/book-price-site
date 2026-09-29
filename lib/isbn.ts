/**
 * ISBN 工具：校验（ISBN-10 / ISBN-13）与互转
 * 算法依据国际标准：
 * - ISBN-10：前 9 位数字加权和（10..2），校验位为 0-9 或 X（罗马数字 10）
 * - ISBN-13：前 12 位交替乘 1/3 求和，校验位使总和模 10 为 0
 */

/** 清洗 ISBN 输入：去掉横线、空格，统一大写（X 校验位） */
export function cleanIsbn(raw: string): string {
  return raw.replace(/[-\s]/g, '').toUpperCase();
}

/**
 * 判断字符串是否"形似"ISBN：纯数字 10/13 位，或 9 位数字+X
 * 注意：这只做形状预判，不代表校验位正确
 */
export function looksLikeIsbn(raw: string): boolean {
  const s = cleanIsbn(raw);
  return /^\d{13}$/.test(s) || /^\d{9}[\dX]$/.test(s);
}

/** 校验 ISBN-10（含校验位） */
export function isValidIsbn10(raw: string): boolean {
  const s = cleanIsbn(raw);
  if (!/^\d{9}[\dX]$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += (s.charCodeAt(i) - 48) * (10 - i);
  }
  // 第 10 位：数字或 X（=10）
  const last = s[9];
  sum += last === 'X' ? 10 : last.charCodeAt(0) - 48;
  return sum % 11 === 0;
}

/** 校验 ISBN-13（含校验位） */
export function isValidIsbn13(raw: string): boolean {
  const s = cleanIsbn(raw);
  if (!/^\d{13}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = s.charCodeAt(i) - 48;
    sum += i % 2 === 0 ? digit * 1 : digit * 3;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === (s.charCodeAt(12) - 48);
}

/** 综合校验：10 位或 13 位任一合法即合法 */
export function isValidIsbn(raw: string): boolean {
  return isValidIsbn10(raw) || isValidIsbn13(raw);
}

/**
 * ISBN-10 → ISBN-13
 * 规则：前加 978，前 9 位重算校验位（979 前缀用于新注册组，此处遵循通用 978 规则）
 * 输入不合法时返回空字符串
 */
export function isbn10To13(raw: string): string {
  const s = cleanIsbn(raw);
  if (!isValidIsbn10(s)) return '';
  const body = '978' + s.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = body.charCodeAt(i) - 48;
    sum += i % 2 === 0 ? digit * 1 : digit * 3;
  }
  const check = (10 - (sum % 10)) % 10;
  return body + String(check);
}

/**
 * ISBN-13 → ISBN-10
 * 仅当 13 位以 978 开头时才可转换（979 前缀的旧 ISBN-10 不存在）
 */
export function isbn13To10(raw: string): string {
  const s = cleanIsbn(raw);
  if (!isValidIsbn13(s) || !s.startsWith('978')) return '';
  const body = s.slice(3, 12); // 9 位
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += (body.charCodeAt(i) - 48) * (10 - i);
  }
  const rem = (11 - (sum % 11)) % 11;
  const check = rem === 10 ? 'X' : String(rem);
  return body + check;
}

/**
 * 规范化为 ISBN-13（唯一键）
 * - 合法 ISBN-13 → 原样返回
 * - 合法 ISBN-10 → 转为 ISBN-13
 * - 不合法 → 空字符串
 */
export function normalizeToIsbn13(raw: string): string {
  const s = cleanIsbn(raw);
  if (isValidIsbn13(s)) return s;
  if (isValidIsbn10(s)) return isbn10To13(s);
  return '';
}
