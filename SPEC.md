# iwillnotblunder 规格说明（需求 / 架构 / 思路）

## 1. 项目目标
- 帮助玩家减少 blunder（看漏子）。
- 一键可视化：
  - 己方与对方在当前局面下可控制/到达的区域（格子）。
  - 每个格子被攻击/保护的强度（次数），用颜色与透明度直观展示。
- 作为独立小工具运行；后续可接入 Lichess 实时对局。

参考：
- Chessground（棋盘 UI）: https://github.com/lichess-org/chessground
- Lichess API 文档: https://lichess.org/api

## 2. 功能需求
### 2.1 MVP（已实现）
- FEN 输入与应用，快速切换局面。
- 棋盘交互：点击/拖拽走子（本地规则由 `chess.js` 处理），只允许合法走子（高亮可走目的地，禁用自由拖动）。
- 覆盖层渲染：
  - 红色表示对方控制强度；蓝色表示己方控制强度。
  - 透明度按次数线性映射（可配置上限）。
- 快捷键：
  - A：显示/隐藏覆盖层（保留最近一次选择的一方）
  - O：只显示对方覆盖层（红）
  - M：只显示己方覆盖层（蓝）
  - H：隐藏覆盖层

### 2.1.1 UI/外观（本次新增）
- 默认语言：英文（English）。
- 语言切换：支持中文/英文两种；在页面右上角提供 `EN / 中文` 切换；选择持久化到 `localStorage`，优先读取已选择语言，其次回退到默认英文。
- 文案范围：标题、按钮、提示徽章、图例说明、按钮内快捷键标注（如 `Hide (H)`）。
- 视觉风格：
  - 使用 CSS 变量作为设计令牌（颜色、阴影、圆角、间距）。
  - 统一按钮样式（主色、描边、悬停态），面板卡片化，阴影与圆角适中。
  - 与棋盘容器像素对齐策略兼容（不影响覆盖层像素切分）。
  - 前端采用 Vite + TypeScript 构建，产物静态部署到 Cloudflare Pages。

### 2.2 近期增强
- 更精确的“攻击格”计算（已部分实现：兵/马/王固定偏移；象/车/后射线延展，遇阻停止；暂未处理“钉住”的抑制）。
- 回合切换时“己方/对方”定义可切换或手动选择（已实现：按钮“切换我方(白/黑)”）。
- 每格显示数值（次数），可开关。
- 悬停格详情：显示该格被攻击/保护的双方计数与来源棋子。

### 2.3 与 Lichess 协同（可选）
- OAuth 登录：`board:play` / `bot:play`。
- 订阅对局流（ND-JSON）：`/api/board/game/stream/{gameId}`。
- 同步 `fen`/`moves`/`possibleMoves`；覆盖层实时更新。
- 提交走子：`POST /api/board/game/{gameId}/move/{uci}`。

## 3. 非功能需求
- 性能：覆盖层渲染尽量在 16–33ms 帧预算内。
- 兼容：现代浏览器（ESM、CSS 变量、Flex/Grid）；生产环境由 Vite 产出静态资源。
- 许可：Chessground 为 GPL-3.0-or-later，用于网站需 GPL 开源合并作品源码（注意合规）。

## 4. 技术架构
- 托管：Cloudflare Pages（静态前端，`dist/` 作为站点根）+ Pages Functions（轻量服务端）。
- 前端：
  - 构建：Vite + TypeScript。源代码在 `src/`，打包输出至 `dist/`。
  - UI：`@lichess-org/chessground`（通过 CDN 动态导入）。
  - 规则：`chess.js`（本地合法走法/回退）。
  - 覆盖层：将覆盖层 DOM 挂载到 `.cg-board` 下，使用 8×8 绝对定位网格，透明度按次数映射；支持视角镜像；同一时间仅显示一方。
  - i18n：内置轻量字典（EN/中文），通过 `data-i18n` 映射到 DOM，语言状态存于 `localStorage`。
  - 样式：Chessground 样式通过 CDN（unpkg）引入。
- 服务端（可选）：
  - Pages Functions 提供只读代理、后续 OAuth、对局流中转（SSE/WS）。

## 5. 数据流
### 5.1 离线模式
1) 用 FEN 初始化 `chess.js` 与 Chessground。
2) 用户走子：Chessground `after` → `chess.move()` 成功 → 更新棋盘与覆盖层。
3) 覆盖层：计算控制格 → 输出白/黑 8×8 计数矩阵 → 渲染。

### 5.2 联机模式（规划）
1) OAuth：前端跳转获取 code，Functions 交换 Token 并服务端保存。
2) 对局流：Functions 连 Lichess `stream/{gameId}`，再用 SSE/WS 推给前端。
3) 前端据 `fen`/`moves`/`possibleMoves` 同步棋盘与覆盖层。
4) 走子：前端 → Functions → Lichess `move/{uci}`；UI 以流更新为准。

## 6. 目录结构
```
/ (root)
  index.html                 # 页面外壳，开发态通过 <script type="module" src="/src/main.ts">
  /src
    main.ts                  # 前端主逻辑（Chessground、chess.js、覆盖层、i18n、UI 交互）
  /functions
    lichess-proxy.ts         # Pages Functions：只读代理（限制 lichess.org），后续可扩展 OAuth/流中转
  /dist                      # 构建输出目录（Cloudflare Pages 部署根）
    index.html
    /assets/*                # 打包产物
  package.json
  tsconfig.json
  wrangler.jsonc             # Cloudflare Pages/Functions 配置
  SPEC.md                    # 规格说明
```

