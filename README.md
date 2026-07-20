# FACTORY MANAGER

Gestione locale di risorse, ricette e catene di produzione di **Satisfactory**, costruito con Electron e SQLite (via sql.js, nessuna compilazione nativa).

## Struttura

```
satisfactory/
├── electron/           # Processo main Electron
│   ├── main.js
│   └── preload.js
├── src/
│   ├── database/       # Layer SQLite (sql.js)
│   │   └── index.js
│   └── renderer/       # UI (HTML/CSS/JS)
│       ├── assets/     # Logo e immagini UI
│       ├── index.html
│       ├── styles/
│       └── scripts/
└── data/               # Placeholder — il DB vive in userData
```

## Avvio

```bash
npm install
npm start
```

Dev mode (con DevTools):

```bash
npm run dev
```

## Database

SQLite viene creato automaticamente in:

- Windows: `%APPDATA%/satisfactory-manager/data/satisfactory.db`

Tabelle iniziali: `items`, `item_categories`, `item_schemas`, `schema_io`.
