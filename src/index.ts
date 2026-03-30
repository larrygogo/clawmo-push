import { DeviceStore } from "./device-store";
import { RelayClient, PushPayload } from "./relay-client";
import { RateLimiter } from "./rate-limiter";

interface PluginConfig {
  relayUrl: string;
  relayKey: string;
  cooldownSeconds?: number;
  maxBodyLength?: number;
}

interface PluginApi {
  pluginConfig?: PluginConfig;
  logger: { info: (...args: any[]) => void; error: (...args: any[]) => void; warn: (...args: any[]) => void };
  runtime: {
    state: { resolveStateDir(): string };
  };
  on(event: string, handler: (event: any, ctx: any) => void | object): void;
  registerGatewayMethod(method: string, handler: (ctx: any) => void): void;
  registerHttpRoute(opts: { path: string; auth: string; match: string; handler: (req: any, res: any) => Promise<void> }): void;
}

function extractLastAssistantText(messages: any[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;
    const content = msg.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block.type === "text" && block.text) {
        return block.text;
      }
    }
  }
  return null;
}

function extractAgentName(ctx: any): string {
  return ctx.agentName || ctx.agentId || "Agent";
}

const plugin = {
  id: "clawmo-push",
  name: "ClawMo Push",
  description: "APNs push notifications for ClawMo iOS client",

  register(api: PluginApi) {
    const config = api.pluginConfig;
    if (!config?.relayUrl || !config?.relayKey) {
      api.logger.warn("[clawmo-push] relayUrl 和 relayKey 未配置，插件不会发送推送");
      return;
    }

    const log = api.logger;
    const stateDir = api.runtime.state.resolveStateDir();
    const store = new DeviceStore(stateDir);
    const relay = new RelayClient(config.relayUrl, config.relayKey);
    const limiter = new RateLimiter(config.cooldownSeconds ?? 60);
    const maxBody = config.maxBodyLength ?? 100;

    // 定期清理限频记录
    setInterval(() => limiter.cleanup(), 3600_000);

    log.info(`[clawmo-push] 已启动，relay=${config.relayUrl}，已注册设备=${store.getDeviceCount()}`);

    // --- Gateway RPC: 注册 device token ---
    api.registerGatewayMethod("clawmo-push.register", ({ params, respond }: any) => {
      try {
        const { token, platform, appVersion } = params;
        if (!token || typeof token !== "string") {
          respond(false, null, { code: "invalid_params", message: "token is required" });
          return;
        }
        store.register(token, platform ?? "unknown", appVersion ?? "unknown");
        log.info(`[clawmo-push] 设备注册: ${token.slice(0, 8)}... (${platform})`);
        respond(true, { registered: true, deviceCount: store.getDeviceCount() });
      } catch (err: any) {
        respond(false, null, { code: "register_failed", message: err.message });
      }
    });

    // --- Gateway RPC: 注销 device token ---
    api.registerGatewayMethod("clawmo-push.unregister", ({ params, respond }: any) => {
      try {
        const { token } = params;
        const removed = store.unregister(token);
        respond(true, { removed, deviceCount: store.getDeviceCount() });
      } catch (err: any) {
        respond(false, null, { code: "unregister_failed", message: err.message });
      }
    });

    // --- Gateway RPC: 查看状态 ---
    api.registerGatewayMethod("clawmo-push.status", async ({ respond }: any) => {
      try {
        const healthy = await relay.healthCheck();
        respond(true, {
          relayUrl: config.relayUrl,
          relayHealthy: healthy,
          registeredDevices: store.getDeviceCount(),
        });
      } catch (err: any) {
        respond(false, null, { code: "status_failed", message: err.message });
      }
    });

    // --- HTTP 状态端点 ---
    api.registerHttpRoute({
      path: "/clawmo-push/status",
      auth: "gateway",
      match: "exact",
      handler: async (_req, res) => {
        const healthy = await relay.healthCheck();
        const body = JSON.stringify({
          relayUrl: config.relayUrl,
          relayHealthy: healthy,
          registeredDevices: store.getDeviceCount(),
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(body);
      },
    });

    // --- 核心：监听 agent_end 事件，发送推送 ---
    api.on("agent_end", (event: any, ctx: any) => {
      const tokens = store.getAllTokens();
      if (tokens.length === 0) return;

      // 只处理成功完成的 agent 运行
      if (!event.success) return;

      const sessionKey = ctx.sessionKey ?? "";

      // 频率控制
      if (!limiter.canPush(sessionKey)) return;

      const messages = event.messages;
      if (!Array.isArray(messages) || messages.length === 0) return;

      const text = extractLastAssistantText(messages);
      if (!text) return;

      // 过滤系统消息（provenance 标记的是系统注入的消息）
      const lastMsg = messages[messages.length - 1];
      if (lastMsg?.provenance) return;

      const agentName = extractAgentName(ctx);
      const body = text.length > maxBody ? text.slice(0, maxBody) + "…" : text;

      const payload: PushPayload = {
        device_tokens: tokens,
        title: agentName,
        body,
        sound: "default",
        category: "MESSAGE",
        thread_id: sessionKey,
        data: {
          agentId: ctx.agentId ?? "",
          sessionKey,
        },
      };

      limiter.record(sessionKey);

      relay.sendPush(payload).then((result) => {
        log.info(`[clawmo-push] 推送已发送: sent=${result.sent} failed=${result.failed} agent=${agentName}`);
      }).catch((err) => {
        log.error(`[clawmo-push] 推送失败: ${err.message}`);
      });
    });
  },
};

export default plugin;
