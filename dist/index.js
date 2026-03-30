"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const device_store_1 = require("./device-store");
const relay_client_1 = require("./relay-client");
const rate_limiter_1 = require("./rate-limiter");
function extractLastAssistantText(messages) {
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.role !== "assistant")
            continue;
        const content = msg.content;
        if (!Array.isArray(content))
            continue;
        for (const block of content) {
            if (block.type === "text" && block.text) {
                return block.text;
            }
        }
    }
    return null;
}
function extractAgentName(ctx) {
    return ctx.agentName || ctx.agentId || "Agent";
}
const plugin = {
    id: "clawmo-push",
    name: "ClawMo Push",
    version: "0.1.2",
    description: "APNs push notifications for ClawMo iOS client",
    register(api) {
        const config = api.pluginConfig;
        if (!config?.relayUrl || !config?.relayKey) {
            api.logger.warn("[clawmo-push] relayUrl 和 relayKey 未配置，插件不会发送推送");
            return;
        }
        const log = api.logger;
        const stateDir = api.runtime.state.resolveStateDir();
        const store = new device_store_1.DeviceStore(stateDir);
        const relay = new relay_client_1.RelayClient(config.relayUrl, config.relayKey);
        const limiter = new rate_limiter_1.RateLimiter(config.cooldownSeconds ?? 60);
        const maxBody = config.maxBodyLength ?? 100;
        // 定期清理限频记录 & 过期设备
        setInterval(() => {
            limiter.cleanup();
            const purged = store.purgeExpired();
            if (purged > 0)
                log.info(`[clawmo-push] 已清理 ${purged} 个过期设备`);
        }, 3600_000);
        log.info(`[clawmo-push] 已启动，relay=${config.relayUrl}，已注册设备=${store.getDeviceCount()}`);
        // --- Gateway RPC: 注册 device token ---
        api.registerGatewayMethod("clawmo-push.register", ({ params, respond }) => {
            try {
                const { token, platform, appVersion, ttl } = params;
                if (!token || typeof token !== "string") {
                    respond(false, null, { code: "invalid_params", message: "token is required" });
                    return;
                }
                const ttlSeconds = typeof ttl === "number" && ttl > 0 ? ttl : undefined;
                store.register(token, platform ?? "unknown", appVersion ?? "unknown", ttlSeconds);
                log.info(`[clawmo-push] 设备注册: ${token.slice(0, 8)}... (${platform}, ttl=${ttlSeconds ?? "forever"})`);
                respond(true, { registered: true, deviceCount: store.getDeviceCount() });
            }
            catch (err) {
                respond(false, null, { code: "register_failed", message: err.message });
            }
        });
        // --- Gateway RPC: 注销 device token ---
        api.registerGatewayMethod("clawmo-push.unregister", ({ params, respond }) => {
            try {
                const { token } = params;
                const removed = store.unregister(token);
                respond(true, { removed, deviceCount: store.getDeviceCount() });
            }
            catch (err) {
                respond(false, null, { code: "unregister_failed", message: err.message });
            }
        });
        // --- Gateway RPC: 查看状态 ---
        api.registerGatewayMethod("clawmo-push.status", async ({ respond }) => {
            try {
                const healthy = await relay.healthCheck();
                respond(true, {
                    version: plugin.version,
                    relayUrl: config.relayUrl,
                    relayHealthy: healthy,
                    registeredDevices: store.getDeviceCount(),
                });
            }
            catch (err) {
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
                    version: plugin.version,
                    relayUrl: config.relayUrl,
                    relayHealthy: healthy,
                    registeredDevices: store.getDeviceCount(),
                });
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(body);
            },
        });
        // --- 核心：监听 agent_end 事件，发送推送 ---
        api.on("agent_end", (event, ctx) => {
            const tokens = store.getAllTokens();
            if (tokens.length === 0)
                return;
            // 只处理成功完成的 agent 运行
            if (!event.success)
                return;
            const sessionKey = ctx.sessionKey ?? "";
            // 频率控制
            if (!limiter.canPush(sessionKey))
                return;
            const messages = event.messages;
            if (!Array.isArray(messages) || messages.length === 0)
                return;
            const text = extractLastAssistantText(messages);
            if (!text)
                return;
            // 过滤系统消息（provenance 标记的是系统注入的消息）
            const lastMsg = messages[messages.length - 1];
            if (lastMsg?.provenance)
                return;
            const agentName = extractAgentName(ctx);
            const body = text.length > maxBody ? text.slice(0, maxBody) + "…" : text;
            const payload = {
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
exports.default = plugin;
