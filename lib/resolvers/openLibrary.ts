/**
 * Open Library 解析器
 * - 正向：/search.json 模糊搜索（书名/作者/关键词）
 * - 反向：/api/volumes/brief/isbn/{isbn}.json 或 /isbn/{isbn}.json 精确查询
 * 文档：https://openlibrary.org/developers/api
 */

import { fetchJson } from '@/lib/http';
import { extractEdition } from '@/lib/resolvers/googleBooks';
import type { BookMeta } from '@/lib/types';

/** search.json 单条 doc */
interface OLDoc {
  key: string;
  title?: string;
  subtitle?: string;
  author_name?: string[];
  publisher?: string[];
  publish_date?: string[];
  first_publish_year?: number;
  isbn?: string[];
  lccn?: string[];
  cover_i?: number;
  edition_count?: number;
  language?: string[];
  number_of_pages_median?: number;
  subject?: string[];
}

interface OLSearchResponse {
  numFound: number;
  docs: OLDoc[];
}

/** 把 doc 转为 BookMeta */
function docToMeta(d: OLDoc): BookMeta | null {
  if (!d.title) return null;
  const isbn13 =
    (d.isbn ?? []).find((s) => /^\d{13}$/.test(s)) ?? '';
  const isbn10 = (d.isbn ?? []).find((s) => /^\d{9}[\dX]$/.test(s)) ?? '';
  const cover = d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : '';
  const publishDate = d.publish_date?.[0] ?? (d.first_publish_year ? String(d.first_publish_year) : '');
  const edition = extractEdition(d.title, d.subtitle);
  return {
    title: d.title,
    authors: d.author_name ?? [],
    publisher: d.publisher?.[0] ?? '',
    publishDate,
    edition,
    isbn10,
    isbn13,
    cover,
    listPrice: null, // OpenLibrary 不提供人民币定价
    description: (d.subject ?? []).slice(0, 5).join(' / '),
    source: 'openlibrary',
  };
}

/**
 * 关键词搜索候选书籍（作为 Google Books 的备源）
 */
export async function searchCandidates(
  params: { title?: string; author?: string; keyword?: string },
  maxResults = 10
): Promise<BookMeta[]> {
  const fields = 'key,title,subtitle,author_name,publisher,publish_date,first_publish_year,isbn,cover_i,edition_count,language,number_of_pages_median,subject';
  // 组合查询：title 或 author 或通用关键词
  let q = '';
  if (params.title && params.author) {
    q = `${params.title} ${params.author}`;
  } else if (params.title) {
    q = params.title;
  } else if (params.author) {
    q = params.author;
  } else if (params.keyword) {
    q = params.keyword;
  }
  if (!q) return [];
  const url =
    `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}` +
    `&fields=${encodeURIComponent(fields)}&limit=${Math.min(30, maxResults * 2)}&language=chi,zho`;
  try {
    const data = await fetchJson<OLSearchResponse>(url);
    const metas: BookMeta[] = [];
    const seen = new Set<string>();
    for (const doc of data.docs ?? []) {
      const m = docToMeta(doc);
      if (!m) continue;
      const key = `${m.isbn13 || m.title}|${m.title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      metas.push(m);
    }
    return metas.slice(0, maxResults);
  } catch (err) {
    console.warn('[openLibrary] 搜索失败:', (err as Error).message);
    return [];
  }
}

/** volumes/brief 接口返回结构 */
interface OLVolumeBrief {
  records: Record<
    string,
    {
      details?: {
        title?: string;
        subtitle?: string;
        authors?: Array<{ name?: string }>;
        publishers?: string[];
        publish_date?: string;
        physical_details?: string;
        notes?: string;
        edition_name?: string;
      };
      cover?: { small?: string; medium?: string; large?: string };
    }
  >;
}

/** isbn/{isbn}.json 接口返回结构 */
interface OLIsbnResponse {
  title?: string;
  subtitle?: string;
  authors?: Array<{ name?: string }>;
  publishers?: Array<{ name?: string }>;
  publish_date?: string;
  number_of_pages?: number;
  covers?: number[];
  notes?: string;
}

/**
 * ISBN → 元数据
 * 先试 volumes/brief（结构全），失败再试 /isbn/{isbn}.json（轻量）
 */
export async function resolveByIsbn(isbn: string): Promise<BookMeta | null> {
  // ---- 主源：volumes/brief ----
  try {
    const brief = await fetchJson<OLVolumeBrief>(
      `https://openlibrary.org/api/volumes/brief/isbn/${encodeURIComponent(isbn)}.json`
    );
    const rec = Object.values(brief.records ?? {})[0];
    const det = rec?.details;
    if (det?.title) {
      const authors = (det.authors ?? []).map((a) => a.name ?? '').filter(Boolean);
      const edition = det.edition_name
        ? det.edition_name
        : extractEdition(det.title, det.subtitle, det.physical_details, det.notes);
      const coverUrl =
        rec?.cover?.large ?? rec?.cover?.medium ?? rec?.cover?.small ?? '';
      return {
        title: det.title,
        authors,
        publisher: det.publishers?.[0] ?? '',
        publishDate: det.publish_date ?? '',
        edition,
        isbn10: isbn.length === 10 ? isbn : '',
        isbn13: isbn.length === 13 ? isbn : '',
        cover: coverUrl,
        listPrice: null,
        description: det.notes ?? '',
        source: 'openlibrary',
      };
    }
  } catch (err) {
    console.warn('[openLibrary] volumes/brief 失败:', (err as Error).message);
  }

  // ---- 备源：/isbn/{isbn}.json ----
  try {
    const data = await fetchJson<OLIsbnResponse>(
      `https://openlibrary.org/isbn/${encodeURIComponent(isbn)}.json`
    );
    if (data.title) {
      const coverId = data.covers?.[0];
      const edition = extractEdition(data.title, data.subtitle, data.notes);
      return {
        title: data.title,
        authors: (data.authors ?? []).map((a) => a.name ?? '').filter(Boolean),
        publisher: (data.publishers ?? []).map((p) => p.name ?? '').filter(Boolean)[0] ?? '',
        publishDate: data.publish_date ?? '',
        edition,
        isbn10: isbn.length === 10 ? isbn : '',
        isbn13: isbn.length === 13 ? isbn : '',
        cover: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : '',
        listPrice: null,
        description: data.notes ?? '',
        source: 'openlibrary',
      };
    }
  } catch (err) {
    console.warn('[openLibrary] /isbn 查询失败:', (err as Error).message);
  }
  return null;
}
