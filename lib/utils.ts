import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** shadcn/ui 标准工具函数：合并 Tailwind 类名 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 金额格式化：¥xx.xx（整数则省略小数） */
export function formatPrice(price: number): string {
  const fixed = price.toFixed(2);
  return fixed.endsWith('.00') ? `¥${price.toFixed(0)}` : `¥${fixed}`;
}

/** 平台序号 → 显示顺序（用于稳定排序前的分组） */
export function platformOrder(platform: string): number {
  const order: Record<string, number> = {
    kongfz: 0,
    youlu: 1,
    xianyu: 2,
    jd: 3,
    taobao: 4,
    duozhuayu: 5,
    xiaoguya: 6,
  };
  return order[platform] ?? 99;
}
