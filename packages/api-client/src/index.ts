import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios'
import type { ApiError, ApiResponse, AuthResponse, AuthUser } from '@kipi/types'

export class ApiClientError extends Error {
  readonly status: number | undefined
  readonly errors: Record<string, string[]> | undefined

  constructor(message: string, status?: number, errors?: Record<string, string[]>) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
    this.errors = errors
  }
}

export interface AuthAdapter {
  getToken?: () => Promise<string | null> | string | null
  clearToken?: () => Promise<void> | void
}

export interface ApiClientOptions extends AuthAdapter {
  baseURL: string
  timeoutMs?: number
  withCredentials?: boolean
}

export interface ApiClient {
  http: AxiosInstance
  request<T>(config: AxiosRequestConfig): Promise<AxiosResponse<T>>
  auth: {
    login(payload: unknown): Promise<ApiResponse<AuthResponse>>
    googleLogin(payload: unknown): Promise<ApiResponse<AuthResponse>>
    register(payload: unknown): Promise<ApiResponse<AuthResponse>>
    me(): Promise<ApiResponse<AuthUser>>
    logout(): Promise<void>
    forgotPassword(payload: unknown): Promise<ApiResponse<null>>
  }
  health(): Promise<ApiResponse<{ service: string; status: string }>>
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const client = axios.create({
    baseURL: options.baseURL.replace(/\/$/, ''),
    timeout: options.timeoutMs ?? 10000,
    withCredentials: options.withCredentials ?? false,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  })

  client.interceptors.request.use(async (config) => {
    const token = await options.getToken?.()

    if (token) {
      config.headers.Authorization = 'Bearer ' + token
    }

    // Let the browser set the multipart boundary for file uploads. The
    // default JSON header would cause Laravel to miss the uploaded file.
    if (typeof FormData !== 'undefined' && config.data instanceof FormData && config.headers) {
      delete config.headers['Content-Type']
      delete config.headers['content-type']
    }

    return config
  })

  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (error.response?.status === 401) {
        await options.clearToken?.()
      }

      const payload = error.response?.data as ApiError | undefined

      return Promise.reject(new ApiClientError(
        payload?.message ?? error.message ?? 'Request failed',
        error.response?.status,
        payload?.errors,
      ))
    },
  )

  return {
    http: client,
    request: (config) => client.request(config),
    auth: {
      login: (payload) => client.post('/auth/login', payload).then((response) => response.data),
      googleLogin: (payload) => client.post('/auth/google', payload).then((response) => response.data),
      register: (payload) =>
        client.post('/auth/register', payload).then((response) => response.data),
      me: () => client.get('/auth/me').then((response) => response.data),
      logout: () => client.post('/auth/logout').then(() => undefined),
      forgotPassword: (payload) => client.post('/auth/forgot-password', payload).then((response) => response.data),
    },
    health: () => client.get('/health').then((response) => response.data),
  }
}
