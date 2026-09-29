/**
 * Google Books 解析器
 * - 正向：书名/作者/版本 → 候选书籍列表（intitle: / inauthor: / isbn: 操作符）
 * - 反向：ISBN → 书籍元数据
 * - Key 可选（GOOGLE_BOOKS_API_KEY），无 Key 走匿名共享配额
 * 文档：https://developers.google.com/books/docs/v1/using?hl=zh-CN
 */

import { fetchJson } from '@/lib/http';
import type { BookMeta } from '@/lib/types';

const BASE = 'https://www.googleapis.com/books/v1/volumes';

/** Google Books volumes.item 结构（仅声明用到的字段） */
interface GoogleVolume {
  id: string;
  volumeInfo?: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    description?: string;
    industryIdentifiers?: Array<{ type: string; identifier: string }>;
    imageLinks?: Record<string, string>;
    pageCount?: number;
    listPrice?: { amount: number; currencyCode: string };
    averageRating?: number;
  };
  saleInfo?: {
    listPrice?: { amount: number; currencyCode: string };
  };
}

interface GoogleVolumesResponse {
  totalItems?: number;
  items?: GoogleVolume[];
}

/** 单本 volume → BookMeta（versionKey 用于分组去重） */
function toMeta(v: GoogleVolume): BookMeta | null {
  const info = v.volumeInfo;
  if (!info || !info.title) return null;
  const ids = info.industryIdentifiers ?? [];
  const isbn13 =
    ids.find((i) => i.type === 'ISBN_13')?.identifier ??
    ids.find((i) => i.type === 'ISBN_10')?.identifier ??
    '';
  const isbn10 = ids.find((i) => i.type === 'ISBN_10')?.identifier ?? '';
  // 封面优先取大图
  const cover =
    info.imageLinks?.extraLarge ??
    info.imageLinks?.large ??
    info.imageLinks?.medium ??
    info.imageLinks?.thumbnail ??
    info.imageLinks?.smallThumbnail ??
    '';
  // Google 的 listPrice 币种多为 USD，只有人民币才作为「定价」展示
  const sale = v.saleInfo?.listPrice;
  const listPrice = sale && sale.currencyCode === 'CNY' ? sale.amount : null;
  const edition = extractEdition(info.title, info.subtitle, info.description);
  return {
    title: info.title,
    authors: info.authors ?? [],
    publisher: info.publisher ?? '',
    publishDate: info.publishedDate ?? '',
    edition,
    isbn10,
    isbn13: isbn13.length === 13 ? isbn13 : '',
    cover,
    listPrice,
    description: info.description ?? '',
    source: 'google',
  };
}

/** 从书名/副书名/简介里提取版次（如「第3版」「第 3 版」「(第3版)」「第三版」） */
export function extractEdition(...texts: Array<string | undefined>): string {
  const CN_NUM: Record<string, string> = {
    一: '1', 二: '2', 三: '3', 四: '4', 五: '5',
    六: '6', 七: '7', 八: '8', 九: '9', 十: '10',
  };
  for (const t of texts) {
    if (!t) continue;
    // 匹配「第3版」「第 3 版」「第三版」「第3修订版」等
    const m = t.match(/第\s*([0-9一二三四五六七八九十]+)\s*(?:版|修订版|版次)/);
    if (m) {
      const raw = m[1];
      const num = /^[0-9]+$/.test(raw) ? raw : CN_NUM[raw] ?? '';
      if (num) return `第${num}版`;
    }
  }
  return '';
}

/**
 * 组合查询候选书籍
 * @param params 书名 / 作者 / 版本关键词
 * @returns 最多 maxResults 条候选
 */
export async function searchCandidates(
  params: { title?: string; author?: string; edition?: string; keyword?: string },
  maxResults = 10
): Promise<BookMeta[]> {
  // 构造 q：intitle: + inauthor: 操作符组合
  const parts: string[] = [];
  if (params.title) parts.push(`intitle:${params.title}`);
  if (params.author) parts.push(`inauthor:${params.author}`);
  if (params.edition) parts.push(params.edition); // 版本作为裸关键词（Google 不支持 inedition:）
  if (!params.title && !params.author && params.keyword) parts.push(params.keyword);
  const q = parts.join('+');
  if (!q) return [];

  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  const url =
    `${BASE}?q=${encodeURIComponent(q)}` +
    `&maxResults=${Math.min(40, Math.max(1, maxResults * 3))}` + // 多取一些用于过滤
    `&country=CN` +
    (apiKey ? `&key=${apiKey}` : '');
  try {
    const data = await fetchJson<GoogleVolumesResponse>(url);
    const metas: BookMeta[] = [];
    for (const item of data.items ?? []) {
      const m = toMeta(item);
      if (m) metas.push(m);
    }
    return dedupeByIsbn(metas).slice(0, maxResults);
  } catch (err) {
    console.warn('[googleBooks] 搜索失败:', (err as Error).message);
    return [];
  }
}

/** 按 ISBN-13 + 书名 + 版次去重（Google 会返回不同印刷批次） */
function dedupeByIsbn(items: BookMeta[]): BookMeta[] {
  const seen = new Set<string>();
  const out: BookMeta[] = [];
  for (const m of items) {
    const key = `${m.isbn13 || m.title}|${m.title}|${m.publisher}|${m.edition}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
}

/** ISBN → 元数据（q=isbn:xxx） */
export async function resolveByIsbn(isbn: string): Promise<BookMeta | null> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  const url =
    `${BASE}?q=isbn:${encodeURIComponent(isbn)}` +
    `&country=CN` +
    (apiKey ? `&key=${apiKey}` : '');
  try {
    const data = await fetchJson<GoogleVolumesResponse>(url);
    for (const item of data.items ?? []) {
      const m = toMeta(item);
      if (m && (m.isbn13 === isbn || m.isbn10 === isbn)) return m;
    }
    // 宽松兜底：返回第一条（ISBN 查询本就精确）
    const first = (data.items ?? []).map(toMeta).find((m): m is BookMeta => m !== null);
    return first ?? null;
  } catch (err) {
    console.warn('[googleBooks] ISBN 查询失败:', (err as Error).message);
    return null;
  }
}
