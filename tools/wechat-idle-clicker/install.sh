#!/bin/zsh

set -euo pipefail

script_dir=${0:A:h}
source_file="$script_dir/Sources/main.m"
install_dir="$HOME/Library/Application Support/WeChatIdleClicker"
binary_path="$install_dir/wechat-idle-clicker"
launch_agent="$HOME/Library/LaunchAgents/com.local.wechat-idle-clicker.plist"
log_path="$HOME/Library/Logs/WeChatIdleClicker.log"
label="com.local.wechat-idle-clicker"
domain="gui/$(id -u)"
temporary_binary=$(mktemp "${TMPDIR:-/tmp}/wechat-idle-clicker.XXXXXX")

cleanup() {
  rm -f "$temporary_binary"
}
trap cleanup EXIT

if ! command -v clang >/dev/null 2>&1; then
  print -u2 "未找到 clang。请先安装 Xcode Command Line Tools：xcode-select --install"
  exit 1
fi

mkdir -p "$install_dir" "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
clang -fobjc-arc -O2 \
  -framework AppKit \
  -framework ApplicationServices \
  -framework IOKit \
  "$source_file" \
  -o "$temporary_binary"
install -m 755 "$temporary_binary" "$binary_path"

cat > "$launch_agent" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$label</string>
  <key>ProgramArguments</key>
  <array>
    <string>$binary_path</string>
  </array>
  <key>StartInterval</key>
  <integer>60</integer>
  <key>ProcessType</key>
  <string>Background</string>
  <key>StandardOutPath</key>
  <string>$log_path</string>
  <key>StandardErrorPath</key>
  <string>$log_path</string>
</dict>
</plist>
PLIST

plutil -lint "$launch_agent"
launchctl bootout "$domain" "$launch_agent" 2>/dev/null || true
launchctl bootstrap "$domain" "$launch_agent"

print "安装完成。"
print "下一步：在“系统设置 -> 隐私与安全性 -> 辅助功能”中允许："
print "$binary_path"
print "授权后运行：launchctl kickstart -k \"$domain/$label\""
