export type ChatMessage = {
  id: string
  role: "user" | "assistant"
  text: string
}

export type Settings = {
  serverUrl: string
  password: string
  directory: string
}

function baseUrl(settings: Settings) {
  const url = settings.serverUrl.trim().replace(/\/+$/, "")
  if (!url) throw new Error("Configura la dirección del servidor OpenCode.")
  return url
}

function headers(settings: Settings) {
  const result: Record<string, string> = { Accept: "application/json", "Content-Type": "application/json" }
  if (settings.password) {
    const encoded = globalThis.btoa(`opencode:${settings.password}`)
    result.Authorization = `Basic ${encoded}`
  }
  return result
}

async function request<T>(settings: Settings, path: string, init?: RequestInit): Promise<T> {
  const url = new URL(`${baseUrl(settings)}${path}`)
  if (settings.directory.trim()) url.searchParams.set("directory", settings.directory.trim())
  const response = await fetch(url.toString(), { ...init, headers: { ...headers(settings), ...init?.headers } })
  const body = await response.text()
  if (!response.ok) throw new Error(body || `Error del servidor (${response.status})`)
  if (!body) return undefined as T
  return JSON.parse(body) as T
}

function unwrap<T>(value: T | { data?: T }): T {
  if (value && typeof value === "object" && "data" in value && value.data !== undefined) return value.data as T
  return value as T
}

export async function createSession(settings: Settings) {
  const result = await request<unknown>(settings, "/session", {
    method: "POST",
    body: JSON.stringify({ title: "Chat nuevo" }),
  })
  const session = unwrap(result) as { id?: string; sessionID?: string }
  const id = session?.id ?? session?.sessionID
  if (!id) throw new Error("El servidor no devolvió el identificador de sesión.")
  return id
}

export async function sendPrompt(settings: Settings, sessionId: string, text: string) {
  return request<unknown>(settings, `/session/${encodeURIComponent(sessionId)}/prompt`, {
    method: "POST",
    body: JSON.stringify({ text }),
  })
}

export async function loadMessages(settings: Settings, sessionId: string): Promise<ChatMessage[]> {
  const result = await request<unknown>(settings, `/session/${encodeURIComponent(sessionId)}/message`)
  const entries = unwrap(result)
  if (!Array.isArray(entries)) return []
  return entries.flatMap((entry: any) => {
    const info = entry?.info ?? entry
    const parts = entry?.parts ?? []
    const text = parts.filter((part: any) => part?.type === "text").map((part: any) => part.text).join("")
    if (!text || (info?.role !== "user" && info?.role !== "assistant")) return []
    return [{ id: String(info.id ?? `${info.role}-${Math.random()}`), role: info.role, text }]
  })
}

export function assistantText(result: unknown) {
  const value = unwrap(result) as any
  if (Array.isArray(value)) {
    return value.filter((part) => part?.type === "text").map((part) => part.text).join("")
  }
  if (Array.isArray(value?.parts)) {
    return value.parts.filter((part: any) => part?.type === "text").map((part: any) => part.text).join("")
  }
  return typeof value?.text === "string" ? value.text : ""
}
