# 阶段 1.1 Implementation Plan

> 使用 executing-plans 技能逐项执行；当前会话单代理完成，不另启子代理。沿用已存在的阶段一功能分支与本地预览服务。

**Goal:** 让用户以更快的半空视角自动看景，同时通过小地图知道所处位置。

**Architecture:** 路径、位置投影与自动游览为独立可测试 TypeScript 模块。R3F 使用活动模式的位姿控制相机并低频发布遥测；React SVG 地图消费相同路线和位姿。原 Rapier 徒步不改动。

**Tech Stack:** 现有 React、Three.js / R3F、TypeScript、Vitest，无新增依赖。

---

### 1. 路径与自动游览核心

创建 `src/world/route.test.ts` 和 `src/world/tour.test.ts`，先运行 `npm test -- src/world/route.test.ts src/world/tour.test.ts`，确认缺少实现时失败。

创建 `src/world/route.ts`：固定起点 z=62、终点 z=-116，1 米采样，累计弧长、距离采样、最近点投影、世界到地图坐标转换。创建 `src/world/tour.ts`：`advance`、`seek`、`reset`、`pose`、终点状态；非法输入不推进，单次 delta 最大 0.1 秒。

再次运行两组测试，要求全部通过；检查路线始终在 280 米测试地形内。

### 2. 相机与遥测

修改 `src/scene/Experience.tsx`，增加 travel / speed / altitude / recenterToken 和 onTelemetry / onComplete。沿路线前方切线作为相机基准方向，叠加独立的环顾偏移。暂停时保持相机不漂移。模式切换保留徒步位置、清空按键；重置清空两种进度。

地图遥测 10 Hz，性能统计仍 2 Hz。只读诊断记录活动位置、漫游进度、相机位置，便于验证。运行 `npm run build`，要求类型检查通过。

### 3. 界面和小地图

创建 `src/components/MiniMap.tsx`，绘制同源路径、进度、当前位置、视线方向、起终点和比例尺；地图标注非实地导航。修改 `src/App.tsx` 与 `src/styles.css`：双入口、暂停模式切换、漫游速度/高度、视角回正、终点重游；性能面板与地图不重叠，控制按钮键盘可操作。

### 4. 回归与交付

执行 `npm test`、`npm run build`；在已有 `127.0.0.1:49400` 开发服务新建本任务隔离页面。读取快照、查看截图，实际测试主流程/失焦/暂停/终点/模式切换/地图，记录真实测量结果到 `docs/reviews/phase-01-1.md`。截图仅用允许的工具回传，不绕过文件写入限制。

更新 README 的实现范围与操作说明，不覆盖阶段一历史验收报告。不推送或部署；本地提交记录本阶段增量。
