const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'

export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (/^(?:https?:|data:|blob:|\/\/)/i.test(path)) return path

  const apiOrigin = new URL(apiUrl, window.location.origin).origin
  const normalized = path.replace(/^\/+/, '')
  const storagePath = normalized.startsWith('storage/') ? normalized : `storage/${normalized}`
  return new URL(storagePath, `${apiOrigin}/`).toString()
}
