import * as fs from "fs";
import * as path from "path";

export interface DeviceRecord {
  token: string;
  platform: string;
  appVersion: string;
  registeredAt: string;
}

export class DeviceStore {
  private filePath: string;
  private devices: DeviceRecord[] = [];

  constructor(stateDir: string) {
    const dir = path.join(stateDir, "clawmo-push");
    fs.mkdirSync(dir, { recursive: true });
    this.filePath = path.join(dir, "devices.json");
    this.load();
  }

  private load(): void {
    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      this.devices = JSON.parse(raw);
    } catch {
      this.devices = [];
    }
  }

  private save(): void {
    fs.writeFileSync(this.filePath, JSON.stringify(this.devices, null, 2));
  }

  register(token: string, platform: string, appVersion: string): void {
    const existing = this.devices.findIndex((d) => d.token === token);
    const record: DeviceRecord = {
      token,
      platform,
      appVersion,
      registeredAt: new Date().toISOString(),
    };
    if (existing >= 0) {
      this.devices[existing] = record;
    } else {
      this.devices.push(record);
    }
    this.save();
  }

  unregister(token: string): boolean {
    const before = this.devices.length;
    this.devices = this.devices.filter((d) => d.token !== token);
    if (this.devices.length !== before) {
      this.save();
      return true;
    }
    return false;
  }

  getAllTokens(): string[] {
    return this.devices.map((d) => d.token);
  }

  getDeviceCount(): number {
    return this.devices.length;
  }
}
