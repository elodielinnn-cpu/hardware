# 微信空闲自动点击器（macOS）

当 Mac 同时满足以下条件时，程序会用鼠标点击一次 Dock（程序坞）中的微信图标：

- 屏幕保持唤醒且未锁定；
- 键盘和鼠标已连续 15 分钟没有操作；
- 距离上一次自动点击已至少 15 分钟。

程序每 60 秒检查一次状态，因此实际点击时间可能比 15 分钟最多晚约 1 分钟。它只点击微信图标，不读取微信内容，也不会发送消息。

## 要求

- macOS；
- Dock 中保留“微信”或“WeChat”图标；
- 系统已安装 Xcode Command Line Tools（可运行 `clang`）；
- 为安装后的程序授予“辅助功能”权限。

## 安装

在终端进入本目录后执行：

```bash
./install.sh
```

然后打开：

`系统设置 -> 隐私与安全性 -> 辅助功能`

把下面的应用加入并开启权限：

`~/Applications/WeChat Idle Clicker.app`

如果系统没有自动列出它，点击 `+` 后按 `Command + Shift + G`，粘贴上述完整路径并添加。授权后再执行一次：

```bash
launchctl kickstart -k "gui/$(id -u)/com.local.wechat-idle-clicker"
```

## 查看运行日志

```bash
tail -f "$HOME/Library/Logs/WeChatIdleClicker.log"
```

常见提示：

- `Accessibility permission is required`：尚未授予辅助功能权限；
- `WeChat icon was not found in the Dock`：请先把微信保留在 Dock 中；
- 没有日志：未满足条件时程序会安静退出，这是正常行为。

## 手动测试

以下命令忽略 15 分钟空闲条件，但仍要求屏幕未锁定，并会真实点击一次微信图标：

```bash
"$HOME/Applications/WeChat Idle Clicker.app/Contents/MacOS/wechat-idle-clicker" --test-click
```

## 卸载

```bash
./uninstall.sh
```

卸载脚本会停止定时任务并移除本工具安装的程序、状态和日志，不会卸载微信，也不会修改微信数据。
