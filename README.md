# Camera Path

Monorepo for an AI-assisted 3D camera-path editor.

```text
camera_path/
├── backend/     # FastAPI application, geometry compiler, agent and tests
└── frontend/    # Next.js camera-path editor
```

Run both applications in separate terminals:

```bash
cd backend && uv sync && uv run uvicorn camera_path.api:app --reload
cd frontend && npm install && npm run dev
```

See [`backend/README.md`](backend/README.md) and [`frontend/README.md`](frontend/README.md)
for configuration and development commands.
