# YiziView - AI Photography Image Viewer

A high-performance Windows desktop image viewer built with Electron, React, and Vite.

## Features
- Fast image browsing with virtualization
- Metadata tagging (Models, Brands)
- File management (Delete, Move, Drag & Drop)
- Dark mode UI

## Development

### Install Dependencies
```bash
npm install
```

### Run Locally (Dev)
```bash
npm run dev
```

### Build for Windows
```bash
npm run build
```

## Structure
- `electron/`: Main process code
- `src/`: Renderer process (React) code
- `storage/`: Local data (tags)
