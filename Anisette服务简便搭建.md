# Anisette 服务器搭建与开机自启动完整指南

> 可在私人电脑配置服务器，后台运行，平时无感刷新，靠别报错

本文档已整合**协议规范修复、App 连通性探测 (HEAD/OPTIONS) 修复、开机静默自启动与公网穿透**，可直接一键复制执行。

---

## 目录

- [一、Windows Server 部署（含开机自启与公网穿透）](#%E4%B8%80windows-server-%E9%83%A8%E7%BD%B2%E5%90%AB%E5%BC%80%E6%9C%BA%E8%87%AA%E5%90%AF%E4%B8%8E%E5%85%AC%E7%BD%91%E7%A9%BF%E9%80%8F)
- [二、macOS (Mac mini / MacBook) 部署（真机原生免风控）](#%E4%BA%8Cmacos-mac-mini--macbook-%E9%83%A8%E7%BD%B2%E7%9C%9F%E6%9C%BA%E5%8E%9F%E7%94%9F%E5%85%8D%E9%A3%8E%E6%8E%A7)
- [三、手机端与小火箭使用配置](#%E4%B8%89%E6%89%8B%E6%9C%BA%E7%AB%AF%E4%B8%8E%E5%B0%8F%E7%81%AB%E7%AE%AD%E4%BD%BF%E7%94%A8%E9%85%8D%E7%BD%AE)

---

## 一、Windows Server 部署（含开机自启与公网穿透）

### 前提条件

1. 已安装官方 Windows 版 iTunes（需在菜单栏点击 `账户` -&gt; `授权` -&gt; `对这台电脑授权`）。
2. 将 `AltWindowsAnisette.exe` 放置在 `C:\anisette-server\` 目录下。

### 1. 一键创建服务代码与开机自启（PowerShell 管理员运行）

打开 PowerShell，直接复制粘贴以下整段代码回车：

```powershell
# 1. 确保目录存在
mkdir C:\anisette-server -ErrorAction SilentlyContinue
cd C:\anisette-server

# 2. 写入全兼容版服务端代码 server.py
@'
import subprocess
import json
import http.server
import socketserver

WIN_CLIENT_INFO = "<PC> <Windows;6.2(0,0);9200> <com.apple.AuthKit/1 (com.apple.iTunes/12.12.4.1)>"
WIN_USER_AGENT = "akd/1.0 CFNetwork/808.1.4"

def get_anisette_headers():
    try:
        res = subprocess.run(["AltWindowsAnisette.exe"], capture_output=True, text=True, check=True)
        headers = {}
        for line in res.stdout.splitlines():
            if ": " in line:
                k, v = line.split(": ", 1)
                headers[k.strip()] = v.strip()
        headers["X-MMe-Client-Info"] = WIN_CLIENT_INFO
        return headers
    except Exception as e:
        print(f"[-] Error: {e}")
        return None

class AnisetteHandler(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def handle_request(self, is_head=False):
        clean_path = self.path.split('?')[0].rstrip('/')
        
        # 路由 1: /v3/client_info
        if clean_path.endswith("/v3/client_info"):
            data = {"client_info": WIN_CLIENT_INFO, "user_agent": WIN_USER_AGENT}
            body = json.dumps(data).encode('utf-8')
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Connection", "close")
            self.end_headers()
            if not is_head:
                self.wfile.write(body)
            return

        # 路由 2: 根路径 GET /
        anisette = get_anisette_headers()
        if not anisette:
            self.send_response(500)
            self.end_headers()
            if not is_head:
                self.wfile.write(b"Error generating anisette")
            return

        body = json.dumps(anisette).encode('utf-8')
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Connection", "close")
        self.end_headers()
        if not is_head:
            self.wfile.write(body)

    def do_GET(self):
        self.handle_request(is_head=False)

    def do_HEAD(self):
        self.handle_request(is_head=True)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Content-Length", "0")
        self.send_header("Connection", "close")
        self.end_headers()

    def log_message(self, format, *args):
        pass

if __name__ == '__main__':
    PORT = 6969
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("0.0.0.0", PORT), AnisetteHandler) as httpd:
        print(f"[*] Anisette 服务已就绪，端口: {PORT}")
        httpd.serve_forever()
'@ | Out-File -FilePath "C:\anisette-server\server.py" -Encoding utf8

# 3. 生成静默启动脚本 start.vbs
$py = (Get-Command python).Source
@"
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\anisette-server"
WshShell.Run """$py"" C:\anisette-server\server.py", 0, False
"@ | Out-File -FilePath "C:\anisette-server\start.vbs" -Encoding ascii

# 4. 注册系统开机自启任务
schtasks /create /tn "AnisetteServer" /tr "wscript.exe C:\anisette-server\start.vbs" /sc onstart /ru "Administrator" /f

# 5. 立即启动服务
taskkill /F /IM python.exe 2>$null
wscript.exe C:\anisette-server\start.vbs
Start-Sleep -Seconds 1
netstat -ano | findstr 6969
```

### 2. 开启公网永久穿透（Tailscale Funnel）

在 PowerShell 中运行以下命令，持久化后台开启（**电脑重启后仍永久保持生效**）：

```powershell
tailscale funnel --bg 6969
```

查看并获取专属公网网址：

```powershell
tailscale funnel status
```

*获得固定公网网址，如：*`https://*********.taild08d8b.ts.net`*。*

---

## 二、macOS (Mac mini / MacBook) 部署（真机原生免风控）

> **说明：** 调用 macOS 原生私有框架 `AOSKit`，100% 成功率，免风控，完美支持所有双重验证。

### 1. 终端一键部署并编译原生程序

在 Mac 终端中直接粘贴执行：

```bash
# 1. 创建工作目录
mkdir -p ~/anisette-mac
cd ~/anisette-mac

# 2. 写入原生指纹提取源码
cat << 'EOF' > anisette_gen.m
#import <Foundation/Foundation.h>

@interface AOSUtilities : NSObject
+ (NSDictionary *)retrieveOTPHeadersForDSID:(NSString *)dsid;
@end

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        NSDictionary *headers = [AOSUtilities retrieveOTPHeadersForDSID:@"-2"];
        if (!headers || headers.count == 0) {
            return 1;
        }
        NSMutableDictionary *res = [headers mutableCopy];
        res[@"X-Apple-I-SRL-NO"] = @"0";
        res[@"X-MMe-Client-Info"] = @"<MacBookPro13,3> <Mac OS X;10.12.6;16G29> <com.apple.AuthKit/1 (com.apple.akd/1.0)>";
        
        NSData *jsonData = [NSJSONSerialization dataWithJSONObject:res options:0 error:nil];
        NSString *jsonStr = [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];
        printf("%s\n", [jsonStr UTF8String]);
    }
    return 0;
}
EOF

# 3. 编译二进制程序
clang -fobjc-arc -framework Foundation -F/System/Library/PrivateFrameworks -framework AOSKit -o anisette_gen anisette_gen.m

# 4. 写入服务端 server.py
cat << 'EOF' > server.py
import subprocess
import json
import http.server
import socketserver
import os

MAC_CLIENT_INFO = "<MacBookPro13,3> <Mac OS X;10.12.6;16G29> <com.apple.AuthKit/1 (com.apple.akd/1.0)>"
MAC_USER_AGENT = "akd/1.0 CFNetwork/811.5.4 Darwin/16.7.0"
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
GEN_BIN = os.path.join(CURRENT_DIR, "anisette_gen")

def get_anisette_headers():
    try:
        res = subprocess.run([GEN_BIN], capture_output=True, text=True, check=True)
        headers = json.loads(res.stdout.strip())
        headers["X-MMe-Client-Info"] = MAC_CLIENT_INFO
        return headers
    except Exception as e:
        print(f"[-] Error: {e}")
        return None

class MacAnisetteHandler(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def handle_request(self, is_head=False):
        clean_path = self.path.split('?')[0].rstrip('/')
        if clean_path.endswith("/v3/client_info"):
            data = {"client_info": MAC_CLIENT_INFO, "user_agent": MAC_USER_AGENT}
            body = json.dumps(data).encode('utf-8')
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Connection", "close")
            self.end_headers()
            if not is_head:
                self.wfile.write(body)
            return

        headers = get_anisette_headers()
        if not headers:
            self.send_response(500)
            self.end_headers()
            if not is_head:
                self.wfile.write(b"Error")
            return

        body = json.dumps(headers).encode('utf-8')
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Connection", "close")
        self.end_headers()
        if not is_head:
            self.wfile.write(body)

    def do_GET(self):
        self.handle_request(is_head=False)

    def do_HEAD(self):
        self.handle_request(is_head=True)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Content-Length", "0")
        self.send_header("Connection", "close")
        self.end_headers()

    def log_message(self, format, *args):
        pass

if __name__ == '__main__':
    PORT = 6969
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("0.0.0.0", PORT), MacAnisetteHandler) as httpd:
        print(f"[*] Mac Anisette 服务已就绪，端口: {PORT}")
        httpd.serve_forever()
EOF

# 5. 后台常驻运行
nohup python3 server.py > server.log 2>&1 &
```

### 2. Mac 开机自启动配置（Launchd）

```bash
cat << EOF > ~/Library/LaunchAgents/com.user.anisette.plist
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.user.anisette</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>$HOME/anisette-mac/server.py</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
EOF

launchctl load ~/Library/LaunchAgents/com.user.anisette.plist
```

---

## 三、手机端与小火箭使用配置

1. **手机端网络状态：** 正常开启**小火箭（Shadowrocket）**，手机无需安装或开启 Tailscale。

2. **填入 App 地址：** 打开 **Gnoix** 或 **iloader**，在 Anisette 服务器地址中填入穿透后的固定域名（**末尾不要加斜杠** `/`）：

   ```text
   https://**********.taild08d8b.ts.net
   ```

3. 点击“测试连接”，验证成功亮绿灯后，即可正常完成 Apple ID 登录与 7 天证书签名！
