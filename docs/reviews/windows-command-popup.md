# Windows 黑窗口闪现排查记录

日期：2026-09-29。状态：临时规避已验证命令执行成功，根因和用户侧无弹窗效果尚未确认。

## 用户现象

执行期间出现黑色窗口，部分一闪即逝，部分停留稍久。用户认为近期 Codex 更新前没有此现象。之前只使用非交互/不加载 profile，并不足以证明整个启动链无控制台窗口。

## 本地只读证据

- 本机 npm 的 @npmcli/run-script/lib/make-spawn-args.js 使用 shell: scriptShell，没有显式传递 windowsHide；@npmcli/promise-spawn/lib/index.js 在 Windows 的 shell 路径使用 cmd.exe。
- 当前 Vitest dist/chunks/index.C-uw7tH9.js 的 fork 池没有显式 windowsHide；线程池使用 Worker。这些是潜在触发条件，不是对历史弹窗 PID 的归因。
- 9 月 28 日 10:08（北京时间）的 Codex 日志报告 app-server 0.155.0-alpha.16.4；10:09 已报告 0.158.0-alpha.2.1。
- 9 月 29 日 10:00 的启动日志仍报告 app-server 0.158.0-alpha.2.1。当天运行时安装日志先出现 bundle 26.927.11222，随后计划更新安装 26.909.12148。版本号及安装行为不等于弹窗根因。
- 官方 2026-09-28 的 CLI 0.158.0 更新记录包含共享子进程启动器调整，但本机后端是 alpha 版本，不能仅据此认定某个提交导致本问题。
- 系统 WindowsApps 目录读取被拒绝后没有修改权限或尝试绕过；后续仅读取当前用户 Codex 日志，筛选版本/更新字段，不上传原始日志。

## 当前规避

发现并使用已配置的 node_repl 工具。读取文件不启动 shell。需要执行时以 node:child_process 直接启动程序，shell:false + windowsHide:true + 重定向输出；测试改用线程池。

2026-09-29 16:35（北京时间）的新通道验证：

- Node --version：PID 9504，退出码 0，v24.14.0。
- Vitest run --pool=threads：PID 28792，退出码 0，6 文件 / 27 测试通过。
- 日志：.preview/background-check/ 下的 JSON、stdout、stderr。
- 用户尚未确认这两次检查是否仍然闪窗，不能将其报告为已修复。

本项目 AGENTS.md 已记录临时执行方式。没有修改产品业务代码、npm/Vitest 源码、Codex 安装或全局 Windows 设置；没有重启现有预览服务。

## 官方参考

https://learn.chatgpt.com/docs/changelog
https://learn.chatgpt.com/docs/windows/windows-app

下一步优先依据用户对新通道的可见窗口反馈；若继续弹出，再捕获具体进程与父进程证据，不盲目重复旧命令或建议关闭安全策略。
