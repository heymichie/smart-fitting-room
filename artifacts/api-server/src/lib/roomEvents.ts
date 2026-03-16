import type { Response } from "express";

const sseClients = new Map<string, Set<Response>>();

export function addSseClient(branchCode: string, res: Response) {
  if (!sseClients.has(branchCode)) sseClients.set(branchCode, new Set());
  sseClients.get(branchCode)!.add(res);
}

export function removeSseClient(branchCode: string, res: Response) {
  sseClients.get(branchCode)?.delete(res);
}

export function broadcastRoomEvent(branchCode: string, event: string, data: unknown) {
  const clients = sseClients.get(branchCode);
  if (!clients || clients.size === 0) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    try { client.write(payload); } catch { /* disconnected */ }
  }
}
