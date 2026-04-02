# iwatch-voice

把 Apple Watch / 语音备忘录导出的音频转写、整理并写入 Obsidian Daily。

## 流程

1. 直接监听语音备忘录目录 `WATCH_FOLDER`
2. 服务用 `ffmpeg` 转为单声道 16k MP3
3. 调用豆包录音文件极速版识别，得到 `raw_text`
4. 调用豆包文本模型，整理成 `title / summary / todos / raw_text`
5. 追加写入 `OBSIDIAN_DAILY_DIR/YYYY-MM-DD.md`
6. 原音频保留在语音备忘录目录，同时复制到 `ARCHIVE_FOLDER`，失败时复制到 `FAILED_FOLDER`

## 配置

先复制配置模板并填入豆包参数：

```bash
cp .env.example .env
```

必填项：

- `DOUBAO_API_KEY`
- `DOUBAO_ASR_APP_ID`
- `DOUBAO_ASR_ACCESS_TOKEN`
- `DOUBAO_TEXT_MODEL`
- `DOUBAO_ASR_RESOURCE_ID`

运行项默认可直接使用，也可以按你的环境修改：

- `WATCH_FOLDER`
- `ARCHIVE_FOLDER`
- `FAILED_FOLDER`
- `OBSIDIAN_DAILY_DIR`
- `STATE_DB_PATH`
- `TIMEZONE`
- `POLL_INTERVAL_MS`
- `FFMPEG_PATH`
- `PRESERVE_SOURCE_FILES`
- `REMINDERS_ENABLED`
- `REMINDERS_LIST_NAME`
- `REMINDERS_TRIGGER_KEYWORDS`

路径类配置建议直接写在 `.env`：

```env
WATCH_FOLDER=/Users/your-name/Library/Group Containers/group.com.apple.VoiceMemos.shared/Recordings
OBSIDIAN_DAILY_DIR=/path/to/your/obsidian/Daily
```

如果未配置：

- `WATCH_FOLDER` 会退回到 `runtime/inbox`
- `OBSIDIAN_DAILY_DIR` 会退回到 `runtime/daily`

### 如何申请豆包 API

1. 登录火山引擎控制台并开通火山方舟大模型服务
2. 在方舟控制台创建 API Key，填入 `DOUBAO_API_KEY`
3. 在豆包语音控制台开通录音文件识别能力
4. 在语音服务详情页获取 `APP ID` 和 `Access Token`
5. 在对应页面确认录音文件识别使用的资源 ID
6. 在方舟模型调用页面确认你可用的文本模型名

### `DOUBAO_TEXT_MODEL` 在哪看

去火山方舟控制台的模型调用或在线推理页面，找到你账号可用的 Doubao 文本模型名，直接填到 `DOUBAO_TEXT_MODEL`。

常见形式类似：

- `doubao-1-5-lite-32k-250115`
- `doubao-1-5-pro-32k-250115`

如果你使用的是自己创建的推理接入点，也可以填接入点 ID。

### `DOUBAO_ASR_RESOURCE_ID` 在哪看

去豆包语音控制台开通录音文件识别后，在接口说明或应用详情里查看对应的资源标识。当前项目默认值是：

- `volc.bigasr.auc_turbo`
- 如果按录音文件识别大模型标准版文档接入，也可能是 `volc.seedasr.auc`

如果你的控制台展示了不同的资源 ID，以实际开通结果为准。

### `DOUBAO_ASR_APP_ID` 和 `DOUBAO_ASR_ACCESS_TOKEN` 在哪看

去豆包语音控制台的“服务接口认证信息”区域，读取：

- `APP ID` -> `DOUBAO_ASR_APP_ID`
- `Access Token` -> `DOUBAO_ASR_ACCESS_TOKEN`

## 启动服务

```bash
npm install
npm test
npm run dev
```

单文件调试：

```bash
npm run process -- /absolute/path/to/audio.m4a
```

补扫监听目录：

```bash
npm run backfill
```

重试失败音频：

```bash
npm run replay
```

### 开机自启

项目附带了一个用户级 `launchd` 配置：

- [com.chenie.iwatch-voice.plist](/Users/chenie/Documents/project/iwatch-voice/launchd/com.chenie.iwatch-voice.plist)

启动脚本在：

- [launchd-run.sh](/Users/chenie/Documents/project/iwatch-voice/scripts/launchd-run.sh)

安装后会在登录时自动启动并持续监听语音备忘录目录，日志写到：

- `/Users/chenie/Documents/project/iwatch-voice/runtime/launchd.stdout.log`
- `/Users/chenie/Documents/project/iwatch-voice/runtime/launchd.stderr.log`

当前 `launchd` 配置直接使用 Homebrew Node 启动编译后的入口：

- `/opt/homebrew/bin/node /Users/chenie/Documents/project/iwatch-voice/dist/src/cli.js watch`

这样可以避免 `launchd` 环境下缺少交互式 shell `PATH` 时无法找到 `node` 或 `tsx`。

## 语音备忘录目录

当前监听目录优先读取 `.env` 里的 `WATCH_FOLDER`。
如果未配置，才会退回到项目内的 `runtime/inbox`。

要求：

- 当前终端或应用具有完整磁盘访问权限
- 服务只复制源录音到 `archive` 或 `failed`，不会移动或删除 Voice Memos 原件

### 快捷指令桥接

如果后续你不想直接监听 Voice Memos 目录，也可以退回快捷指令桥接方案。
默认该功能关闭，只有在以下配置开启时才会在轮询前运行：

```env
VOICE_MEMOS_SHORTCUT_ENABLED=true
VOICE_MEMOS_SHORTCUT_NAME=导出语音备忘录到 Inbox
```

### 提醒事项新增

当原文里包含触发词 `待办事项`，并且结构化结果中抽取到了 `todos` 时，服务会尝试把待办新增到 macOS 提醒事项。

默认配置：

```env
REMINDERS_ENABLED=true
REMINDERS_LIST_NAME=工作
REMINDERS_TRIGGER_KEYWORDS=待办事项
```

规则：

- 只新增，不编辑、不删除
- 只写入 `REMINDERS_LIST_NAME` 指定的列表
- 同标题提醒已存在时跳过，不重复创建
- 支持像 `明天下午2点开会` 这样的简单中文时间表达，并写入提醒时间

## 豆包能力

- 录音文件极速版识别 API：`POST https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash`
- 文本整理 API：`POST {DOUBAO_TEXT_BASE_URL}/api/v1/chat/completions`

## 说明

- Daily 正文只写中文结构化内容，不写音频绝对路径
- 幂等信息保存在 SQLite
- 结构化失败时会自动降级，至少保留原文
- 当前项目锁定为豆包双阶段模式，不规划 OpenAI provider 或 OAuth 分支
