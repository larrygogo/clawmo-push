export interface DeviceRecord {
    token: string;
    platform: string;
    appVersion: string;
    registeredAt: string;
    expiresAt: string | null;
}
export declare class DeviceStore {
    private filePath;
    private devices;
    constructor(stateDir: string);
    private load;
    private save;
    register(token: string, platform: string, appVersion: string, ttlSeconds?: number): void;
    unregister(token: string): boolean;
    /** Remove expired tokens and persist. Returns number of tokens removed. */
    purgeExpired(): number;
    getAllTokens(): string[];
    getDeviceCount(): number;
}
