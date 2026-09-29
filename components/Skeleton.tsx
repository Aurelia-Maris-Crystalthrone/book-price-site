import { cn } from '@/lib/utils';

/** 骨架屏占位块（配合 globals.css 的 shimmer 动画） */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('skeleton', className)} {...props} />;
}
