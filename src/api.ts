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

export type SessionSummary = {
  id: string
  title?: string
  createdAt?: string
  updatedAt?: string
}

export function normalizeServerUrl(value: string) {
  return value.trim().replace(/\/+$/, "")
}

export function buildBasicAuth(password: string) {
  const value = `opencode:${password}`
  if (typeof globalThis.btoa === "function") return `Basic ${globalThis.btoa(value)}`
  throw new Error("Tu runtime no admite codificación Base64. Usa una versión moderna de React Native/Expo.")
}

export function makeHeaders(settings: Settings) {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  }

  if (settings.password) headers.Authorization = buildBasicAuth(settings.password)
  return headers
}

export async function request<T>(settings: Settings, path: string, init?: RequestInit): Promise<T> {
  const url = new URL(`${normalizeServerUrl(settings.serverUrl)}${path}`)
  if (settings.directory.trim()) url.searchParams.set("directory", settings.directory.trim())

  const response = await fetch(url.toString(), {
    ...init,
    headers: {
      ...makeHeaders(settings),
      ...(init?.headers ?? {}),
    },
  })

  const raw = await response.text()
  if (!response.ok) {
    throw new Error(raw || `OpenCode respondió con error ${response.status}`)
  }

  if (!raw) return undefined as T
  return JSON.parse(raw) as T
}

export function unwrapData<T>(value: T | { data?: T }): T {
  if (value && typeof value === "object" && "data" in value && value.data !== undefined) return value.data as T
  return value as T
}

export async function getServerInfo(settings: Settings) {
  return request<{ name?: string; version?: string; status?: string }>(settings, "/api/info")
}

export async function listSessions(settings: Settings): Promise<SessionSummary[]> {
  const payload = await request<unknown>(settings, "/session")
  const data = unwrapData(payload)
  if (!Array.isArray(data)) return []

  return data.map((item: any) => ({
    id: String(item?.id ?? item?.sessionID ?? ""),
    title: item?.title ?? "Sin título",
    createdAt: item?.createdAt ?? item?.created_at,
    updatedAt: item?.updatedAt ?? item?.updated_at,
  }))
}

export async function createSession(settings: Settings, title = "Nueva conversación") {
  const result = await request<unknown>(settings, "/session", {
    method: "POST",
    body: JSON.stringify({ title }),
  })

  const session = unwrapData(result) as { id?: string; sessionID?: string }
  const id = session?.id ?? session?.sessionID
  if (!id) throw new Error("El servidor no devolvió ID de sesión válido.")
  return id
}

export async function sendPrompt(settings: Settings, sessionId: string, text: string) {
  return request<unknown>(settings, `/session/${encodeURIComponent(sessionId)}/prompt`, {
    method: "POST",
    body: JSON.stringify({
      text,
      model: {
        providerID: "openai",
        modelID: "gpt-4o-mini",
      },
    }),
  })
}

export async function loadMessages(settings: Settings, sessionId: string): Promise<ChatMessage[]> {
  const result = await request<unknown>(settings, `/session/${encodeURIComponent(sessionId)}/messages`)
  const messages = unwrapData(result)
  if (!Array.isArray(messages)) return []

  return messages.flatMap((entry: any) => {
    const info = entry?.info ?? entry
    const parts = Array.isArray(entry?.parts) ? entry.parts : []
    const text = parts
      .filter((part: any) => part?.type === "text")
      .map((part: any) => part.text)
      .join("")

    if (!text) return []
    if (info?.role !== "user" && info?.role !== "assistant") return []

    return [{ id: String(info?.id ?? `${info?.role}-${Math.random()}`), role: info.role, text }]
  })
}

export function extractAssistantText(result: unknown): string {
  const value = unwrapData(result) as any

  if (Array.isArray(value)) {
    return value.filter((part) => part?.type === "text").map((part) => part.text).join("")
  }

  if (Array.isArray(value?.parts)) {
    return value.parts.filter((part: any) => part?.type === "text").map((part: any) => part.text).join("")
  }

  if (value && typeof value === "object") {
    if (typeof value.text === "string") return value.text
    if (typeof value.message === "string") return value.message
    if (typeof value.content === "string") return value.content
  }

  return ""
}
