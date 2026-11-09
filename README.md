# OpenCode Mobile

Cliente Android para OpenCode con una interfaz de chat moderna, pensada como una app móvil nativa para un backend de OpenCode.

## Qué incluye

- Pantalla de configuración para URL, password y directorio del proyecto.
- Conexión segura con SecureStore.
- Listado de sesiones desde OpenCode.
- Chat de usuario y asistente.
- Generación de nuevas sesiones.
- Soporte para app Android con Expo/React Native.

## Requisitos para compilar el APK

1. Instala Node.js LTS.
2. Instala Android Studio con SDK de Android.
3. Instala Expo CLI si lo necesitas.
4. Ejecuta:

```bash
npm install
npx expo prebuild --platform android
```

5. Abre la carpeta `android` con Android Studio.
6. Genera el APK desde **Build > Build APK(s)**.

## Cómo usarlo

1. Inicia OpenCode en tu PC o servidor.
2. Desde la app, introduce algo como `http://192.168.1.20:4096` (o `http://10.0.2.2:4096` si usas un emulador).
3. Si has configurado una contraseña, añádela también.
4. Haz clic en **Guardar y abrir chat**.
5. Crea una sesión o usa una existente y empieza a chatear.

> La app es un cliente móvil para un servidor OpenCode y no ejecuta el backend dentro del teléfono.

## Estructura del proyecto

- `App.tsx`: pantalla principal y flujo del chat.
- `src/api.ts`: cliente para OpenCode.
- `app.json`: configuración de Expo/Android.
- `package.json`: dependencias del proyecto.

## Seguridad

- La URL, contraseña y directorio se guardan con `expo-secure-store`.
- No se expone el servidor con autenticación débil en internet; usa VLAN/VPN o un proxy autenticado si necesitas acceso remoto.

## Nota

Este repositorio es un starter móvil para OpenCode. Es una base funcional para continuar desarrollándola y personalizarla como una app oficial de producto.
