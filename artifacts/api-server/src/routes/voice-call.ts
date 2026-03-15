import { Router, type Request, type Response } from "express";

const router = Router();

interface RoomCallState {
  offer?: object;
  answer?: object;
  supervisorRes?: Response;
  roomRes?: Response;
}

const callStates = new Map<string, RoomCallState>();

function getState(roomId: string): RoomCallState {
  if (!callStates.has(roomId)) callStates.set(roomId, {});
  return callStates.get(roomId)!;
}

function sendSSE(res: Response | undefined, event: string, data: object) {
  if (res && !res.writableEnded) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }
}

router.get("/voice-call/events/:roomId/:role", (req: Request, res: Response) => {
  const { roomId, role } = req.params;

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write("event: connected\ndata: {}\n\n");

  const state = getState(roomId);
  if (role === "supervisor") {
    state.supervisorRes = res;
    if (state.answer) sendSSE(res, "answer", state.answer);
  } else {
    state.roomRes = res;
    if (state.offer) sendSSE(res, "offer", state.offer);
  }

  const keepAlive = setInterval(() => {
    if (res.writableEnded) { clearInterval(keepAlive); return; }
    res.write(": ping\n\n");
  }, 20000);

  req.on("close", () => {
    clearInterval(keepAlive);
    const s = callStates.get(roomId);
    if (s) {
      if (role === "supervisor") delete s.supervisorRes;
      else delete s.roomRes;
    }
  });
});

router.post("/voice-call/offer/:roomId", (req: Request, res: Response) => {
  const { roomId } = req.params;
  const state = getState(roomId);
  state.offer = req.body;
  sendSSE(state.roomRes, "offer", req.body);
  res.json({ ok: true });
});

router.post("/voice-call/answer/:roomId", (req: Request, res: Response) => {
  const { roomId } = req.params;
  const state = getState(roomId);
  state.answer = req.body;
  sendSSE(state.supervisorRes, "answer", req.body);
  res.json({ ok: true });
});

router.post("/voice-call/ice/:roomId/:from", (req: Request, res: Response) => {
  const { roomId, from } = req.params;
  const state = getState(roomId);
  if (from === "supervisor") sendSSE(state.roomRes, "ice", req.body);
  else sendSSE(state.supervisorRes, "ice", req.body);
  res.json({ ok: true });
});

router.post("/voice-call/end/:roomId", (req: Request, res: Response) => {
  const { roomId } = req.params;
  const state = callStates.get(roomId);
  if (state) {
    sendSSE(state.supervisorRes, "end", {});
    sendSSE(state.roomRes, "end", {});
    callStates.delete(roomId);
  }
  res.json({ ok: true });
});

export default router;
