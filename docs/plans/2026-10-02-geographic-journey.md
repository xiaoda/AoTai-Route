# 鳌太地理导览实施计划

> **执行方式：** 在当前会话逐项实施，遵循 executing-plans 检查点，不委派代理；旧阶段路线图暂不继续。

**Goal:** 把默认体验从虚拟山景样段改为有真实地理依据、明确来路与下一站的鳌太数字导览。

**Architecture:** 新建独立 JourneyApp，地图/节点/播放共享一个叙事状态；旧 App 保留为辅助地貌漫游，返回时保留导览位置。区域 DEM 与既有样段 DEM 分开，节点及来源单一配置；叙事连线不称 GPS 轨迹。

**Tech Stack:** 既有 React、TypeScript、SVG、Canvas 与 R3F/Three.js，不新增运行依赖。

## 已确认的体验方向
纸质地理图集风格：暖白、墨绿、朱砂路线；以大幅真实高程地形为主体，左侧短叙事，底部地点序列。默认先看鳌山—太白山全貌，再启程；播放到节点驻足；可前后切换、重播、查看来源。提供重点节点三维地形观察，不将原虚拟石河标为真实地标。继续无声，不改原稳定镜头规则。

## 任务 1：证据与区域地形
- 新建 src/journey/landmarks.ts：有来源坐标、文本、证据强度、叙事顺序。
- 新建 scripts/import-journey-terrain.mjs：复用 scripts/dem.mjs 解析、下载公开 S3 DEM、缓存/哈希/来源检查；产出 public/journey/relief.png 与 terrain.json，记录来源。
- 覆盖测试：坐标范围、投影往返、资产网格长度、高程有限性、固定来源与节点顺序。先写失败测试再实现。

## 任务 2：叙事状态
- 新建 src/journey/model.ts 与 model.test.ts。纯函数管理 overview / travelling / arrived / complete、章节选择、暂停/恢复、速度、可见性冻结。转场时间是展示时间，不显示伪造徒步里程。
- 下一站明确；选择节点不把未看地点记为已看；完成仅指本次数字导览。
- 节点连接线明确为简化方向示意，不引入未经核实的中间轨迹。

## 任务 3：地图与界面
- 新建 src/JourneyApp.tsx、src/journey/JourneyMap.tsx、src/journey/journey.css。修改 src/main.tsx 默认入口。
- 真实比例地形、可点节点、当前点、已浏览轨迹、起终点、北向、来源；整体/当前段切换。
- 大爷海/拔仙台紧邻，标签引线避免重叠，近景独立聚焦。
- 资料弹窗用原生 dialog、焦点恢复、Esc；无障碍名称、键盘操作、减弱动态；窄屏上下布局而非挤压地图。

## 任务 4：真实 DEM 三维观察与旧样段
- 新建 src/journey/TerrainView.tsx：加载同源高程，可辨识实际山形；有限相机机位、无抖动、不假称实景。显式说明无摄影纹理/湖岸复刻。失败时地图仍可用。
- 旧 App lazy 加载并提供返回导览；进入时暂停播放；返回保留地点。旧虚拟路线/天气/碰撞不改。

## 任务 5：验证与文档
- node.exe node_modules/vitest/vitest.mjs run --pool=threads（隐藏直启、日志 .preview）。
- node.exe node_modules/typescript/bin/tsc --noEmit，然后单独 node.exe node_modules/vite/bin/vite.js build。
- Chrome DevTools：独立 context + 显式 pageId，截图及快照；检验启程、抵达、暂停、回顾、节点跳转、完成、重播、三维、返回旧样段、窄屏和键盘；检查控制台及生产构建。
- 更新 README.md、docs/assets/sources.md 和 docs/reviews/2026-10-02-journey.md，明确已实现边界和尚未实景还原的部分。

## 验收标准
打开就看懂鳌山与太白山的相对位置；每段知道从哪里来、往哪里去；至少数个有资料依据的真实地名不被虚拟节点替代；看完能回顾认识过的地点；不将叙事示意、未验证轨迹或艺术样段宣传为现实路线。
