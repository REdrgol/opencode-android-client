import React, { useEffect, useRef, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import * as SecureStore from "expo-secure-store"
import { assistantText, createSession, loadMessages, sendPrompt, type ChatMessage, type Settings } from "./src/api"

const emptySettings: Settings = { serverUrl: "", password: "", directory: "" }

export default function App() {
  const [settings, setSettings] = useState(emptySettings)
  const [configured, setConfigured] = useState(false)
  const [showSettings, setShowSettings] = useState(true)
  const [sessionId, setSessionId] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)
  const [starting, setStarting] = useState(false)
  const list = useRef<FlatList<ChatMessage>>(null)

  useEffect(() => {
    SecureStore.getItemAsync("opencode-settings").then((stored) => {
      if (!stored) return
      try {
        const value = JSON.parse(stored) as Settings
        setSettings(value)
        setConfigured(Boolean(value.serverUrl))
        setShowSettings(!value.serverUrl)
      } catch {
        setShowSettings(true)
      }
    })
  }, [])

  useEffect(() => {
    list.current?.scrollToEnd({ animated: true })
  }, [messages, busy])

  async function saveSettings() {
    if (!settings.serverUrl.trim()) {
      Alert.alert("Falta la dirección", "Escribe la URL del servidor OpenCode, por ejemplo http://192.168.1.20:4096")
      return
    }
    const normalized = { ...settings, serverUrl: settings.serverUrl.trim().replace(/\/+$/, "") }
    setSettings(normalized)
    await SecureStore.setItemAsync("opencode-settings", JSON.stringify(normalized))
    setConfigured(true)
    setShowSettings(false)
    setSessionId("")
    setMessages([])
  }

  async function startChat() {
    setStarting(true)
    try {
      const id = await createSession(settings)
      setSessionId(id)
      setMessages([])
    } catch (error) {
      Alert.alert("No se pudo conectar", error instanceof Error ? error.message : "Comprueba el servidor y la red.")
    } finally {
      setStarting(false)
    }
  }

  async function submit() {
    const text = draft.trim()
    if (!text || busy) return
    setDraft("")
    setBusy(true)
    const userMessage: ChatMessage = { id: `${Date.now()}`, role: "user", text }
    setMessages((old) => [...old, userMessage])
    try {
      let id = sessionId
      if (!id) {
        id = await createSession(settings)
        setSessionId(id)
      }
      const response = await sendPrompt(settings, id, text)
      let answer = assistantText(response)
      if (!answer) {
        const latest = await loadMessages(settings, id)
        answer = latest.filter((message) => message.role === "assistant").at(-1)?.text ?? "La respuesta llegó vacía. Revisa la conversación en OpenCode."
      }
      setMessages((old) => [...old, { id: `${Date.now()}-assistant`, role: "assistant", text: answer }])
    } catch (error) {
      setMessages((old) => [...old, { id: `${Date.now()}-error`, role: "assistant", text: `No pude completar la solicitud. ${error instanceof Error ? error.message : "Verifica la conexión."}` }])
    } finally {
      setBusy(false)
    }
  }

  function newChat() {
    setSessionId("")
    setMessages([])
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#111111" />
      <View style={styles.header}>
        <Pressable onPress={() => setShowSettings(true)} style={styles.headerButton}><Text style={styles.headerIcon}>☰</Text></Pressable>
        <View style={styles.brand}><View style={styles.logo}><Text style={styles.logoText}>✳</Text></View><Text style={styles.brandText}>OpenCode</Text></View>
        <Pressable onPress={newChat} style={styles.headerButton}><Text style={styles.plus}>＋</Text></Pressable>
      </View>

      {showSettings ? (
        <KeyboardAvoidingView style={styles.settingsWrap} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.welcomeIcon}><Text style={styles.welcomeStar}>✳</Text></View>
          <Text style={styles.title}>Conecta tu OpenCode</Text>
          <Text style={styles.subtitle}>La app se conecta a tu propio servidor. No se envían tus datos a OpenCode Mobile.</Text>
          <Text style={styles.label}>URL DEL SERVIDOR</Text>
          <TextInput value={settings.serverUrl} onChangeText={(serverUrl) => setSettings({ ...settings, serverUrl })} placeholder="http://192.168.1.20:4096" placeholderTextColor="#737373" autoCapitalize="none" autoCorrect={false} keyboardType="url" style={styles.input} />
          <Text style={styles.label}>CONTRASEÑA (OPCIONAL)</Text>
          <TextInput value={settings.password} onChangeText={(password) => setSettings({ ...settings, password })} placeholder="Contraseña del servidor" placeholderTextColor="#737373" secureTextEntry style={styles.input} />
          <Text style={styles.label}>CARPETA DEL PROYECTO (OPCIONAL)</Text>
          <TextInput value={settings.directory} onChangeText={(directory) => setSettings({ ...settings, directory })} placeholder="/ruta/a/tu/proyecto" placeholderTextColor="#737373" autoCapitalize="none" autoCorrect={false} style={styles.input} />
          <Pressable onPress={saveSettings} style={styles.primaryButton}><Text style={styles.primaryText}>Guardar y continuar</Text></Pressable>
          <Text style={styles.helper}>El teléfono y el servidor deben poder comunicarse por la red. Evita exponer el servidor directamente a internet.</Text>
          {configured && <Pressable onPress={() => setShowSettings(false)} style={styles.cancelButton}><Text style={styles.cancelText}>Volver al chat</Text></Pressable>}
        </KeyboardAvoidingView>
      ) : (
        <>
          <View style={styles.chatArea}>
            {messages.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.welcomeIcon}><Text style={styles.welcomeStar}>✳</Text></View>
                <Text style={styles.title}>¿En qué puedo ayudarte?</Text>
                <Text style={styles.subtitle}>Conversa con OpenCode y trabaja en tu proyecto.</Text>
                <View style={styles.suggestions}>
                  <Pressable onPress={() => setDraft("Explícame la estructura de este proyecto")} style={styles.suggestion}><Text style={styles.suggestionText}>⌘  Explícame este proyecto</Text></Pressable>
                  <Pressable onPress={() => setDraft("Ayúdame a encontrar y corregir un error")} style={styles.suggestion}><Text style={styles.suggestionText}>⌕  Ayúdame a corregir un error</Text></Pressable>
                </View>
                {!sessionId && <Pressable onPress={startChat} disabled={starting} style={styles.secondaryButton}>{starting ? <ActivityIndicator color="#e9e9e9" /> : <Text style={styles.secondaryText}>Iniciar conversación</Text>}</Pressable>}
              </View>
            ) : (
              <FlatList ref={list} data={messages} keyExtractor={(item) => item.id} contentContainerStyle={styles.messageList} renderItem={({ item }) => (
                <View style={[styles.messageRow, item.role === "user" ? styles.userRow : styles.assistantRow]}>
                  {item.role === "assistant" && <View style={styles.smallLogo}><Text style={styles.logoText}>✳</Text></View>}
                  <View style={[styles.bubble, item.role === "user" ? styles.userBubble : styles.assistantBubble]}><Text selectable style={styles.messageText}>{item.text}</Text></View>
                </View>
              )} ListFooterComponent={busy ? <View style={styles.thinking}><View style={styles.smallLogo}><Text style={styles.logoText}>✳</Text></View><ActivityIndicator size="small" color="#b9b9b9" /></View> : null} />
            )}
          </View>
          <View style={styles.composerWrap}>
            <View style={styles.composer}>
              <TextInput value={draft} onChangeText={setDraft} placeholder="Escribe tu mensaje..." placeholderTextColor="#858585" multiline maxLength={12000} style={styles.composerInput} onSubmitEditing={submit} />
              <Pressable onPress={submit} disabled={!draft.trim() || busy} style={[styles.sendButton, (!draft.trim() || busy) && styles.sendDisabled]}><Text style={styles.sendIcon}>↑</Text></Pressable>
            </View>
            <Text style={styles.disclaimer}>OpenCode puede cometer errores. Revisa las acciones antes de aplicarlas.</Text>
          </View>
        </>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#111111" },
  header: { height: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#303030" },
  headerButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" }, headerIcon: { color: "#eeeeee", fontSize: 22 }, plus: { color: "#eeeeee", fontSize: 28 },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 }, brandText: { color: "#f2f0ec", fontSize: 18, fontWeight: "600" }, logo: { width: 27, height: 27, borderRadius: 9, backgroundColor: "#d97757", alignItems: "center", justifyContent: "center" }, logoText: { color: "#171411", fontSize: 19, fontWeight: "700" },
  settingsWrap: { flex: 1, paddingHorizontal: 24, justifyContent: "center" }, welcomeIcon: { alignSelf: "center", width: 56, height: 56, borderRadius: 18, backgroundColor: "#d97757", alignItems: "center", justifyContent: "center", marginBottom: 22 }, welcomeStar: { color: "#171411", fontSize: 34 }, title: { color: "#f2f0ec", fontSize: 25, fontWeight: "600", textAlign: "center", marginBottom: 10 }, subtitle: { color: "#a5a5a5", textAlign: "center", fontSize: 15, lineHeight: 22, marginBottom: 25 }, label: { color: "#a0a0a0", fontSize: 11, letterSpacing: 1.1, marginTop: 12, marginBottom: 7 }, input: { color: "#eeeeee", backgroundColor: "#1c1c1c", borderWidth: 1, borderColor: "#353535", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15 },
  primaryButton: { height: 50, backgroundColor: "#d97757", borderRadius: 13, justifyContent: "center", alignItems: "center", marginTop: 22 }, primaryText: { color: "#1b1715", fontWeight: "700", fontSize: 15 }, helper: { color: "#858585", fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 14 }, cancelButton: { padding: 14, alignItems: "center" }, cancelText: { color: "#d0d0d0" },
  chatArea: { flex: 1 }, emptyState: { flex: 1, justifyContent: "center", paddingHorizontal: 24 }, suggestions: { gap: 10, marginTop: 10 }, suggestion: { borderWidth: 1, borderColor: "#343434", borderRadius: 12, padding: 14, backgroundColor: "#181818" }, suggestionText: { color: "#d1d1d1", fontSize: 14 }, secondaryButton: { alignSelf: "center", borderWidth: 1, borderColor: "#454545", borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20, marginTop: 22 }, secondaryText: { color: "#eeeeee", fontWeight: "600" },
  messageList: { paddingHorizontal: 15, paddingVertical: 20, gap: 18 }, messageRow: { flexDirection: "row", alignItems: "flex-start", gap: 9 }, userRow: { justifyContent: "flex-end" }, assistantRow: { justifyContent: "flex-start" }, bubble: { maxWidth: "88%", borderRadius: 18, paddingHorizontal: 15, paddingVertical: 12 }, userBubble: { backgroundColor: "#292929", borderBottomRightRadius: 5 }, assistantBubble: { backgroundColor: "#111111", paddingLeft: 2 }, messageText: { color: "#eeeeee", fontSize: 16, lineHeight: 24 }, smallLogo: { width: 26, height: 26, borderRadius: 9, backgroundColor: "#d97757", alignItems: "center", justifyContent: "center", marginTop: 2 }, thinking: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  composerWrap: { paddingHorizontal: 12, paddingBottom: 8 }, composer: { flexDirection: "row", alignItems: "flex-end", backgroundColor: "#1c1c1c", borderColor: "#393939", borderWidth: 1, borderRadius: 22, paddingLeft: 14, paddingRight: 7, paddingTop: 7, paddingBottom: 7 }, composerInput: { flex: 1, maxHeight: 120, color: "#f1f1f1", fontSize: 16, paddingTop: 8, paddingBottom: 8 }, sendButton: { width: 38, height: 38, borderRadius: 13, backgroundColor: "#eeeeee", alignItems: "center", justifyContent: "center", marginLeft: 8 }, sendDisabled: { backgroundColor: "#555555" }, sendIcon: { color: "#151515", fontSize: 25, fontWeight: "700", lineHeight: 29 }, disclaimer: { color: "#777777", fontSize: 11, textAlign: "center", paddingTop: 8, paddingBottom: 3 },
})
