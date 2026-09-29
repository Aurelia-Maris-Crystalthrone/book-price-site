import { BookOpenText, Info, Clock3 } from 'lucide-react';

/**
 * 页脚：免责声明 + 采集时间戳 + 版权
 */
export function Footer({ crawledAt }: { crawledAt?: string }) {
  return (
    <footer className="mt-16 border-t bg-card/50">
      <div className="container flex flex-col gap-3 py-8 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        {/* 免责声明 */}
        <p className="flex items-start gap-2 md:items-center">
          <Info className="mt-0.5 h-4 w-4 shrink-0 md:mt-0" />
          价格数据仅供参考，以平台实际结算为准
        </p>

        {/* 采集时间戳 */}
        {crawledAt ? (
          <p className="flex items-center gap-2">
            <Clock3 className="h-4 w-4 shrink-0" />
            数据采集时间：{new Date(crawledAt).toLocaleString('zh-CN', { hour12: false })}
          </p>
        ) : null}

        {/* 版权 */}
        <p className="flex items-center gap-2">
          <BookOpenText className="h-4 w-4 shrink-0" />
          © {new Date().getFullYear()} 比价书 BookPrice · 数据来自各平台公开接口
        </p>
      </div>
    </footer>
  );
}
