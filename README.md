# iwatch-voice

[English README](./README.en.md)

把 Apple Watch / iPhone 语音备忘录中的音频自动转写、整理，并写入 Obsidian Daily。

## 功能

- 监听 `WATCH_FOLDER` 中的新录音
- 使用 `ffmpeg` 转成单声道 16k MP3
- 调用豆包 ASR 获取原文
- 调用豆包文本模型整理成 `title / summary / todos / raw_text`
- 追加写入 `OBSIDIAN_DAILY_DIR/YYYY-MM-DD.md`
- 命中 `待办事项` 触发词时，自动写入 macOS 提醒事项
- 支持简单中文时间表达，例如 `明天下午2点开会`

## 流程

1. 监听语音目录 `WATCH_FOLDER`
2. 服务用 `ffmpeg` 处理音频
3. 调用豆包录音识别接口得到 `raw_text`
4. 调用豆包文本模型整理结构化结果
5. 写入 Obsidian Daily
6. 复制原音频到 `ARCHIVE_FOLDER`，失败时复制到 `FAILED_FOLDER`

## 快速开始

```bash
npm install
cp .env.example .env
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

## 配置

必填项：

- `DOUBAO_API_KEY`
- `DOUBAO_ASR_APP_ID`
- `DOUBAO_ASR_ACCESS_TOKEN`
- `DOUBAO_TEXT_MODEL`
- `DOUBAO_ASR_RESOURCE_ID`

常用运行项：

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
- `VOICE_MEMOS_SHORTCUT_ENABLED`
- `VOICE_MEMOS_SHORTCUT_NAME`

路径类配置建议直接写在 `.env`：

```env
WATCH_FOLDER=/Users/your-name/Library/Group Containers/group.com.apple.VoiceMemos.shared/Recordings
OBSIDIAN_DAILY_DIR=/path/to/your/obsidian/Daily
```

如果未配置：

- `WATCH_FOLDER` 会退回到 `runtime/inbox`
- `OBSIDIAN_DAILY_DIR` 会退回到 `runtime/daily`

## 豆包参数说明

### 如何申请豆包 API

1. 登录火山引擎控制台并开通火山方舟大模型服务
2. 在方舟控制台创建 API Key，填入 `DOUBAO_API_KEY`
3. 在豆包语音控制台开通录音文件识别能力
4. 获取 `APP ID` 和 `Access Token`
5. 确认录音识别使用的资源 ID
6. 确认可用的 Doubao 文本模型名

### `DOUBAO_TEXT_MODEL`

常见模型名类似：

- `doubao-1-5-lite-32k-250115`
- `doubao-1-5-pro-32k-250115`

如果使用自定义推理接入点，也可以填写接入点 ID。

### `DOUBAO_ASR_RESOURCE_ID`

当前项目常见值：

- `volc.bigasr.auc_turbo`
- `volc.seedasr.auc`

请以你控制台实际开通结果为准。

### `DOUBAO_ASR_APP_ID` 和 `DOUBAO_ASR_ACCESS_TOKEN`

在豆包语音控制台的服务认证信息中读取：

- `APP ID` -> `DOUBAO_ASR_APP_ID`
- `Access Token` -> `DOUBAO_ASR_ACCESS_TOKEN`

## 语音目录与权限

监听目录优先读取 `.env` 中的 `WATCH_FOLDER`。  
如果未配置，则退回到项目内的 `runtime/inbox`。

要求：

- 当前终端或应用具有完整磁盘访问权限
- 服务只复制源录音到 `archive` 或 `failed`
- 不会移动或删除 Voice Memos 原件

## 提醒事项写入

当原文包含触发词 `待办事项`，并且最终抽取到了 `todos` 时，服务会把待办写入 macOS 提醒事项。

默认配置：

```env
REMINDERS_ENABLED=true
REMINDERS_LIST_NAME=工作
REMINDERS_TRIGGER_KEYWORDS=待办事项
```

规则：

- 只新增，不编辑、不删除
- 只写入 `REMINDERS_LIST_NAME` 指定列表
- 同标题提醒已存在时跳过
- 支持简单时间表达，并写入提醒时间

## 快捷指令桥接

如果不想直接监听 Voice Memos 目录，也可以启用快捷指令桥接：

```env
VOICE_MEMOS_SHORTCUT_ENABLED=true
VOICE_MEMOS_SHORTCUT_NAME=导出语音备忘录到 Inbox
```

## 开机自启

项目附带用户级 `launchd` 配置：

- [com.chenie.iwatch-voice.plist](/Users/chenie/Documents/project/iwatch-voice/launchd/com.chenie.iwatch-voice.plist)
- [launchd-run.sh](/Users/chenie/Documents/project/iwatch-voice/scripts/launchd-run.sh)

日志默认写到：

- `runtime/launchd.stdout.log`
- `runtime/launchd.stderr.log`

当前 `launchd` 直接用 Homebrew Node 启动编译后的入口：

- `/opt/homebrew/bin/node /Users/chenie/Documents/project/iwatch-voice/dist/src/cli.js watch`

## 接口

- 豆包录音文件极速版识别：`POST https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash`
- 豆包文本整理：`POST {DOUBAO_TEXT_BASE_URL}/api/v1/chat/completions`

## 说明

- Daily 正文只写结构化内容，不写音频绝对路径
- 幂等信息保存在 SQLite
- 结构化失败时会自动降级，至少保留原文
- 当前项目只做豆包双阶段方案，不包含 OpenAI provider 或 OAuth 分支
