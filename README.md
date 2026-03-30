# clawmo-push

OpenClaw Gateway plugin for sending APNs push notifications to [ClawMo](https://github.com/larrygogo/ClawMo) iOS client.

## How It Works

```
ClawMo iOS ──ws──▶ OpenClaw Gateway ──agent_end──▶ clawmo-push ──HTTP──▶ clawmo-relay ──APNs──▶ iOS
```

1. iOS client registers device token via `clawmo-push.register` RPC
2. Plugin listens for `agent_end` events on the Gateway
3. Extracts the last assistant message and sends it to clawmo-relay
4. Relay service delivers the notification through Apple APNs

## Install

### 1. 安装插件

一键安装（下载最新 release 并安装）：

```bash
curl -sL $(curl -s https://api.github.com/repos/larrygogo/clawmo-push/releases/latest \
  | grep browser_download_url | cut -d '"' -f 4) \
  -o /tmp/clawmo-push.tgz \
  && openclaw plugins install /tmp/clawmo-push.tgz
```

或手动下载 `.tgz` 从 [Releases](https://github.com/larrygogo/clawmo-push/releases)，然后：

```bash
openclaw plugins install ./clawmo-push-v0.1.1.tgz
```

### 2. 配置插件

安装后编辑 `~/.openclaw/openclaw.json`，在 `plugins.entries` 中添加：

```json
{
  "plugins": {
    "entries": {
      "clawmo-push": {
        "enabled": true,
        "config": {
          "relayUrl": "https://push.clawmo.cn",
          "relayKey": "your-relay-api-key"
        }
      }
    }
  }
}
```

### 3. 重启 Gateway

```bash
openclaw gateway restart
```

## Configuration

配置项：

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `relayUrl` | Yes | `https://push.clawmo.cn` | clawmo-relay service URL |
| `relayKey` | Yes | - | Relay API key |
| `cooldownSeconds` | No | `60` | Per-session push cooldown (seconds) |
| `maxBodyLength` | No | `100` | Max notification body length (characters) |

## Gateway RPC Methods

| Method | Description |
|--------|-------------|
| `clawmo-push.register` | Register a device token (supports `ttl` in seconds) |
| `clawmo-push.unregister` | Remove a device token |
| `clawmo-push.status` | Check relay health and registered device count |

### Register params

```json
{
  "token": "apns-device-token",
  "platform": "ios",
  "appVersion": "1.0.0",
  "ttl": 604800
}
```

Token auto-expires after `ttl` seconds (default: 7 days). Each app connect re-registers to renew.

## Development

```bash
npm install
npm run build     # compile TypeScript
npm run dev       # watch mode
```

## Related

- [ClawMo](https://github.com/larrygogo/ClawMo) - iOS client
- [clawmo-relay](https://github.com/larrygogo/clawmo-relay) - APNs relay service

## License

MIT
