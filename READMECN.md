<h1 align="center">local-API-key-testing-website</h1>

<p align="center"><strong>一个面向多家 AI 提供商的本地 API Key 测试网站。</strong></p>

<p align="center">
  提供一个简洁的本地 Web 界面和后端服务，用于测试不同 AI 模型提供商的 API Key。
</p>

<p align="center">
  Fork 自 <a href="https://github.com/XXD051030/local-API-key-testing-website">XXD051030/local-API-key-testing-website</a>
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

## 文件说明

* `index.html`: 主页面结构，以及脚本和样式的引用入口。
* `style.css`: 独立拆分出的前端样式文件。
* `js/`: 按职责拆分的前端 JavaScript 文件（`state/storage/keys/conversations/render/api/events`）。
* `server.py`: 用于处理 API Key 测试的后端脚本。

## 更新记录

### v2.1.2
- Thinking 兼容性：识别嵌在 `<think>...</think>` 中的推理内容，并将其渲染到独立的 “Thinking” 面板，而不是混入普通输出。
- 流式稳定性：即使某些提供商通过 `delta.content` 而不是专门的 reasoning 字段流式传出 `<think>` 标签，也能保持 Thinking 和正常输出的分离。
- 历史修复：加载旧会话时会规范化历史 assistant 消息，自动修复并重新保存嵌入 `<think>` 内容的旧数据。

### v2.1.1
- 移动端响应式布局：将会话侧边栏改为小屏抽屉式结构，让手机上聊天区域可以使用完整视口宽度。
- 小屏可用性优化：重新排布顶部栏、模型选择器、输入区和设置区域，避免窄屏下控件被裁切或文字过于拥挤。
- 触控体验优化：让消息和会话操作在触摸设备上更容易使用，不再依赖纯悬停交互。
- 移动端视口细节优化：改进动态视口尺寸和 toast 换行，减少手机浏览器中的内容被遮挡问题，同时保持桌面端布局不变。

### v2.1
- 支持局域网访问：当应用通过局域网 IP 打开时，现在可以正确识别内置的 `server.py` 后端，而不再错误回退到纯浏览器模式。
- 局域网共享持久化：通过 IP 访问时仍然使用 `/file`，因此 `settings.json` 和 `conversations.json` 会继续保存在宿主机器上。
- 局域网代理支持：通过 IP 访问时同样继续使用 `/proxy`，从而避免聊天请求受到浏览器 CORS 限制。
- 体验优化：存储状态现在会显示当前主机，方便判断页面正在使用哪个服务实例。

### v2.0
- 架构重构：将原本单体的 `index.html` 拆分为独立文件（`style.css` + `js/*.js`），提升可维护性。
- 保持行为不变：现有聊天、流式输出、密钥管理、预设和本地代理功能继续保持兼容。
- 明确 `index.html` 中的脚本加载顺序，让全局依赖初始化更稳定、可预测。

### v1.3.2.2
- Thinking 流一致性：避免在普通内容已经开始输出后再次打开 “Thinking” 面板。
- 界面稳定性：避免同一会话后续回复中出现混杂或不稳定的 Thinking 显示。

### v1.3.2.1
- Add Key 测试增强：草稿状态的 key 现在支持可选的 “Initial Model”，因此无需先填写聊天模型也能立即执行 Test Connection。
- 草稿 key 保存逻辑：可选的 “Initial Model” 会写入该 key 绑定的预设组中，并可选择标记为 Thinking 模型。
- 稳定性：`Test Connection` 现在使用 20 秒超时，避免页面长时间卡住。

### v1.3.2
- Test Connection 现在会自动使用被测试 key 绑定的第一个模型，不再依赖聊天区域的模型选择器。
- 对未保存的草稿 key 禁用 Test Connection，并通过明确的 toast 提示用户先保存。
- 界面更新：将中间空状态 logo 替换为 “XXD” 品牌标识。

### v1.3.1
- Thinking 折叠修复：流式输出结束后，“Thinking” 区域现在会立即、稳定地自动折叠。
- 更温和的 Thinking 标记方式：在设置中新增模型时，改为使用内联复选框，而不是阻塞式的 `confirm()` 弹窗。

### v1.3
- 模型与 key 绑定：模型选择现在会绑定到当前激活的 API key，聊天下拉框只显示该 key 可用的模型。
- Thinking 样式优化：让 “Thinking” 区域使用更柔和的颜色和边框，视觉上更易区分。
- 界面提示：在 `key-selector` 旁增加小标签，帮助用户理解它控制的是当前激活的 API key。

### v1.2
- Thinking 显示：当 `stream` 增量中包含 `reasoning_content/reasoning/thought` 时，显示一个流式更新的 `<details>` “Thinking” 区域，并在结束后自动折叠。
- 流式稳定性：对流式过程中的界面重渲染进行节流，避免输出过于突兀或卡顿。
- 服务端流粒度优化：减小代理分块大小，提升 SSE token 输出节奏。
- 模型预设体验优化：在 Settings -> Model Presets 中添加新模型时，会提示是否将其标记为支持 Thinking 的模型，存储于 `settings.thinkingModels`。

### v1.1
- 仅支持预设模型选择：移除顶部栏的自由输入模型框；模型必须通过 Settings -> Model Presets 进行选择。
- 界面调整：将模型选择器移动到聊天输入框上方。
- 移除每个 API key 的 `Default Model` 逻辑：API key 不再携带默认模型，模型选择改为全局行为。
- 体验优化：只有在选择了有效模型后才启用 `Send` 按钮，并改进空状态提示。

### v1.0.1 23
- 加固前端渲染：让 `marked` 的代码块渲染兼容不同版本。
- 安全加固：在生成 `Copy` 按钮模板字符串时转义 `${`，降低注入风险。
- 体验与稳定性：为消息输入框增加 `maxlength`，避免超大请求和渲染开销。
- 提升本地服务健壮性：为被禁止的 `/file` 读写请求增加 CORS 头和 JSON 错误响应体。
- 提升本地服务健壮性：对格式错误的 `/file` 请求返回 `400 Invalid JSON`。
- 稳定性：为上游代理请求增加 `timeout=30`，避免请求挂起。
