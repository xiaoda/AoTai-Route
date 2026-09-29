# 本项目的 Windows 执行补充约定

## 黑窗口闪现：临时规避（2026-09-29）

用户多次确认执行任务时有黑色命令窗口闪现，并反馈与近期 Codex 更新时间接近。根因尚未确认，不可把设置了隐藏参数或退出码为 0 当作已彻底解决。

- 当前 Windows 会话暂不再使用 exec_command 的 PowerShell/npm/Git 启动链。只在明确需要、已重新验证其窗口行为后再评估恢复。
- 读写文件优先通过 node_repl 的 node:fs/promises，避免为了 Get-Content、目录查询或修改文件启动 shell。
- 执行工具优先通过 node_repl 导入 node:child_process，直接调用已确认存在的 .exe 与参数数组；显式设置 windowsHide: true、shell: false、stdio: ['ignore', 'pipe', 'pipe'] 和项目 cwd。
- 测试直接调用 node.exe + node_modules/vitest/vitest.mjs run --pool=threads；不走 npm.cmd、npx.cmd、node_modules/.bin/*.cmd，避免测试 fork 额外创建控制台进程。
- 类型检查直接调用 node.exe + node_modules/typescript/bin/tsc --noEmit；构建再单独调用 node.exe + node_modules/vite/bin/vite.js build；不要用 && 或 shell 拼接。
- Git 若需要，直接调用已确认路径的 git.exe；仍需留意 hooks、SSH、凭据交互等进一步子进程，不能笼统保证均已隐藏。不得隐藏必须让用户处理的授权。
- 每次执行记录 PID、cwd、实际程序与参数、开始结束时间、退出码、stdout/stderr；日志放本项目 .preview/ 下。不捕获或输出凭据。
- 复用本任务已有预览服务，不为了此次问题重启服务、关闭其他终端或全局杀进程。
- 不修改全局注册表、Windows 默认终端、安全策略、Codex 安装包或依赖源码；不部署全局隐藏脚本。
- 新方式已完成 Node 版本检查与 27 项测试；是否仍可见闪窗需用户侧反馈，不能自行宣称已根治。

浏览器继续遵循用户原有约定：Chrome DevTools MCP、任务独立 context、显式 pageId、仅本机 HTTP、截图与快照验收。
