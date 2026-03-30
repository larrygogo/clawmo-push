export interface PushPayload {
  device_tokens: string[];
  title: string;
  body: string;
  badge?: number;
  sound?: string;
  category?: string;
  thread_id?: string;
  data?: Record<string, string>;
}

export interface PushResult {
  sent: number;
  failed: number;
}

export class RelayClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = apiKey;
  }

  async sendPush(payload: PushPayload): Promise<PushResult> {
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

    return (await res.json()) as PushResult;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/health`);
      return res.ok;
    } catch {
      return false;
    }
  }
}
