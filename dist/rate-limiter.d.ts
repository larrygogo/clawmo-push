export declare class RateLimiter {
    private lastPushTime;
    private cooldownMs;
    constructor(cooldownSeconds: number);
    canPush(sessionKey: string): boolean;
    record(sessionKey: string): void;
    /** 清理超过 1 小时的旧记录 */
    cleanup(): void;
}
