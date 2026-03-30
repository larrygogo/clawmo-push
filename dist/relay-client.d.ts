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
export declare class RelayClient {
    private baseUrl;
    private apiKey;
    constructor(baseUrl: string, apiKey: string);
    sendPush(payload: PushPayload): Promise<PushResult>;
    healthCheck(): Promise<boolean>;
}
