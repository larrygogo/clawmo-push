"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RelayClient = void 0;
class RelayClient {
    baseUrl;
    apiKey;
    constructor(baseUrl, apiKey) {
        this.baseUrl = baseUrl.replace(/\/+$/, "");
        this.apiKey = apiKey;
    }
    async sendPush(payload) {
        const url = `${this.baseUrl}/v1/push`;
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(`Relay push failed: ${res.status} ${text}`);
        }
        return (await res.json());
    }
    async healthCheck() {
        try {
            const res = await fetch(`${this.baseUrl}/v1/health`);
            return res.ok;
        }
        catch {
            return false;
        }
    }
}
exports.RelayClient = RelayClient;
