<h1 align="center">local-API-key-testing-website</h1>

<p align="center"><strong>一个面向多家 AI 提供商的本地 API Key 测试网站。</strong></p>

<p align="center">
  提供一个简洁的本地 Web 界面和后端服务，用于测试不同 AI 模型提供商的 API Key。<br>
  现已提供 macOS 和 Windows 独立桌面版。
</p>

<p align="center">
</p>

<p align="center">中文 | <a href="./README.md">English</a></p>

## 桌面版（推荐）

从 [Releases](https://github.com/XXD051030/local-API-key-testing-website/releases) 下载独立桌面版，无需安装 Python、双击即用：

* **macOS**：下载 `APITester-macOS.zip`，解压后打开 `APITester.app`。首次打开若提示未知开发者，请右键点击 app 并选择「打开」。
* **Windows**：下载 `APITester.exe` 双击运行。若出现 SmartScreen 提示，点击「更多信息」→「仍要运行」。

设置与会话数据保存在系统用户数据目录中，升级或重装 app 都不会丢失：

* macOS：`~/Library/Application Support/APITester/`
* Windows：`%APPDATA%\APITester\`

想自行构建请参考 [build.md](./build.md)。

## 从源码运行

运行要求：Python 3.x

### Windows

1. 在项目目录中打开 `PowerShell` 或 `命令提示符`。
2. 使用默认端口 `8080` 启动本地服务：
   ```powershell
   py server.py
   ```
3. 如需使用自定义端口，例如 `9000`：
   ```powershell
   py server.py 9000
   ```
4. 打开浏览器并访问 `http://localhost:8080`，如果使用了自定义端口，则访问 `http://localhost:<your-port>`。
5. 如果需要让同一局域网中的其他设备访问，可打开 `http://<your-local-ip>:8080`，或访问 `http://<your-local-ip>:<your-port>`。

### macOS/Linux

1. 在项目目录中打开 `Terminal`。
2. 使用默认端口 `8080` 启动本地服务：
   ```bash
   python3 server.py
   ```
3. 如需使用自定义端口，例如 `9000`：
   ```bash
   python3 server.py 9000
   ```
4. 打开浏览器并访问 `http://localhost:8080`，如果使用了自定义端口，则访问 `http://localhost:<your-port>`。
5. 如果需要让同一局域网中的其他设备访问，可打开 `http://<your-local-ip>:8080`，或访问 `http://<your-local-ip>:<your-port>`。

## 联网搜索

现在可以在把问题发送给当前聊天模型之前，先做一次网页搜索，再把最新结果作为上下文提供给模型。

1. 打开桌面版 app；或从源码启动后端（`python3 server.py` / `py server.py`）并访问 `http://localhost:8080`。
2. 进入 `Settings -> Web Search`，在 `Brave` 和 `Tavily` 中选择一个当前 provider。
3. 展开 `Provider API Key`，填写当前 provider 对应的 API Key。
4. 在模型选择器右侧打开 `Web Search` 开关，即可为当前聊天请求启用联网搜索。
5. 开启后，由模型自己决定是否调用 `search_web`；如果实际发生联网搜索，助手回复下方会显示一个紧凑折叠的 `Sources`。

说明：

* 联网搜索依赖本地后端。桌面版已内置后端，开箱即用；仅在没有后端的纯浏览器模式（直接打开 `index.html`）下不可用。
* 联网搜索现在默认由模型自己决定是否搜索，因此当前模型/提供商需要支持 OpenAI-compatible 的工具调用。
* 搜索 provider 一次只能选一个：`Brave` 或 `Tavily`。
* 当模型还在判断是否需要联网搜索、且首个流式 token 还没到达时，助手消息现在会立刻显示 `Thinking...`，不再先留一段空白。

## 文件说明

* `index.html`: 主页面结构，以及外部资源的引用入口。
* `style.css`: 独立拆分出的前端样式文件。
* `js/`: 按职责拆分的前端 JavaScript 文件（`state/helpers/keys/storage/conversations/render/search/api/marked/events`）。
* `js/search.js`: 联网搜索设置、provider 选择、查询构造与结果标准化逻辑。
* `server.py`: 用于处理 API Key 测试的后端脚本。
* `app.py`: 桌面启动器 —— 在后台线程运行后端，并用 pywebview 打开原生窗口。
* `build.spec` / `build.md`: PyInstaller 打包配置，以及 macOS / Windows 两平台的构建步骤。
* `requirements.txt`: 构建桌面版所需的依赖（`pywebview`、`pyinstaller`）。
* `img/`: App 图标与 Logo。

## 当前版本

### v3.0.0
- 打包为 **macOS 和 Windows** 独立桌面 App（pywebview + PyInstaller）—— 从 [Releases](https://github.com/XXD051030/local-API-key-testing-website/releases) 下载即用，无需安装 Python。
- 桌面版将设置与会话保存在系统用户数据目录（macOS 为 `~/Library/Application Support/APITester/`，Windows 为 `%APPDATA%\APITester\`），升级、重装数据不丢。
- 修复启动慢和重复打开多个实例的问题。
- 新增会话与设置的一键导入 / 导出。
- 时间上下文默认改为关闭，节省 token。
- 从源码运行（`python3 server.py`）的老用法保持不变。

### v2.4.0
- 全部 JavaScript 迁移为 ES Modules —— 消除全局变量污染和脚本加载顺序依赖。
- 新增 `js/helpers.js` 共享工具模块；`index.html` 改为单个 `<script type="module">`。
- 新增 `.gitignore`，防止敏感文件（`settings.json`、`conversations.json`）被提交。
- `escHtml()` 现在转义单引号，降低 XSS 风险。
- 会话和 API Key 的 ID 生成改用 `crypto.randomUUID()`，杜绝碰撞。

### v2.3.5
- assistant 的 Markdown 输出现在会在插入页面前先经过清洗，降低模型回复中恶意 HTML 注入页面的风险。
- 消息操作按钮和代码块复制按钮已移除内联 `onclick`，改为更安全的 `data-*` 属性配合事件委托。
- 代码块语言标签和复制内容的数据处理现在做了额外加固，避免通过渲染出的代码元信息触发注入。
