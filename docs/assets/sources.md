# 数据、资产与参考来源台账

日期：2026-09-29。当前版本：阶段 2 / v0.2.0。

## 真实高程（已使用）

| 项目 | 实际内容 |
| --- | --- |
| 提供方 | Mapzen Terrain Tiles / AWS Open Data；Terrarium z12 |
| 原始瓦片 | 12/3273/1636、12/3274/1636、12/3273/1637、12/3274/1637 |
| 原始来源证据 | HTTP 的 x-amz-meta-x-imagery-sources 实际列出 srtm/N33E107.tif、srtm/N34E107.tif；完整响应元数据与每瓦片 SHA256 在 src/data/taibai-dem.json |
| 获取时间 | 2026-09-29；上游 Last-Modified 为 2017 年，不能称为最新测绘 |
| 协议 / 权限 | AWS 公共只读 HTTPS，无账号、密钥或用户数据上传 |
| 高程编码 | R×256+G+B/256−32768，米；PNG CRC、位深、颜色类型、尺寸与空值检查 |
| 坐标 | 源瓦片 Web Mercator，WGS84 经纬度；局部东-上-南米制，原点处 WGS84 曲率半径近似，非精密工程投影 |
| 原点 | 107.76528 E、33.95512 N；高山区候选定位，不把该点称为实测峰顶 |
| 垂直基准 | SRTM EGM96 源高程；渲染仅减去 3000 m，无高度夸大 |
| 精度边界 | 瓦片像素间距约 31.7 m；上游说明 SRTM 约 30 m 采样、90 m 名义质量。8 m 近景网格为插值，不增加实测精度 |
| 近景 / 远景 | 1024 m / 128 段；8192 m / 128 段；近景边界细分三角扇缝合，不靠裙边遮洞 |
| 文件体积 | 原始 4 瓦片共 233346 字节；衍生 JSON 202338 字节 |
| 数据检查 | 近景 3286.9—3752.8 m；全范围 1965.1—3752.8 m；采样无空值；4 个独立保存的源采样对照点误差 < 0.051 m（只是转换/量化误差，不是测量精度） |
| 发布署名 | public/terrain-sources.txt；首页与小地图有入口，保留服务完整署名 |

源数据注册与说明：
- [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/)
- [Terrarium 格式](https://github.com/tilezen/joerd/blob/master/docs/formats.md)
- [来源、分辨率及重采样限制](https://github.com/tilezen/joerd/blob/master/docs/data-sources.md)
- [Mapzen 署名要求](https://github.com/tilezen/joerd/blob/master/docs/attribution.md)
- [USGS 数据与版权说明](https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits)

许可证采用数据提供方的要求；**不是把数据本身误标成 joerd 代码的 MIT 许可**。当前裁切区的 HTTP 元数据仅含 USGS SRTM，按其公共数据说明使用并署名；其他国家数据源未用于样段。来源变化会使导入脚本停止并要求复核。

原始 PNG 仅在 .preview/terrain-source/ 缓存，不提交整个地球/全国地形。已记录哈希的缓存可重建相同 JSON。Skadi 大文件最初下载超时，未用于最终产物。

## 地貌与照片参考（仅对照，不再分发）

[国家林业和草原局《中国绿色时报：大秦岭的封面太白山》](https://www.forestry.gov.cn/c/www/ztq/13099.jhtml)，2021-08-27。资料说明高山区的岩石、草甸和石河地貌；已查看文中赵侠摄石河照片、周丽莉摄峰顶照片，作为材质/形状参考。照片仅本机对照，未写入 public、src 或构建快照，也未作为纹理采样。

[PeakWiki 拔仙台条目](https://www.peakwiki.org/peak.php?pid=39)仅辅助选择高山区的候选中心，地形本身来自上述 DEM，不把社区坐标当作测量控制点。照片和渲染视点不相同，不能宣传为逐像素或同机位复刻。

## 原创艺术重建

| 资源 | 位置 | 范围与限制 |
| --- | --- | --- |
| 约 383 m 体验路径与石海观景点 | world/route.ts、terrain.ts | 人工编排的虚拟位置，不是 GPS，不据此判断现实通行 |
| 三组不规则岩块 | world/rockShape.ts | 原创凸包，显示/碰撞顶点与坡面四元数共用；非逐石扫描 |
| 近景碎石 | scene/Landscape.tsx | 低矮视觉细节，无独立碰撞；大岩石仍有碰撞 |
| 草簇、地表材质 | scene/Landscape.tsx | 原创程序几何/着色，不做当地植物种类或覆盖度实测声明 |
| 山体 | world/elevation.ts、terrain.ts | 源高程插值/降采样；没有添加随机山峰或削平步道 |
| 光照、天空、静态空气透视 | scene/Landscape.tsx | 编排的天气/光线状态，不是实况 |
| UI 标志与图示 | 项目 SVG/CSS | 原创；地图等高线来自 DEM，路径为虚拟 |
| 字体 | 本机既有系统字体 | 未复制或分发字体文件，无线上字体请求 |
| 音频 | 无 | 第三阶段再落实 |

## 历史阶段

阶段 1 / 1.1 全部使用原创程序测试地形、环带远山、低面数占位资产；该版本未使用真实数据。旧版本保存在 Git 历史和原有构建快照中，不能用当前高程说明回填为历史真实性。

Copernicus GLO-30 曾为候选，但本次未使用，不应在产物中署名为其来源。

## 运行依赖

React / React DOM 19.3.0（MIT）、Three.js 0.186.1（MIT）、R3F 9.8.1（MIT）、Rapier compat 0.21.0（Apache-2.0）；阶段 2 未增加运行依赖。完整分发许可见 public/THIRD_PARTY_NOTICES.txt 与锁文件。打包仅复用既有 fflate，不加入运行时请求。
