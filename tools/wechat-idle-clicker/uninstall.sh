#!/bin/zsh

set -euo pipefail

install_dir="$HOME/Library/Application Support/WeChatIdleClicker"
launch_agent="$HOME/Library/LaunchAgents/com.local.wechat-idle-clicker.plist"
log_path="$HOME/Library/Logs/WeChatIdleClicker.log"
domain="gui/$(id -u)"

launchctl bootout "$domain" "$launch_agent" 2>/dev/null || true
rm -f "$launch_agent"
rm -rf "$install_dir"
rm -f "$log_path"

print "微信空闲自动点击器已卸载。"
