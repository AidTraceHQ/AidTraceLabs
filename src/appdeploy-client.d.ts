declare module '@appdeploy/client' {
  export interface ApiResponse<T> {
    data: T;
  }

  export interface ApiClient {
    get<T>(path: string): Promise<ApiResponse<T>>;
    post<T = unknown>(path: string, body?: unknown): Promise<ApiResponse<T>>;
    put<T = unknown>(path: string, body?: unknown): Promise<ApiResponse<T>>;
    delete<T = unknown>(path: string, body?: unknown): Promise<ApiResponse<T>>;
  }

  export const api: ApiClient;
}
