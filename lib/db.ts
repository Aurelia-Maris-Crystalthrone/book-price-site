/**
 * SQLite 数据库（优先 better-sqlite3，降级 node:sqlite）
 * - 存储 price_history 历史价格表
 * - 三级降级策略，保证任何环境可运行：
 *   1. better-sqlite3 文件库（本地开发，历史持久化）
 *   2. better-sqlite3 / node:sqlite 内存库（Vercel 只读文件系统等）
 *   3. 数据库完全不可用 → 返回 null，比价主流程不受影响
 * - 模块级单例，dev 热重载时复用同一连接（globalThis 缓存）
 */

import fs from 'node:fs';
import path from 'node:path';

/** 统一的语句执行接口（兼容 better-sqlite3 与 node:sqlite 两种返回形态） */
interface RunResult {
  changes: number | bigint;
}
interface StmtWrapper {
  run(...args: unknown[]): RunResult;
  all(...args: unknown[]): unknown[];
}
interface DbWrapper {
  prepare(sql: string): StmtWrapper;
  exec(sql: string): void;
  transaction<T>(fn: () => T): T;
  pragma?(stmt: string): unknown;
}

export interface PriceHistoryInsert {
  book_key: string;
  platform: string;
  title: string;
  price: number;
  condition: string;
  shop: string;
  url: string;
  crawl_time: string;
}

export interface PriceHistoryRowDB {
  id: number;
  book_key: string;
  platform: string;
  title: string;
  price: number;
  condition: string;
  shop: string;
  url: string;
  crawl_time: string;
}

// ---------- 模块级单例 ----------
declare global {
  // eslint-disable-next-line no-var
  var __bookpriceDb: DbHandle | undefined;
}

/** 数据库句柄（含驱动类型标记，便于日志与排查） */
class DbHandle {
  private db: DbWrapper;
  private memory = false;
  readonly driver: string;

  constructor() {
    const { db, memory, driver } = openDatabase();
    this.db = db;
    this.memory = memory;
    this.driver = driver;
    this.initSchema();
  }

  /** 建表（幂等） */
  private initSchema(): void {
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS price_history (
         id          INTEGER PRIMARY KEY AUTOINCREMENT,
         book_key    TEXT NOT NULL,
         platform    TEXT NOT NULL,
         title       TEXT NOT NULL,
         price       REAL NOT NULL,
         condition   TEXT NOT NULL DEFAULT '',
         shop        TEXT NOT NULL DEFAULT '',
         url         TEXT NOT NULL DEFAULT '',
         crawl_time  TEXT NOT NULL
       );
       CREATE INDEX IF NOT EXISTS idx_price_history_book_key ON price_history (book_key);
       CREATE INDEX IF NOT EXISTS idx_price_history_book_platform ON price_history (book_key, platform);`
    );
  }

  /** 是否内存库（历史数据不跨进程持久化） */
  isMemory(): boolean {
    return this.memory;
  }

  /** 批量写入历史价格（事务包裹） */
  insertMany(rows: PriceHistoryInsert[]): number {
    if (rows.length === 0) return 0;
    const stmt = this.db.prepare(
      `INSERT INTO price_history (book_key, platform, title, price, condition, shop, url, crawl_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    this.db.transaction(() => {
      for (const r of rows) {
        stmt.run(r.book_key, r.platform, r.title, r.price, r.condition, r.shop, r.url, r.crawl_time);
      }
    });
    return rows.length;
  }

  /** 查询某本书的全部历史（时间升序），结果统一为 PriceHistoryRowDB 形态 */
  listByBook(isbn: string): PriceHistoryRowDB[] {
    const stmt = this.db.prepare(
      `SELECT id, book_key, platform, title, price, condition, shop, url, crawl_time
       FROM price_history
       WHERE book_key = ?
       ORDER BY crawl_time ASC, id ASC`
    );
    const raw = stmt.all(isbn) as Array<Record<string, unknown>>;
    return raw.map((r) => ({
      id: Number(r.id),
      book_key: String(r.book_key),
      platform: String(r.platform),
      title: String(r.title),
      price: Number(r.price),
      condition: String(r.condition ?? ''),
      shop: String(r.shop ?? ''),
      url: String(r.url ?? ''),
      crawl_time: String(r.crawl_time),
    }));
  }
}

/** 打开数据库：better-sqlite3 文件库 → better-sqlite3 内存库 → node:sqlite 内存库 */
function openDatabase(): { db: DbWrapper; memory: boolean; driver: string } {
  const DATA_DIR = process.env.SQLITE_DATA_DIR ?? path.join(process.cwd(), 'data');
  const DB_FILE = path.join(DATA_DIR, 'bookprice.db');

  // ---- 1. better-sqlite3（原生模块，动态 require）----
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3');
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      const db = new Database(DB_FILE);
      db.pragma('journal_mode = WAL');
      return { db: db as unknown as DbWrapper, memory: false, driver: 'better-sqlite3(file)' };
    } catch (err) {
      // 文件系统只读（Vercel）：降级内存库
      console.warn(`[db] 文件库不可用（${(err as Error).message}），使用内存库`);
      const mem = new Database(':memory:');
      return { db: mem as unknown as DbWrapper, memory: true, driver: 'better-sqlite3(memory)' };
    }
  } catch (err) {
    console.warn(`[db] better-sqlite3 不可用（${(err as Error).message}），尝试 node:sqlite`);
  }

  // ---- 2. node:sqlite（Node ≥ 22.5 内置，无原生编译依赖）----
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(':memory:');
    // node:sqlite 没有 transaction 助手：手写 BEGIN/COMMIT 包装
    const wrapper: DbWrapper = {
      prepare: (sql: string) => {
        const stmt = db.prepare(sql);
        return {
          run: (...args: unknown[]) => stmt.run(...args) as RunResult,
          all: (...args: unknown[]) => stmt.all(...args) as unknown[],
        };
      },
      exec: (sql: string) => db.exec(sql),
      transaction: <T>(fn: () => T): T => {
        db.exec('BEGIN');
        try {
          const result = fn();
          db.exec('COMMIT');
          return result;
        } catch (e) {
          db.exec('ROLLBACK');
          throw e;
        }
      },
    };
    return { db: wrapper, memory: true, driver: 'node:sqlite(memory)' };
  } catch (err) {
    throw new Error(`无可用 SQLite 驱动: ${(err as Error).message}`);
  }
}

/** 获取数据库单例（失败安全：返回 null，主流程降级为无历史记录） */
export function getDb(): DbHandle | null {
  try {
    if (!globalThis.__bookpriceDb) {
      globalThis.__bookpriceDb = new DbHandle();
    }
    return globalThis.__bookpriceDb;
  } catch (err) {
    console.error('[db] 初始化失败，历史价格功能降级:', (err as Error).message);
    return null;
  }
}
