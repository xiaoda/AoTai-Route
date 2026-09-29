# 阶段 1：可行走原型实施计划

> 执行要求：使用 executing-plans 技能逐项实现与验证。本次已获得阶段 1 开发授权，由当前会话直接执行，不启动子代理，不自动进入阶段 2。

**目标：** 交付普通电脑浏览器可运行的简化山地徒步原型，支持真实碰撞、上下坡、暂停、设置与性能显示。

**架构：** React 管理界面，R3F 管理 Three.js 场景；独立 TypeScript 地形与 Rapier 运动模块同时供运行时和测试调用。视觉网格与碰撞体共享同一组地形三角形，物理固定步长、画面插值，UI 低频刷新。

**技术栈：** TypeScript、Vite、React、R3F、Three.js、Rapier、Vitest；配置使用轻量 React 状态，不为阶段 1 尚未需要的全局状态额外引入库。

**工作分支：** `feature/phase-01-walking-prototype`。在现有项目目录工作，便于用户直接预览；不修改 main，不自动推送。

## 设计约束

- 地形为原创确定性程序测试场景，非真实鳌太测绘；首页及体验中持续标识。
- 视觉方向：山野手记。深松绿、灰岩、米白与少量黄绿色点缀；宋体标题与清楚的中文界面文字。不下载字体或图片，不引入第三方视觉素材。
- 第一版没有环境音、自动漫步、完整天气和旅程存档；这些分别在后续阶段交付。设置可本地保存，不能称为旅程存档。
- 准备数据来源候选台账，不为原型下载尚未确定授权的真实地形。
- 不把无头浏览器 FPS 当作普通电脑性能保证。

## 工作组 A：工程与可测试基础

### 任务 1：建立工具链

文件：`package.json`、`package-lock.json`、`tsconfig.json`、`vite.config.ts`、`index.html`、`.gitignore`。

1. 固定互相兼容的稳定依赖版本，创建 npm 脚本 `dev`、`build`、`test`、`preview`。
2. Vite 只监听 `127.0.0.1`，启用严格端口与项目目录限制。
3. 安装依赖并记录锁文件；检查安装结果。

### 任务 2：先写地形、运动与设置测试

文件：`src/world/terrain.test.ts`、`src/world/simulation.test.ts`、`src/core/settings.test.ts`。

首个失败测试：

```ts
import { expect, test } from 'vitest';
import { buildTerrain } from './terrain';
test('地形输出确定且完整', () => {
  const a = buildTerrain();
  const b = buildTerrain();
  expect(a.positions).toEqual(b.positions);
  expect(a.positions.length).toBeGreaterThan(0);
  expect(a.indices.length % 3).toBe(0);
});
```

1. 创建测试并运行 `npm test`，确认在实现缺失时失败。
2. 地形测试覆盖顶点有限性、索引范围、采样与三角形一致性。
3. 运动测试覆盖 30／60／144 FPS 一致性、碰撞、上下坡、台阶、暂停与异常长帧。
4. 设置测试覆盖无效存储数据、数值边界和默认值。

## 工作组 B：可行走体验

### 任务 3：实现核心模块

文件：`src/world/terrain.ts`、`src/world/simulation.ts`、`src/core/settings.ts`。

1. 实现确定性山脊地形、步道颜色区域、测试岩石与边界。
2. 从相同网格建立 Rapier 静态三角网格，角色为胶囊运动学刚体。
3. 固定 1/60 秒物理步长，限制每帧累计时间；处理重力、贴地、坡度、跨小台阶。
4. 暂停时清空输入与累计时间，加入安全回到起点功能。
5. 运行 `npm test`，通过后再接界面。

### 任务 4：实现三维画面与输入

文件：`src/scene/Experience.tsx`、`src/scene/Landscape.tsx`、`src/core/input.ts`。

1. 场景只加载原创程序几何，光照与远山保持低成本。
2. 接入共享运动模块，画面按物理状态插值。
3. 支持 WASD、鼠标锁定转头、方向键转头；锁定失败提供拖动视角方式，不绕过浏览器限制。
4. 页面隐藏、窗口失焦、Esc 后停止移动并显示暂停界面。
5. 低频上报 FPS、帧时间、绘制量与位置用于 HUD 和测试；不使用 React 每帧刷新。

### 任务 5：实现完整原型界面

文件：`src/main.tsx`、`src/App.tsx`、`src/styles.css`。

1. 进入页显示测试地形说明、操作提示与真实加载状态。
2. 体验中提供简洁 HUD、暂停、设置、复位和可切换性能面板。
3. 设置包括灵敏度、视野、镜头晃动和节能／均衡画质。
4. 处理加载失败、无 WebGL2、指针锁定失败、存储异常、GPU 上下文丢失。
5. 运行 `npm run build` 校验 TypeScript 与生产构建。

## 工作组 C：验收与交付

### 任务 6：浏览器验证与记录

文件：`README.md`、`docs/reviews/phase-01.md`、`docs/assets/sources.md`、`docs/reviews/screenshots/phase-01-*.png`。

1. 启动仅监听回环地址的预览，保存进程号并确认真实端口。
2. Chrome DevTools 先 `list_pages`，再创建任务独占上下文与页面。
3. 页面快照验证开始、暂停、设置、复位和错误提示；截图后实际查看画面。
4. 浏览器验证运动输入、失焦清空输入、渲染状态；检查控制台错误。
5. 完整运行测试、构建和 `git diff --check`；记录真实指标与未验证项。
6. 保存可运行构建快照、源码版本与验收材料；如创建本地提交使用用户已指定身份，不自动推送。
7. 交付本地预览地址、操作说明、报告链接，等待阶段 1 用户体验反馈。

## 验收命令

```powershell
npm test
npm run build
git diff --check
```

预期：全部测试通过；类型检查与生产构建成功；无空白错误。阶段 1 的功能验证通过不等于已通过所有普通电脑的性能验证。

## 本次执行状态

- 工作组 A／B 已实现，18 项核心测试通过。
- 工作组 C 已完成开发预览功能、截图回传检查及 20 秒行走采样。
- 截图向项目目录落盘与新的生产预览进程启动被工具策略拒绝，未绕过；这些限制及待用户验收项见[验收记录](../reviews/phase-01.md)。
- 本次不进入阶段 2，不自动推送远程。
