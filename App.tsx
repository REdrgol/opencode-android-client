import React, { useEffect, useMemo, useRef, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import * as SecureStore from "expo-secure-store"
import {
  createSession,
  extractAssistantText,
  getServerInfo,
  listSessions,
  loadMessages,
  normalizeServerUrl,
  sendPrompt,
  type ChatMessage,
  type Settings,
  type SessionSummary,
} from "./api"

const defaultSettings: Settings = {
  serverUrl: "",
  password: "",
  directory: "",
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [showSettings, setShowSettings] = useState(true)
  const [sessionId, setSessionId] = useState("")
  const [sessionTitle, setSessionTitle] = useState("Nueva conversación")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [serverInfo, setServerInfo] = useState<string>("")
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const listRef = useRef<FlatList<ChatMessage>>(null)

  useEffect(() => {
    const load = async () => {
      const stored = await SecureStore.getItemAsync("opencode-mobile-settings")
      if (!stored) return
      try {
        const parsed = JSON.parse(stored) as Settings
        setSettings(parsed)
        setShowSettings(!parsed.serverUrl)
      } catch {
        // ignore invalid persisted settings
      }
    }

    load()
  }, [])

  useEffect(() => {
    if (!showSettings && settings.serverUrl) {
      void loadSessions()
      void refreshServerInfo()
    }
  }, [showSettings])

  useEffect(() => {
    listRef.current?.scrollToEnd({ animated: true })
  }, [messages])

  const summaryLabel = useMemo(() => {
    if (serverInfo) return serverInfo
    if (settings.serverUrl) return settings.serverUrl
    return "Sin conexión"
  }, [serverInfo, settings.serverUrl])

  async function saveSettings() {
    if (!settings.serverUrl.trim()) {
      Alert.alert("Falta la dirección", "Escribe la URL del servidor OpenCode, por ejemplo http://192.168.1.20:4096")
      return
    }

    const normalized: Settings = {
      ...settings,
      serverUrl: normalizeServerUrl(settings.serverUrl),
    }

    setSettings(normalized)
    await SecureStore.setItemAsync("opencode-mobile-settings", JSON.stringify(normalized))
    setShowSettings(false)
    await refreshServerInfo()
    await loadSessions()
  }

  async function refreshServerInfo() {
    try {
      const info = await getServerInfo(settings)
      const name = info?.name ?? info?.status ?? "OpenCode"
      const version = info?.version ? ` v${info.version}` : ""
      setServerInfo(`${name}${version}`)
    } catch {
      setServerInfo(settings.serverUrl || "OpenCode")
    }
  }

  async function loadSessions() {
    if (!settings.serverUrl) return
    try {
      const data = await listSessions(settings)
      setSessions(data)
      if (!sessionId && data[0]) {
        setSessionId(data[0].id)
        setSessionTitle(data[0].title ?? "Nueva conversación")
        await loadConversation(data[0].id)
      }
    } catch {
      // no-op during configuration state
    }
  }

  async function loadConversation(id: string) {
    try {
      const data = await loadMessages(settings, id)
      setMessages(data)
    } catch {
      setMessages([])
    }
  }

  async function openSession(id: string, title?: string) {
    setSessionId(id)
    setSessionTitle(title ?? "Nueva conversación")
    await loadConversation(id)
  }

  async function startNewSession() {
    if (!settings.serverUrl) {
      setShowSettings(true)
      return
    }

    setConnecting(true)
    try {
      const id = await createSession(settings, "Nueva conversación")
      setSessionId(id)
      setSessionTitle("Nueva conversación")
      setMessages([])
      await loadSessions()
    } catch (error) {
      Alert.alert("No se pudo crear la sesión", error instanceof Error ? error.message : "Comprueba la conexión con OpenCode.")
    } finally {
      setConnecting(false)
    }
  }

  async function sendCurrentMessage() {
    const text = draft.trim()
    if (!text || busy) return

    setDraft("")
    setBusy(true)

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      text,
    }

    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)

    try {
      let activeSession = sessionId
      if (!activeSession) {
        activeSession = await createSession(settings, sessionTitle)
        setSessionId(activeSession)
      }

      const result = await sendPrompt(settings, activeSession, text)
      const answer = extractAssistantText(result)
      const assistant = {
        id: `${Date.now()}-assistant`,
        role: "assistant" as const,
        text: answer || "No recibí una respuesta útil del servidor. Revisa la conexión o el modelo activo.",
      }
      setMessages([...nextMessages, assistant])
      await loadSessions()
    } catch (error) {
      setMessages([
        ...nextMessages,
        {
          id: `${Date.now()}-error`,
          role: "assistant",
          text: `No pude responder. ${error instanceof Error ? error.message : "Comprueba que el servidor OpenCode esté activo."}`,
        },
      ])
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />

      <View style={styles.topBar}>
        <Pressable onPress={() => setShowSettings(true)} style={styles.iconButton}>
          <Text style={styles.iconText}>☰</Text>
        </Pressable>

        <View style={styles.brandContainer}>
          <View style={styles.logo}><Text style={styles.logoText}>✦</Text></View>
          <Text style={styles.brandText}>OpenCode</Text>
        </View>

        <Pressable onPress={startNewSession} disabled={connecting || !settings.serverUrl} style={styles.iconButton}>
          <Text style={styles.iconText}>{connecting ? "…" : "+"}</Text>
        </Pressable>
      </View>

      {showSettings ? (
        <KeyboardAvoidingView style={styles.settingsScreen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.card}>
            <View style={styles.logoBig}><Text style={styles.logoText}>✦</Text></View>
            <Text style={styles.title}>Conecta tu OpenCode</Text>
            <Text style={styles.subtitle}>Este cliente se comunica con tu servidor local de OpenCode y guarda la configuración en SecureStore.</Text>

            <Text style={styles.label}>URL DEL SERVIDOR</Text>
            <TextInput
              value={settings.serverUrl}
              onChangeText={(serverUrl) => setSettings({ ...settings, serverUrl })}
              placeholder="http://192.168.1.20:4096"
              placeholderTextColor="#7b7b7b"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={styles.input}
            />

            <Text style={styles.label}>CONTRASEÑA (OPCIONAL)</Text>
            <TextInput
              value={settings.password}
              onChangeText={(password) => setSettings({ ...settings, password })}
              placeholder="Contraseña del servidor"
              placeholderTextColor="#7b7b7b"
              secureTextEntry
              style={styles.input}
            />

            <Text style={styles.label}>DIRECTORIO DEL PROYECTO (OPCIONAL)</Text>
            <TextInput
              value={settings.directory}
              onChangeText={(directory) => setSettings({ ...settings, directory })}
              placeholder="/ruta/al/proyecto"
              placeholderTextColor="#7b7b7b"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />

            <Pressable onPress={saveSettings} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Guardar y abrir chat</Text>
            </Pressable>

            <Text style={styles.helperText}>En Android Studio usa la IP del servidor; en un emulador suele ser 10.0.2.2 en vez de localhost.</Text>
          </View>
        </KeyboardAvoidingView>
      ) : (
        <View style={styles.content}>
          <View style={styles.chatHeader}>
            <View>
              <Text style={styles.chatTitle}>{sessionTitle}</Text>
              <Text style={styles.chatSubtitle}>{summaryLabel}</Text>
            </View>
          </View>

          <View style={styles.sessionPanel}>
            <Text style={styles.sectionTitle}>Sesiones</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sessionScroller}>
              {sessions.length === 0 ? (
                <Pressable onPress={startNewSession} style={styles.sessionPillEmpty}>
                  <Text style={styles.sessionPillText}>+ nueva</Text>
                </Pressable>
              ) : (
                sessions.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => openSession(item.id, item.title)}
                    style={[styles.sessionPill, item.id === sessionId && styles.sessionPillActive]}
                  >
                    <Text style={[styles.sessionPillText, item.id === sessionId && styles.sessionPillTextActive]}>{item.title || "Sin título"}</Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>

          <View style={styles.chatArea}>
            {messages.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.logoBig}><Text style={styles.logoText}>✦</Text></View>
                <Text style={styles.title}>¿Qué quieres hacer hoy?</Text>
                <Text style={styles.subtitle}>Pregúntale a tu agente local de OpenCode, revisa el código o crea tareas.</Text>
                <Pressable onPress={startNewSession} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>{connecting ? "Creando..." : "Nueva conversación"}</Text>
                </Pressable>
              </View>
            ) : (
              <FlatList
                ref={listRef}
                data={messages}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.messageList}
                renderItem={({ item }) => (
                  <View style={[styles.messageRow, item.role === "user" ? styles.userRow : styles.assistantRow]}>
                    {item.role === "assistant" && <View style={styles.avatar}><Text style={styles.avatarText}>AI</Text></View>}
                    <View style={[styles.bubble, item.role === "user" ? styles.userBubble : styles.assistantBubble]}>
                      <Text selectable style={styles.messageText}>{item.text}</Text>
                    </View>
                  </View>
                )}
                ListFooterComponent={busy ? <View style={styles.thinking}><ActivityIndicator size="small" color="#d8d8d8" /></View> : null}
              />
            )}
          </View>

          <View style={styles.composerWrap}>
            <View style={styles.composerBox}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Escribe tu mensaje para OpenCode..."
                placeholderTextColor="#7a7a7a"
                multiline
                maxLength={12000}
                style={styles.inputComposer}
              />

              <Pressable onPress={sendCurrentMessage} disabled={!draft.trim() || busy} style={[styles.sendButton, (!draft.trim() || busy) && styles.sendButtonDisabled]}>
                <Text style={styles.sendButtonText}>↑</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#121212",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomColor: "#2d2d2d",
    borderBottomWidth: 1,
    backgroundColor: "#121212",
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "#1d1d1d",
  },
  iconText: {
    color: "#f3f3f3",
    fontSize: 22,
    fontWeight: "700",
  },
  brandContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logo: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: "#f7c59f",
    justifyContent: "center",
    alignItems: "center",
  },
  logoText: {
    color: "#191919",
    fontSize: 18,
    fontWeight: "800",
  },
  brandText: {
    color: "#f5f5f5",
    fontSize: 18,
    fontWeight: "700",
  },
  settingsScreen: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#121212",
  },
  card: {
    backgroundColor: "#181818",
    borderColor: "#2d2d2d",
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
  },
  logoBig: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: "#f7c59f",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 12,
  },
  title: {
    color: "#f2f2f2",
    fontSize: 26,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    color: "#b1b1b1",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginBottom: 16,
  },
  label: {
    color: "#9f9f9f",
    fontSize: 11,
    letterSpacing: 1.2,
    marginTop: 14,
    marginBottom: 7,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: "#1d1d1d",
    borderColor: "#2d2d2d",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#f0f0f0",
    fontSize: 15,
  },
  primaryButton: {
    backgroundColor: "#f7c59f",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 20,
  },
  primaryButtonText: {
    color: "#191919",
    fontWeight: "700",
    fontSize: 15,
  },
  helperText: {
    color: "#858585",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 14,
  },
  content: {
    flex: 1,
    backgroundColor: "#121212",
  },
  chatHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#2d2d2d",
  },
  chatTitle: {
    color: "#f0f0f0",
    fontSize: 18,
    fontWeight: "700",
  },
  chatSubtitle: {
    color: "#8d8d8d",
    fontSize: 12,
    marginTop: 4,
  },
  sessionPanel: {
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  sectionTitle: {
    color: "#9f9f9f",
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginBottom: 8,
    marginLeft: 6,
  },
  sessionScroller: {
    paddingBottom: 6,
    gap: 8,
  },
  sessionPill: {
    backgroundColor: "#191919",
    borderColor: "#303030",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sessionPillActive: {
    backgroundColor: "#f7c59f",
    borderColor: "#f7c59f",
  },
  sessionPillEmpty: {
    backgroundColor: "#1d1d1d",
    borderColor: "#2d2d2d",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sessionPillText: {
    color: "#e7e7e7",
    fontSize: 12,
    fontWeight: "600",
  },
  sessionPillTextActive: {
    color: "#191919",
  },
  chatArea: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
  },
  secondaryButton: {
    marginTop: 18,
    backgroundColor: "#1d1d1d",
    borderColor: "#2d2d2d",
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  secondaryButtonText: {
    color: "#f4f4f4",
    fontWeight: "600",
  },
  messageList: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    gap: 10,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  userRow: {
    justifyContent: "flex-end",
  },
  assistantRow: {
    justifyContent: "flex-start",
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: "#f7c59f",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#181818",
    fontWeight: "800",
    fontSize: 11,
  },
  bubble: {
    maxWidth: "82%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  userBubble: {
    backgroundColor: "#2c2c2c",
    borderBottomRightRadius: 6,
  },
  assistantBubble: {
    backgroundColor: "#1b1b1b",
    borderBottomLeftRadius: 6,
  },
  messageText: {
    color: "#f0f0f0",
    fontSize: 15,
    lineHeight: 22,
  },
  thinking: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  composerWrap: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderTopColor: "#2d2d2d",
    borderTopWidth: 1,
    backgroundColor: "#121212",
  },
  composerBox: {
    backgroundColor: "#1b1b1b",
    borderColor: "#2d2d2d",
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "flex-end",
  },
  inputComposer: {
    flex: 1,
    color: "#f0f0f0",
    fontSize: 15,
    maxHeight: 110,
    paddingTop: 8,
    paddingBottom: 8,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#f7c59f",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
  sendButtonText: {
    color: "#191919",
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 24,
  },
})
