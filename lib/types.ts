/**
 * 全局共享类型定义
 * 所有类型显式声明，禁止 any
 */

/** 书籍元数据（以 ISBN-13 为唯一键） */
export interface BookMeta {
  /** 书名 */
  title: string;
  /** 作者列表 */
  authors: string[];
  /** 出版社 */
  publisher: string;
  /** 出版日期（如 2012-01 或 2012） */
  publishDate: string;
  /** 版次描述（第 x 版 / 影印版等，未知为空字符串） */
  edition: string;
  /** ISBN-10（可能为空） */
  isbn10: string;
  /** ISBN-13（唯一键；极端情况下可能为空，由调用方兜底） */
  isbn13: string;
  /** 封面图 URL（可能为空字符串） */
  cover: string;
  /** 定价（人民币，可能为 null，来自 OpenLibrary pages / Google listPrice） */
  listPrice: number | null;
  /** 内容简介（可能为空） */
  description: string;
  /** 数据来源 */
  source: 'google' | 'openlibrary';
}

/** 候选书籍条目（= BookMeta + 稳定 rowId，供前端键盘导航） */
export interface BookCandidate extends BookMeta {
  rowId: string;
}

/** /api/resolve 响应体 */
export interface ResolveResponse {
  /** 输入类型判定：isbn=直接精确查询；text=模糊搜索出候选列表 */
  inputType: 'isbn' | 'text';
  /** inputType === 'isbn' 时：精确命中的书籍元数据（可能为 null，即 ISBN 合法但查无此书） */
  book: BookMeta | null;
  /** inputType === 'text' 时：候选书籍列表（最多 10 条） */
  candidates: BookCandidate[];
  /** 使用的解析源 */
  source: string;
}

/** 平台报价结果（所有平台适配器的统一接口） */
export interface PlatformResult {
  /** 平台唯一标识（kongfz / xianyu / jd / youlu / taobao / duozhuayu / xiaoguya） */
  platform: string;
  /** 平台展示名（孔夫子旧书网 / 闲鱼 / 京东 / 有路网 …） */
  platformName: string;
  /** 平台上商品标题 */
  title: string;
  /** 价格（元） */
  price: number;
  /** 品相：全新 / 品相九五新 / 品相九品 / 品相八品 / 二手良好 / 未知 */
  condition: string;
  /** 店铺名 */
  shop: string;
  /** 跳转链接 */
  url: string;
  /** api=真实接口报价；jump=跳转搜索占位 */
  source: 'api' | 'jump';
  /** 采集时间 ISO 字符串 */
  crawlTime: string;
}

/** 平台维度状态：成功出价 / 占位 / 失败（429 限流、超时等） */
export interface PlatformOutcome {
  platform: string;
  /** ok=有报价；jump=跳转占位；unavailable=暂时不可用 */
  status: 'ok' | 'jump' | 'unavailable';
  results: PlatformResult[];
  /** 不可用原因（前端展示「暂时不可用」提示用） */
  reason?: string;
}

/** /api/search 响应体 */
export interface SearchResponse {
  /** 查询的 ISBN-13 */
  isbn: string;
  /** 查询时用的书名关键词（用于跳转搜索链接） */
  title: string;
  /** 全网最低价（null 表示所有 API 平台均无报价） */
  cheapest: PlatformResult | null;
  /** 各平台结果（含失败占位） */
  outcomes: PlatformOutcome[];
  /** 各平台并发总耗时（毫秒） */
  elapsedMs: number;
  /** 本次采集时间 */
  crawledAt: string;
}

/** 历史价格记录（price_history 表的行结构） */
export interface PriceHistoryRow {
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

/** /api/history 响应体 */
export interface HistoryResponse {
  isbn: string;
  rows: PriceHistoryRow[];
}

/** 自动补全建议条目 */
export interface SuggestItem {
  label: string;
  /** 补全类型：book=书籍候选、author=作者、publisher=出版社 */
  kind: 'book' | 'author' | 'publisher';
  /** 补全提交值：book 为书名，author/publisher 为对应词 */
  value: string;
  detail: string;
}

/** 搜索模式 */
export type SearchMode = 'smart' | 'isbn' | 'advanced';

/** 高级组合查询参数 */
export interface AdvancedQuery {
  title: string;
  author: string;
  edition: string;
}

/** 品相选项（用于前端筛选） */
export type ConditionFilter = 'all' | '全新' | '二手';
