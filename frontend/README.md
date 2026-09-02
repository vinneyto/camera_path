# Camera Path frontend

Next.js, TypeScript and React Three Fiber editor for the Camera Path API. The source follows
Feature-Sliced Design layers: route composition in `app`, business actions in `features`, domain
models in `entities`, large interface blocks in `widgets`, and reusable code in `shared`.

## Run

Start the backend first, then:

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Open <http://localhost:3000>. `NEXT_PUBLIC_API_URL` points the browser at the FastAPI server.
The backend must have `OPENAI_API_KEY` configured for chat; project and anchor APIs work without it.

## Checks

```bash
npm run test
npm run lint
npm run build
```

Click a primitive to create a labeled path anchor. Insert the resulting anchor token into chat,
ask the agent to build a spline or spiral, then click the rendered trajectory to open its speed
and camera-aim panels. Playback uses the compiled speed profile and camera direction track.