## 7. 覆盖层算法
### 7.1 当前实现
- 精确“攻击格”计算：
  - 兵：仅前进方向的对角两格；
  - 马/王：固定偏移集合；
  - 象/车/后：射线延展，遇阻停止；
  - 暂未处理“钉住”导致的控制抑制；
  - 输出白/黑各 8×8 计数矩阵用于热力渲染。

### 7.2 精确算法（规划）
- 钉住：尝试移除该子检测王是否暴露，抑制相应方向控制；
- 其他：在特殊局面下的边界处理与性能优化。

## 8. 与 Lichess API 协同
- 端点：
  - `GET /api/board/game/stream/{gameId}`（ND-JSON）
  - `POST /api/board/game/{gameId}/move/{uci}`
  - `GET /api/stream/event`（监听挑战/对局创建）
- 速率限制：严格串行、429 退避重试；
- 安全：Token 仅存服务端，通过自建 SSE/WS 向前端推送。

## 9. 开发与部署
- 本地开发：
  - `npm run dev`（Vite 开发服务器：`http://localhost:5173`）
  - `npm run build` 生成 `dist/`
  - `npx wrangler pages dev dist --port 8090`（本地模拟 Pages）
- 部署：
  - `npx wrangler pages deploy dist`
- 工具版本：本地开发建议使用 `wrangler@^4.28.1`。

## 10. 路线图
- v0.2：精确攻击格；格子数值显示；颜色/阈值可配；UI 美化。
- v0.3：联机模式（OAuth、流、走子转发）；计时与状态栏。
- v0.4：来源可视化（控制该格的具体棋子）；悬停统计面板。
- v0.5：开局/残局插件；表格库/云评估叠加（遵循各 API 许可）。

## 11. 近期进展（2025-08）
- 前端接入 Chessground（ESM）与 `chess.js`，并改为只允许合法走子，自动生成并高亮可行目的地。
- 覆盖层算法由“合法走法近似”升级为“精确攻击格”（未含钉住抑制）。
- 支持固定“我方颜色”概念（蓝=我方，红=对方），并提供“切换我方(白/黑)”按钮，棋盘朝向同步切换。
- 覆盖层像素对齐彻底修复：
  - 发现问题：`overlay` 与 `cg-container` 实际内容尺寸不一致（如 500×500 vs 496×496），且使用百分比/独立像素分配导致越到右下误差越大、叠加偏移明显。
  - 解决策略：
    1) 以棋盘内容为基准：将 `overlay` 绝对挂载在 `.cg-board` 下，并使用 `cg-container.getBoundingClientRect()` 的宽高计算网格；同时强制 `.board cg-container { position: relative !important; }` 作为定位上下文。
    2) 整数像素切分：用 `cellW=floor(W/8)`、`cellH=floor(H/8)` 构造内棋盘矩形（`innerW=cellW*8`，`innerH=cellH*8`），在 `overlay` 中居中对齐，生成 9 条像素边界；每格 `left/top/width/height` 均为整数，杜绝 62.5px 半像素。
    3) 节点复用与单层显示：固定复用 64 个 `overlay-cell`；同一时间仅显示一方（蓝=己方 或 红=对方），显示该方所有覆盖的格子，不因另一方也控制该格而被抑制；引入 `ResizeObserver` 与 `window.resize` 自动重算网格。
  - 效果：各格尺寸统一（如 62×62），与棋盘完全对齐；右下角无累计偏移；在缩放/DPR 环境下也稳定。

- 新增：UI 美化与中英双语
  - 默认英文界面，提供 `EN / 中文` 切换，选择持久化。
  - 统一按钮与卡片样式；纯静态资源，兼容 Cloudflare Pages。

- 新增：移动端响应式设计（2025-08）
  - 全面移动端适配：支持桌面、平板、手机、超小屏幕等多种设备。
  - 响应式布局：
    - 桌面端（>1024px）：棋盘和控制面板并排显示
    - 平板端（768px-1024px）：垂直堆叠布局，棋盘最大400px
    - 手机端（480px-768px）：紧凑布局，棋盘最大320px，按钮2列排列
    - 超小屏幕（<480px）：单列布局，棋盘最大280px，按钮垂直排列
  - 触摸体验优化：
    - 按钮最小高度44px，符合触摸标准
    - 语言切换按钮最小宽度44px
    - 启用 `touch-action: manipulation` 优化触摸体验
    - 优化按钮文字，避免截断（如 `Show/Hide (A)`、`Opponent (O)`）
  - 设备适配：
    - 监听设备方向变化（`orientationchange`）
    - 优化窗口大小变化处理
    - 棋盘自适应缩放，保持正方形比例
  - 界面元素优化：
    - 移动端按钮使用CSS Grid布局，主要按钮独占一行
    - 文本区域在移动端减小高度
    - 徽章字体和间距适配小屏幕
    - 保持所有功能（棋盘交互、覆盖层、快捷键、语言切换）的完整可用性

- 新增：构建与部署改造（2025-08）
  - 采用 Vite + TypeScript 开发与构建；源代码位于 `src/`，产物输出到 `dist/`。
  - Cloudflare Pages 使用 `dist/` 作为站点根；本地通过 `wrangler pages dev dist` 预览。
  - 开发命令：`npm run dev`（Vite），`npm run build`（产出 `dist/`）。
