# 桌面 App 打包设计 — Local API Key Tester

日期：2026-06-02
状态：已实现

## 目标

把现有的本地 Web 应用（Python 后端 `server.py` + 前端 `index.html`/`style.css`/`js/`）封装成一个**独立窗口的桌面 app**，双击即用、无需用户预装 Python。目标平台：**macOS 和 Windows**。

## 选定方案：pywebview + PyInstaller

- **pywebview**：Python 库，调用系统原生网页内核（macOS = WKWebView，Windows = Edge WebView2）开一个原生窗口。
- 现有 `server.py` 几乎不动，继续作为本地 HTTP 后端在后台线程运行；窗口加载 `http://127.0.0.1:<端口>`。代理 API、文件存档、网页搜索功能原样保留。
- **PyInstaller**：把 Python 运行时 + `server.py` + 前端资源打包成 `.app`（Mac）/ `.exe`（Windows），完全独立。

被否决的方案：Electron（体积大、需维护 JS 壳 + Python 双栈）、Tauri（需引入 Rust 工具链）。

## 文件结构

```
api/
├─ app.py            ← 新增：桌面启动器
├─ server.py         ← 改造：静态资源目录与数据目录分离
├─ build.spec        ← 新增：PyInstaller 打包配置（Mac/Win 通用）
├─ build.md          ← 新增：两平台构建步骤
├─ requirements.txt  ← 新增：pywebview、pyinstaller
└─ (index.html / style.css / js/ 不变)
```

## 模块职责

### `app.py`（桌面启动器，新增）
单一职责：起服务 + 开窗口。
1. 选一个空闲端口（绑定 `127.0.0.1`，让 OS 分配空闲端口）。
2. 在后台**守护线程**里启动现有 HTTP 服务，传入正确的静态资源目录和数据目录。
3. 用 pywebview 创建原生窗口，加载 `http://127.0.0.1:<端口>`。
4. 窗口关闭 → 主线程退出 → 守护线程随进程结束。

### `server.py`（改造）
当前把所有路径写死在单个 `BASE_DIR`。改为区分两类目录：
- **`STATIC_DIR`**：前端只读资源（`index.html`/`style.css`/`js/`）。打包后指向 PyInstaller 解压目录（`sys._MEIPASS`）。
- **`DATA_DIR`**：可写存档（`settings.json`/`conversations.json`）。指向系统用户数据目录。

改造要点：
- `Handler` 提供静态文件时从 `STATIC_DIR` 读；`_file_read` / `_file_write` 从 `DATA_DIR` 读写。
- 提供一个可被 `app.py` 调用的函数（如 `run_server(host, port, static_dir, data_dir)`），同时保留 `if __name__ == '__main__'` 的 CLI 入口。
- **向后兼容**：直接 `python3 server.py` 仍可用，默认 `STATIC_DIR` 和 `DATA_DIR` 都为脚本所在目录，行为与现状一致。

## 路径处理（关键设计点）

### 静态资源（只读）
打包时把 `index.html`、`style.css`、`js/` 作为 data 文件塞进去；运行时：
- 已打包（frozen）：`STATIC_DIR = sys._MEIPASS`
- 未打包（开发）：`STATIC_DIR = 脚本所在目录`

### 存档文件（可写）
存到系统标准用户数据目录（与 Chrome / VS Code 等一致）：
- macOS：`~/Library/Application Support/APITester/`
- Windows：`%APPDATA%\APITester\`

行为：
- 首次运行自动创建该目录。
- `settings.json` / `conversations.json` 不存在时按现有逻辑处理（前端已能容忍 404）。
- app 升级 / 重装不影响该目录，数据不丢。

> 说明：可写数据无法持久化在 `.app` / `.exe` 内部——运行时它们是只读的，PyInstaller onefile 每次启动解压到临时目录且退出即清空。这是 OS / 打包机制的硬限制，故采用标准用户数据目录方案。

## 数据流（与现状一致）

```
pywebview 窗口（前端）
  → fetch http://127.0.0.1:<端口>/proxy | /file | /search   (同源)
    → server.py 处理（代理第三方 API / 读写 DATA_DIR / 网页搜索）
```

前端已用 `window.location.origin` 与相对路径 `/file` 调后端，**前端业务代码无需改动**。同源后 CORS 不再必要（保留无妨）。

## 前端文案小修（随手做）

以下位置仍提示"运行 python3 server.py / 打开 http://localhost:8080"，在桌面版中已过时，改为中性文案：
- `js/events.js`（Web Search 相关 toast）
- `js/search.js`（错误提示）
- `index.html`（Web Search 说明文字）
- `js/helpers.js`（fetch 失败提示，酌情）

## 构建与验证

### macOS（在本机构建验证）
1. `python3 -m venv` 或直接装依赖：`pip install -r requirements.txt`
2. `pyinstaller build.spec` → 产出 `dist/APITester.app`
3. 打开 app，验证：窗口正常、能发请求/收到响应、存档写入 `~/Library/Application Support/APITester/`。

### Windows（用户在 Windows 上构建）
1. `pip install -r requirements.txt`（Edge WebView2 运行时 Win10/11 基本自带）
2. `pyinstaller build.spec` → 产出 `dist\APITester.exe`
3. 步骤写入 `build.md`。

> PyInstaller 不支持跨平台出包：Mac 版必须在 Mac 构建，Windows 版必须在 Windows 构建。

## 不在本次范围（YAGNI）

- 代码签名 / 公证（Mac Gatekeeper、Win SmartScreen 会提示"未知开发者"，不影响自用）。
- 自动更新机制。
- 便携模式（存档放 app 旁）——已评估，默认采用用户数据目录；如后续需要可低成本切换。

## 验收标准

1. macOS 上双击 `APITester.app` 打开原生窗口，无需预装 Python。
2. 可正常聊天（代理 API）、改设置、网页搜索。
3. 设置与会话写入用户数据目录，重启 app 后数据仍在。
4. `python3 server.py` 老用法仍然可用，行为不变。
5. Windows 构建步骤齐备（`build.spec` + `build.md`），用户可自行出 `.exe`。
