# iwatch-voice

[English](./README.en.md) | [中文](./README.md)

Automatically transcribe, structure, and append Apple Watch / iPhone Voice Memos into your Obsidian Daily notes.

## Features

- Watches `WATCH_FOLDER` for new audio files
- Converts audio to mono 16k MP3 via `ffmpeg`
- Uses Doubao ASR for transcription
- Uses a Doubao text model to structure output as `title / summary / todos / raw_text`
- Appends entries to `OBSIDIAN_DAILY_DIR/YYYY-MM-DD.md`
- Writes tasks to macOS Reminders when the trigger keyword `待办事项` is present
- Supports simple Chinese time phrases such as `明天下午2点开会`

## Pipeline

1. Watch `WATCH_FOLDER`
2. Normalize audio with `ffmpeg`
3. Send audio to Doubao ASR and get `raw_text`
4. Send text to the Doubao text model for structuring
5. Append the result to Obsidian Daily
6. Copy original audio to `ARCHIVE_FOLDER`, or `FAILED_FOLDER` on failure

## Quick Start

```bash
npm install
cp .env.example .env
npm test
npm run dev
```

Process a single file:

```bash
npm run process -- /absolute/path/to/audio.m4a
```

Backfill the watch folder:

```bash
npm run backfill
```

Replay failed files:

```bash
npm run replay
```

## Configuration

Required variables:

- `DOUBAO_API_KEY`
- `DOUBAO_ASR_APP_ID`
- `DOUBAO_ASR_ACCESS_TOKEN`
- `DOUBAO_TEXT_MODEL`
- `DOUBAO_ASR_RESOURCE_ID`

Common runtime variables:

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

Recommended path settings in `.env`:

```env
WATCH_FOLDER=/Users/your-name/Library/Group Containers/group.com.apple.VoiceMemos.shared/Recordings
OBSIDIAN_DAILY_DIR=/path/to/your/obsidian/Daily
```

If not configured:

- `WATCH_FOLDER` falls back to `runtime/inbox`
- `OBSIDIAN_DAILY_DIR` falls back to `runtime/daily`

## Doubao Setup

### How to get Doubao API access

1. Enable Volcengine Ark model services
2. Create an API key and set `DOUBAO_API_KEY`
3. Enable file-based speech recognition in the Doubao speech console
4. Get your `APP ID` and `Access Token`
5. Confirm the ASR resource ID
6. Confirm the text model name available to your account

### `DOUBAO_TEXT_MODEL`

Typical values:

- `doubao-1-5-lite-32k-250115`
- `doubao-1-5-pro-32k-250115`

If you use a custom inference endpoint, you can also provide the endpoint ID.

### `DOUBAO_ASR_RESOURCE_ID`

Common values in this project:

- `volc.bigasr.auc_turbo`
- `volc.seedasr.auc`

Use the actual value shown in your console.

### `DOUBAO_ASR_APP_ID` and `DOUBAO_ASR_ACCESS_TOKEN`

Find them in the Doubao speech service authentication section:

- `APP ID` -> `DOUBAO_ASR_APP_ID`
- `Access Token` -> `DOUBAO_ASR_ACCESS_TOKEN`

## Voice Memo Folder and Permissions

The service reads the watch folder from `WATCH_FOLDER` in `.env`.  
If it is not configured, it falls back to `runtime/inbox`.

Requirements:

- Your terminal or app must have Full Disk Access
- The service only copies source audio into `archive` or `failed`
- It never moves or deletes the original Voice Memos files

## Reminders Integration

When the source text contains the trigger keyword `待办事项` and the service extracts `todos`, it writes them into macOS Reminders.

Default settings:

```env
REMINDERS_ENABLED=true
REMINDERS_LIST_NAME=工作
REMINDERS_TRIGGER_KEYWORDS=待办事项
```

Rules:

- Add only, no edit and no delete
- Only write to the configured `REMINDERS_LIST_NAME`
- Skip duplicates if a reminder with the same title already exists
- Supports simple Chinese time expressions and writes reminder times

## Shortcuts Bridge

If you do not want to watch the Voice Memos folder directly, you can enable the Apple Shortcuts bridge:

```env
VOICE_MEMOS_SHORTCUT_ENABLED=true
VOICE_MEMOS_SHORTCUT_NAME=导出语音备忘录到 Inbox
```

## Launch at Login

The project includes a user-level `launchd` setup:

- [com.chenie.iwatch-voice.plist](/Users/chenie/Documents/project/iwatch-voice/launchd/com.chenie.iwatch-voice.plist)
- [launchd-run.sh](/Users/chenie/Documents/project/iwatch-voice/scripts/launchd-run.sh)

Logs are written to:

- `runtime/launchd.stdout.log`
- `runtime/launchd.stderr.log`

The current `launchd` setup starts the compiled watcher with Homebrew Node:

- `/opt/homebrew/bin/node /Users/chenie/Documents/project/iwatch-voice/dist/src/cli.js watch`

## APIs

- Doubao Flash ASR: `POST https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash`
- Doubao text structuring: `POST {DOUBAO_TEXT_BASE_URL}/api/v1/chat/completions`

## Notes

- Daily note content only stores structured text, not absolute audio file paths
- Idempotency is stored in SQLite
- If structuring fails, the service degrades gracefully and still keeps the raw text
- The project is intentionally focused on the Doubao two-step flow, without OpenAI provider or OAuth branches
