interface PluginConfig {
    relayUrl: string;
    relayKey: string;
    cooldownSeconds?: number;
    maxBodyLength?: number;
}
interface PluginApi {
    pluginConfig?: PluginConfig;
    logger: {
        info: (...args: any[]) => void;
        error: (...args: any[]) => void;
        warn: (...args: any[]) => void;
    };
    runtime: {
        state: {
            resolveStateDir(): string;
        };
    };
    on(event: string, handler: (event: any, ctx: any) => void | object): void;
    registerGatewayMethod(method: string, handler: (ctx: any) => void): void;
    registerHttpRoute(opts: {
        path: string;
        auth: string;
        match: string;
        handler: (req: any, res: any) => Promise<void>;
    }): void;
}
declare const plugin: {
    id: string;
    name: string;
    version: string;
    description: string;
    register(api: PluginApi): void;
};
export default plugin;
