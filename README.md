# Net Finance (React → Web estática → Desktop .exe com Electron)

## 1) Estrutura de arquivos

```text
Net-Financev2/
├─ electron/
│  ├─ main.js
│  └─ preload.js
├─ src/
│  ├─ App.jsx
│  └─ main.jsx
├─ index.html
├─ package.json
├─ vite.config.js
└─ README.md
```

## 2) Configuração do Electron

Arquivo `electron/main.js`:

- Em desenvolvimento, abre `http://localhost:5173`.
- Em produção, abre `dist/index.html` (gerado pelo `vite build`).

## 3) Scripts no package.json

- `npm run dev:web` → sobe o React com Vite.
- `npm run build:web` → gera a versão web estática em `dist/`.
- `npm run preview:web` → testa localmente o build estático.
- `npm run electron:dev` → roda web + Electron em modo dev.
- `npm run dist` → build web + empacota instalador `.exe`.

## 4) Passo a passo (index.html e .exe)

### Pré-requisitos

- Node.js 18+
- npm 9+

### A) Gerar versão web estática (`dist/index.html`)

```bash
npm install
npm run build:web
```

Saída principal: `dist/index.html`.

Para validar:

```bash
npm run preview:web
```

### B) Rodar como desktop em desenvolvimento

```bash
npm run electron:dev
```

### C) Gerar instalador Windows (`.exe`)

```bash
npm run dist
```

Arquivo final (exemplo):

```text
release/Net Finance-Setup-1.0.0.exe
```

## Variáveis de ambiente (Firebase)

Crie um arquivo `.env` na raiz (opcional):

```bash
VITE_FIREBASE_CONFIG={"apiKey":"...","authDomain":"...","projectId":"...","storageBucket":"...","messagingSenderId":"...","appId":"..."}
VITE_APP_ID=net-finance-cinematic-v1
VITE_INITIAL_AUTH_TOKEN=
```

> Se você estiver migrando de um ambiente que usa `__firebase_config`, `__app_id` e `__initial_auth_token`, o código já tem fallback para `VITE_*`.
