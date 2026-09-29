# 比价书 BookPrice

> 买书之前，先比个价 —— 多平台图书比价网站

![Next.js](https://img.shields.io/badge/Next.js-15-black) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue) ![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38bdf8) ![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-green) ![Deploy](https://img.shields.io/badge/Deploy-Vercel-000)

输入**书名 / 作者 / 版次 / ISBN** 任意一项或组合，系统自动完成：

1. **解析** — 书名/作者/版本 → 候选书籍列表（含 ISBN、出版社、版次、封面）
2. **确认** — 用户从候选中选择目标书籍，以 **ISBN-13 为唯一键**
3. **比价** — 并发查询 7 个平台的在售价格
4. **展示** — 汇总排序、全网最低价高亮、跳转链接直达

同时支持反向查询：输入 ISBN → 显示书名、作者、出版社、版次、封面、定价。

## 功能亮点

| 功能 | 说明 |
|---|---|
| 🔍 三种搜索模式 | 智能搜索（自动识别 ISBN/书名/作者）、ISBN 精确查询、高级组合（书名+作者+版次） |
| 💡 自动补全 | 输入 ≥2 字符实时建议（350ms 防抖，支持键盘 ↑↓ 导航） |
| 📚 候选确认 | 多条匹配时强制人工选择，**绝不自动取第一条** |
| 🏷️ 版本隔离 | 不同版次 / 译者 / 出版社视为不同书籍，价格绝不合并 |
| 🚀 并发比价 | 7 平台 `Promise.allSettled` 并发，单平台故障不影响整体 |
| 🏆 最低价横幅 | 绿色高亮「全网最低 ¥XX.XX @ 平台」+ 一键直达 |
| 📈 价格趋势 | Recharts 折线图，每平台一条线，图例点击切换显隐 |
| 🌓 暗色模式 | next-themes 一键切换，全站适配 |
| 📱 移动优先 | 卡片网格 3/2/1 列自适应，搜索栏占满宽度 |

## 数据流程

```
用户输入 ──► /api/resolve ──► Google Books（主源）┐
                              Open Library（备源）┴─► 候选列表（≤10 条，去重+版本隔离）
                                        │
                              用户确认目标书籍
                                        ▼
             /api/search（POST）──► 7 平台并发适配器 ──► 统一 PlatformResult[]
                                        │                 ├─ 孔夫子  官方 API + MD5 签名
                                        │                 ├─ 闲鱼    onebound 聚合 API
                                        │                 ├─ 京东    京东联盟 API
                                        │                 ├─ 有路    页面抓取 + 1s 限频
                                        │                 └─ 淘宝/多抓鱼/小谷吖  跳转占位
                                        ▼
                    SQLite price_history（每次成功搜索自动写入）
                                        ▼
                    /api/history ──► 趋势折线图（平台多线对比）
```

## 快速开始

### 本地运行

> 本项目当前位于本机 `D:\book-price-site`，以下命令均在该目录内执行。

```bash
cd D:\book-price-site          # 项目所在目录（已含完整代码与依赖）

# 1. 安装依赖（Node.js ≥ 18.18；首次或依赖缺失时执行）
npm install

# 2.（可选）配置平台密钥
cp .env.local.example .env.local   # 填入真实 Key，不配也能跑

# 3. 启动
npm run dev                        # http://localhost:3000
```

> **零密钥也能运行**：Google Books / Open Library / 有路网 / 三个跳转平台正常工作，
> 孔夫子 / 闲鱼 / 京东显示「暂时不可用」占位卡。
> 网络受限环境（如镜像超时）可加：`npm install --registry=https://registry.npmmirror.com`

### Vercel 部署（一键）

1. 推送代码到 GitHub
2. 打开 [vercel.com/new](https://vercel.com/new) 导入仓库（自动识别 Next.js，零配置）
3. **Environment Variables** 中按需填入下表密钥
4. Deploy

> **Vercel 上的 SQLite**：Serverless 只读文件系统会自动降级为内存数据库——
> 比价功能完全正常，历史价格不跨实例持久化。需要生产级持久化时，
> 把 `lib/db.ts` 的 `openDatabase()` 换成 Turso / Supabase 等托管 SQLite，对外接口不变。

## 环境变量

| 变量 | 平台 | 必填 | 说明 |
|---|---|---|---|
| `KONGFZ_KEY` / `KONGFZ_SECRET` | 孔夫子旧书网 | 否 | [open.kongfz.com](https://open.kongfz.com) 开放平台 |
| `ONEBOUND_KEY` / `ONEBOUND_SECRET` | 闲鱼 | 否 | [open.onebound.cn](https://open.onebound.cn) 聚合 API |
| `JD_APP_KEY` / `JD_APP_SECRET` | 京东 | 否 | [union.jd.com](https://union.jd.com) 京东联盟 |
| `GOOGLE_BOOKS_API_KEY` | 书籍解析 | 否 | 不填走匿名共享配额 |
| `KONGFZ_ENDPOINT` / `ONEBOUND_ENDPOINT` / `YOULU_SEARCH_URL` | — | 否 | 自定义接口地址 |

> 所有密钥仅在服务端 Route Handler 读取，**绝不打包进前端**。

## API 文档

| 方法 | 路由 | 说明 |
|---|---|---|
| GET | `/api/resolve?q={关键词或ISBN}` | 智能识别：ISBN → 书籍元数据；关键词 → 候选列表（≤10 条） |
| GET | `/api/resolve?title=&author=&edition=` | 高级组合查询 |
| GET | `/api/suggest?q=` | 搜索自动补全 |
| GET | `/api/search?isbn=` | 并发查询所有平台（只读） |
| POST | `/api/search` `{isbn, title}` | 并发查询 + 写入历史价格 |
| GET | `/api/history?isbn=` | 历史价格记录（时间升序） |

## 目录结构

```
book-price-site/
├── app/
│   ├── layout.tsx              # 字体、元数据、暗色模式
│   ├── page.tsx                # 首页状态机：idle→resolving→candidates→searching→results
│   ├── globals.css             # Olive #6a8571 主题变量、shimmer、fade-in-up
│   └── api/                    # resolve / suggest / search / history 四个路由
├── components/                 # 20 个组件：Navbar、HeroSearch、SearchBar（自动补全）、
│                               # CandidateList（键盘导航+手风琴折叠）、CheapestBanner、
│                               # PriceResultList（排序筛选）、PriceTrendChart 等
├── lib/
│   ├── isbn.ts                 # ISBN-10/13 校验位算法与互转
│   ├── http.ts                 # 统一 15s 超时、429 日志、限频器
│   ├── db.ts                   # SQLite 三级降级（文件库→内存库→node:sqlite）
│   ├── resolvers/              # Google Books 主源 + Open Library 备源，双向解析
│   └── platforms/              # 5 个适配器 + 并发调度（allSettled + 最低价提取）
├── .env.local.example
├── next.config.js              # better-sqlite3 外置打包
└── tailwind.config.ts          # Olive 主色、圆角 8/12px、fade-in-up 动画
```

## 可靠性设计

**三级数据库降级**：better-sqlite3 文件库（本地持久化）→ 内存库（Vercel 只读 FS）→ node:sqlite 内置（原生编译失败时）。任何一级失败自动落到下一级，主流程永不中断。

**平台故障隔离**：每个适配器独立 try-catch + 15 秒超时；429 限流记录日志；失败平台渲染灰色「暂时不可用」卡片，其余平台正常出价。

**边界情况全覆盖**：

- ISBN 校验失败 → 「ISBN 格式不正确，请检查」（前后端双重校验，ISBN-10↔13 自动互转）
- 搜索无结果 → 「未找到匹配书籍，请尝试其他关键词」
- 平台超时/限流 → 灰色占位卡，不影响其他平台
- 历史为空 → 「暂无历史数据，多搜索几次后即可查看」

## 常见问题

<details>
<summary><b>Windows 安装 better-sqlite3 报 node-gyp 错误？</b></summary>

安装 [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)（含 C++ 工作负载）后重试。或直接 `npm install --ignore-scripts` 跳过编译——Node ≥ 22.5 会自动降级到内置 `node:sqlite`，功能不受影响（历史数据存内存）。

</details>

<details>
<summary><b>构建时卡在「Found lockfile missing swc dependencies, patching...」？</b></summary>

这是 Next.js 尝试从外网下载 @next/swc 二进制超时。先完整执行一次 `npm install`（从 registry 镜像拉齐 swc 依赖）再 `npm run build`；网络不畅时加 `--registry=https://registry.npmmirror.com`。

</details>

<details>
<summary><b>为什么淘宝/多抓鱼/小谷吖没有价格？</b></summary>

这些平台无公开 API。本项目承诺不绕过任何平台的登录、验证码、签名或反爬机制，因此仅为它们生成「跳转搜索」占位卡片，按钮直达平台官方搜索页。

</details>

## 免责声明

价格数据仅供参考，以平台实际结算为准。数据采集时间见页脚时间戳。本项目仅调用官方开放 API 或公开搜索页，不爬取需登录的数据，跳转链接均指向平台官方站点。

## License

MIT
#   b o o k - p r i c e - s i t e  
 