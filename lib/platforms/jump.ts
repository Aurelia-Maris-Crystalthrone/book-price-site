/**
 * 跳转占位平台适配器（淘宝 / 多抓鱼 / 小谷吖）
 * 这些平台没有公开 API：按需求生成「跳转搜索链接」占位卡片
 * - source = 'jump'：前端渲染为灰色调卡片，按钮文案「前往搜索」
 * - 不做任何爬取，不绕过登录/验证码/签名
 */

import type { PlatformResult } from '@/lib/types';

/** 跳转链接生成器类型 */
type JumpBuilder = (params: { isbn: string; title: string }) => string;

interface JumpPlatformDef {
  platform: string;
  platformName: string;
  condition: string;
  shop: string;
  buildUrl: JumpBuilder;
}

/** 平台定义：搜索 URL 均为各平台公开的搜索入口 */
const JUMP_PLATFORMS: JumpPlatformDef[] = [
  {
    platform: 'taobao',
    platformName: '淘宝',
    condition: '二手/全新混合',
    shop: '淘宝',
    buildUrl: (p) =>
      `https://s.taobao.com/search?q=${encodeURIComponent(p.isbn || p.title)}`,
  },
  {
    platform: 'duozhuayu',
    platformName: '多抓鱼',
    condition: '二手良好',
    shop: '多抓鱼',
    buildUrl: (p) =>
      `https://www.duozhuayu.com/search?keyword=${encodeURIComponent(p.isbn || p.title)}`,
  },
  {
    platform: 'xiaoguya',
    platformName: '小谷吖',
    condition: '二手良好',
    shop: '小谷吖',
    buildUrl: (p) =>
      `https://www.xiaoguya.com/search?keyword=${encodeURIComponent(p.isbn || p.title)}`,
  },
];

/** 为三平台生成占位结果（price=0，前端特殊渲染） */
export function buildJumpResults(params: { isbn: string; title: string }): PlatformResult[] {
  const now = new Date().toISOString();
  return JUMP_PLATFORMS.map((def) => ({
    platform: def.platform,
    platformName: def.platformName,
    title: params.title,
    price: 0, // 占位：无真实价格
    condition: def.condition,
    shop: def.shop,
    url: def.buildUrl(params),
    source: 'jump' as const,
    crawlTime: now,
  }));
}

/** 按需导出单个平台的占位（便于按平台维度组装） */
export function buildJumpOutcomes(
  params: { isbn: string; title: string }
): PlatformResult[][] {
  const now = new Date().toISOString();
  return JUMP_PLATFORMS.map((def) => [
    {
      platform: def.platform,
      platformName: def.platformName,
      title: params.title,
      price: 0,
      condition: def.condition,
      shop: def.shop,
      url: def.buildUrl(params),
      source: 'jump' as const,
      crawlTime: now,
    },
  ]);
}
