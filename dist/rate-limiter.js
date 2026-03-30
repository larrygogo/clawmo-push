"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimiter = void 0;
class RateLimiter {
    lastPushTime = new Map();
    cooldownMs;
    constructor(cooldownSeconds) {
        this.cooldownMs = cooldownSeconds * 1000;
    }
    canPush(sessionKey) {
        const now = Date.now();
        const last = this.lastPushTime.get(sessionKey) ?? 0;
        return now - last >= this.cooldownMs;
    }
    record(sessionKey) {
        this.lastPushTime.set(sessionKey, Date.now());
    }
    /** 清理超过 1 小时的旧记录 */
    cleanup() {
        const cutoff = Date.now() - 3600_000;
        for (const [key, time] of this.lastPushTime) {
            if (time < cutoff)
                this.lastPushTime.delete(key);
        }
    }
}
exports.RateLimiter = RateLimiter;
