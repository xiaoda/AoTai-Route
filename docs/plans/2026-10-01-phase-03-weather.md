# 阶段 3 动态天气实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在既有样段上实现低成本、连续、可控制的动态天气，不实现声音。
**Architecture:** 纯数值天气状态机与 Three.js 渲染分离。一个共享程序云图和 uniforms 驱动天空与所有自然材质的云影；React 仅低频接收状态摘要。
**Tech Stack:** 现有 React / R3F / Three.js / TypeScript / Vitest，无新增运行依赖。

---

本次在用户当前项目目录内新建功能分支，复用既有服务，不为 worktree 重新启动服务。所引用 worktree 子技能在本环境不可用。命令全部 node_repl → 直接 .exe，windowsHide=true、shell=false，记录 PID/路径/时间/退出码及 stdout/stderr 于 .preview/phase-03-weather。

## 1. 状态与兼容（先红后绿）

创建 src/world/weather.ts、weather.test.ts；修改 src/core/settings.ts、settings.test.ts。
- 写 WeatherController 初值、360 秒循环、12 秒手动渐变、中途反选不跳、固定回自动、暂停冻结、大间隔限幅、帧率独立性测试。
- 先运行 node.exe node_modules/vitest/vitest.mjs run --pool=threads src/world/weather.test.ts，确认缺少实现失败。
- 实现类型 WeatherChoice=auto|clear|cloudy|mist、三天气权重、统一 evaluateWeather，以及 advance(delta,running)。固定暂停自动相位，回自动从当前权重 12 秒接回。
- 设置校验只接受白名单，旧数据补 auto；固定晴朗用二阶段光照和雾值。
- 运行两组测试，预期全通过。

## 2. 云图与渲染

创建 src/scene/weatherMaterial.ts、weatherMaterial.test.ts、Weather.tsx；修改 Landscape.tsx、surface.ts、Vegetation.tsx、Experience.tsx。
- 程序生成平铺云图，单元测试固定种子、平铺和云覆盖单调性。
- 公共材质注入在原 onBeforeCompile 后附加世界坐标和直接光云影，所有材质使用同一云高度/方向/偏移；测试 hook 组合及所需 shader 片段。
- Weather 使用场景统一状态驱动云、太阳、半球光、雾；复用现有分区太阳阴影，节能不增加阴影 pass。
- 监听 visibility/blur/focus，恢复丢弃首个 delta；暂停状态不推进，手动选择排队等恢复。
- 增加只读 __AOTAI_WEATHER__ 诊断。天气状态不改人物、相机或地形。
- 运行定向测试和 node.exe node_modules/typescript/bin/tsc --noEmit。

## 3. 控件与说明

创建 src/components/WeatherControl.tsx，修改 App.tsx、styles.css。
- 右上折叠天气手记，原生 select 选择四种模式；标明 12 秒过渡、六分钟循环和无声编排。
- 摘要只低频更新，不用每帧 React setState；暂停提示不盖住天气选择。
- 设置恢复默认回 auto，选择持久化；无效/旧 localStorage 测试。
- 首页阶段/边界文案改为阶段 03 · 动态天气，不保留“暂无动态天气”的错误说明。

## 4. 验收与归档

- 全量 node.exe node_modules/vitest/vitest.mjs run --pool=threads；tsc --noEmit；node.exe node_modules/vite/bin/vite.js build，分别日志。
- Chrome DevTools 独立 context、显式 pageId；复用 127.0.0.1:64248（启动记录和 HTTP 已检查）。快照+实际截图，三种天气、三节点、两种画质、1366×768 / 1920×1080。
- 通过正式 UI 验证切换渐变、反选、自动循环（真实时间，不改诊断）、驻足/暂停/失焦；只读采样检查没有突变。
- 采相同石河机位性能，保存平均/P95及 GPU/分辨率/画质；不把截图当用户验收。
- 更新 README、路线图、docs/reviews/phase-03-weather.md、来源台账；明确声音不做、阶段 4/5 未开始。
- 生成独立 artifacts/aotai-phase-03-weather-* 快照及哈希，不覆盖阶段 2。
