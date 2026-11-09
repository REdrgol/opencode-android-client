# OpenCode Mobile (Android)

Cliente móvil de OpenCode con una interfaz de chat inspirada en aplicaciones modernas de asistentes. Está hecho con **React Native + Expo** y está preparado para Android Studio. Es un cliente para un servidor OpenCode que tú controles; no incluye ni suplanta Claude o ChatGPT.

## Requisitos

- Node.js LTS y npm
- Android Studio con Android SDK y un emulador o teléfono
- Un servidor OpenCode activo y accesible desde el teléfono

## Abrir en Android Studio y generar el APK

1. Clona este repositorio y ejecuta `npm install`.
2. Genera el proyecto nativo Android: `npx expo prebuild --platform android`.
3. Abre la carpeta `android/` con Android Studio y espera a que Gradle sincronice.
4. Para compilar desde Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**. El APK de depuración aparece en `android/app/build/outputs/apk/debug/`.

También puedes compilar desde la terminal con `npx expo run:android`. Para distribuirlo, crea una versión firmada desde **Build → Generate Signed Bundle / APK**. No compartas la clave de firma.

## Conectar el teléfono

1. Inicia OpenCode en una computadora/servidor accesible en la misma red, por ejemplo `opencode serve --hostname 0.0.0.0 --port 4096`.
2. En la app, usa una dirección como `http://192.168.1.20:4096` (la IP local del servidor), la contraseña si configuraste autenticación, y opcionalmente la ruta del proyecto en esa máquina.
3. Mantén el servidor protegido; no lo expongas directamente a internet. Para conexiones fuera de tu red local, usa una VPN privada o un proxy HTTPS autenticado.

> En el emulador Android, `localhost` apunta al emulador; para acceder al servidor del computador anfitrión suele usarse `10.0.2.2`.

## Funciones incluidas

- Configuración local segura de URL y contraseña con Android Keystore (Expo SecureStore).
- Creación de sesiones y envío de mensajes al servidor OpenCode.
- Conversación sencilla en español con estado de espera y mensajes de error.
- Interfaz oscura adaptable, ejemplos de prompts y nuevo chat.

Este es un punto de partida. La compilación de APK se realiza en Android Studio o en tu entorno local; no se ha generado un APK desde GitHub.
