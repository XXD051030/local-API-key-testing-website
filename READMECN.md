<h1 align="center">local-API-key-testing-website</h1>

<p align="center"><strong>一个面向多家 AI 提供商的本地 API Key 测试网站。</strong></p>

<p align="center">
  提供一个简洁的本地 Web 界面和后端服务，用于测试不同 AI 模型提供商的 API Key。
</p>

<p align="center">
</p>

<p align="center">中文 | <a href="./README.md">English</a></p>

## 运行要求

* Python 3.x

## 使用方法

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

1. 先运行本地后端：`python3 server.py` 或 `py server.py`。
2. 通过该后端地址打开页面，例如 `http://localhost:8080`。
3. 进入 `Settings -> Web Search`，在 `Brave` 和 `Tavily` 中选择一个当前 provider。
4. 展开 `Provider API Key`，填写当前 provider 对应的 API Key。
5. 在模型选择器右侧打开 `Web Search` 开关，即可为当前聊天请求启用联网搜索。
6. 开启后，由模型自己决定是否调用 `search_web`；如果实际发生联网搜索，助手回复下方会显示一个紧凑折叠的 `Sources`。

说明：

* 联网搜索依赖本地后端，纯浏览器存储模式下不可用。
* 联网搜索现在默认由模型自己决定是否搜索，因此当前模型/提供商需要支持 OpenAI-compatible 的工具调用。
* 搜索 provider 一次只能选一个：`Brave` 或 `Tavily`。
* 当模型还在判断是否需要联网搜索、且首个流式 token 还没到达时，助手消息现在会立刻显示 `Thinking...`，不再先留一段空白。

## 文件说明

* `index.html`: 主页面结构，以及外部资源的引用入口。
* `style.css`: 独立拆分出的前端样式文件。
* `js/`: 按职责拆分的前端 JavaScript 文件（`state/keys/storage/conversations/render/api/marked/events`）。
* `js/search.js`: 联网搜索设置、provider 选择、查询构造与结果标准化逻辑。
* `server.py`: 用于处理 API Key 测试的后端脚本。

## 当前版本

### v2.3.5
- assistant 的 Markdown 输出现在会在插入页面前先经过清洗，降低模型回复中恶意 HTML 注入页面的风险。
- 消息操作按钮和代码块复制按钮已移除内联 `onclick`，改为更安全的 `data-*` 属性配合事件委托。
- 代码块语言标签和复制内容的数据处理现在做了额外加固，避免通过渲染出的代码元信息触发注入。
