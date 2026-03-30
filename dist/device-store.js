"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeviceStore = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class DeviceStore {
    filePath;
    devices = [];
    constructor(stateDir) {
        const dir = path.join(stateDir, "clawmo-push");
        fs.mkdirSync(dir, { recursive: true });
        this.filePath = path.join(dir, "devices.json");
        this.load();
    }
    load() {
        try {
            const raw = fs.readFileSync(this.filePath, "utf-8");
            this.devices = JSON.parse(raw);
        }
        catch {
            this.devices = [];
        }
    }
    save() {
        fs.writeFileSync(this.filePath, JSON.stringify(this.devices, null, 2));
    }
    register(token, platform, appVersion, ttlSeconds) {
        const existing = this.devices.findIndex((d) => d.token === token);
        const now = new Date();
        const expiresAt = ttlSeconds
            ? new Date(now.getTime() + ttlSeconds * 1000).toISOString()
            : null;
        const record = {
            token,
            platform,
            appVersion,
            registeredAt: now.toISOString(),
            expiresAt,
        };
        if (existing >= 0) {
            this.devices[existing] = record;
        }
        else {
            this.devices.push(record);
        }
        this.save();
    }
    unregister(token) {
        const before = this.devices.length;
        this.devices = this.devices.filter((d) => d.token !== token);
        if (this.devices.length !== before) {
            this.save();
            return true;
        }
        return false;
    }
    /** Remove expired tokens and persist. Returns number of tokens removed. */
    purgeExpired() {
        const now = Date.now();
        const before = this.devices.length;
        this.devices = this.devices.filter((d) => !d.expiresAt || new Date(d.expiresAt).getTime() > now);
        const removed = before - this.devices.length;
        if (removed > 0)
            this.save();
        return removed;
    }
    getAllTokens() {
        const now = Date.now();
        return this.devices
            .filter((d) => !d.expiresAt || new Date(d.expiresAt).getTime() > now)
            .map((d) => d.token);
    }
    getDeviceCount() {
        return this.getAllTokens().length;
    }
}
exports.DeviceStore = DeviceStore;
