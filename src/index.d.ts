export type Task = 'summarize' | 'rewrite' | 'extract' | 'compare' | 'draft';
export interface Model { id: string; name: string; provider: string }
export interface ProviderStatus { id: string; available: boolean; reason?: string }
export interface ModelsResponse { models: Model[]; providers?: ProviderStatus[] }
export interface GenerateInput { model: string; task: Task; text: string; instruction?: string }
export interface RequestOptions { signal?: AbortSignal }
export interface Client { models(options?: RequestOptions): Promise<ModelsResponse>; generate(input: GenerateInput, options?: RequestOptions): AsyncIterable<string> }
export interface ClientOptions { token: string; baseUrl?: string; fetch?: typeof fetch }
export interface RelayClient extends Client { connect(): Promise<void>; disconnect(): void }
export class OwnModeError extends Error { readonly code: string; readonly status?: number; constructor(code: string, message: string, options?: { cause?: unknown; status?: number }) }
export function createClient(options: ClientOptions): Client;
export function createRelayClient(): RelayClient;
