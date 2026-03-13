import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import PageHeader from "@/components/PageHeader";
import { useToast } from "@/hooks/use-toast";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "").replace(/\/[^/]*$/, "") + "/api";

interface AdminUser { username: string; }

interface ReportOption { key: string; label: string; }
interface ReportType  { name: string; options: ReportOption[]; }

const REPORT_TYPES: ReportType[] = [
  {
    name: "Fitting Room Stats",
    options: [
      { key: "productCodes",      label: "Product Codes"       },
      { key: "fittingRoomAlerts", label: "Fitting Room Alerts"  },
      { key: "alertsAttendants",  label: "Alerts Attendants"   },
    ],
  },
  {
    name: "Branch Stats",
    options: [
      { key: "mainEntranceAlerts", label: "Main Fitting Room Entrance Alerts" },
      { key: "alertsAttendants",   label: "Alerts Attendants"                 },
    ],
  },
  {
    name: "Verbal",
    options: [
      { key: "alertResponse", label: "Fitting Room alert response" },
    ],
  },
];

type SelectionMap = Record<string, Record<string, boolean>>;

interface VoiceRecording {
  id:              number;
  branchCode:      string;
  fittingRoomId:   number | null;
  fittingRoomName: string | null;
  alertTime:       string;
  durationSec:     number | null;
  source:          string;
  audioObjectPath: string | null;
  transcript:      string | null;
  transcribedAt:   string | null;
}

function authHeaders() {
  const token = localStorage.getItem("sfr_admin_token");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

function fmtDuration(sec: number | null): string {
  if (!sec) return "—";
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,"0")}-${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()]}-${d.getFullYear()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

export default function Reports() {
  const [, setLocation]   = useLocation();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [branches, setBranches]     = useState<string[]>([]);
  const [branch, setBranch]         = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  // Voice recordings state
  const [recordings, setRecordings]             = useState<VoiceRecording[]>([]);
  const [loadingRecs, setLoadingRecs]           = useState(false);
  const [transcribing, setTranscribing]         = useState<Record<number, boolean>>({});
  const [expandedTranscript, setExpandedTranscript] = useState<Record<number, boolean>>({});

  // Selection checkboxes
  const [selection, setSelection] = useState<SelectionMap>(() => {
    const init: SelectionMap = {};
    for (const rt of REPORT_TYPES) {
      init[rt.name] = {};
      for (const opt of rt.options) init[rt.name][opt.key] = false;
    }
    return init;
  });

  useEffect(() => {
    const token   = localStorage.getItem("sfr_admin_token");
    const userStr = localStorage.getItem("sfr_admin_user");
    if (!token || !userStr) { setLocation("/login"); return; }
    try { setAdmin(JSON.parse(userStr)); } catch { setLocation("/login"); }
  }, [setLocation]);

  useEffect(() => {
    if (!admin) return;
    fetch(`${API_BASE}/fitting-rooms/branches`, { headers: authHeaders() })
      .then(r => r.json()).then(setBranches).catch(() => {});
  }, [admin]);

  // Load voice recordings when branch changes or Verbal is ticked
  const loadRecordings = useCallback(async () => {
    if (!selection["Verbal"]["alertResponse"]) { setRecordings([]); return; }
    setLoadingRecs(true);
    try {
      const qs  = branch ? `?branchCode=${encodeURIComponent(branch)}` : "";
      const res = await fetch(`${API_BASE}/voice-recordings${qs}`, { headers: authHeaders() });
      if (res.ok) setRecordings(await res.json());
    } catch { /* silent */ } finally { setLoadingRecs(false); }
  }, [branch, selection]);

  useEffect(() => { loadRecordings(); }, [loadRecordings]);

  const toggle = (reportName: string, key: string) => {
    setSelection(prev => ({
      ...prev,
      [reportName]: { ...prev[reportName], [key]: !prev[reportName][key] },
    }));
  };

  const allSelected = REPORT_TYPES.every(rt => rt.options.every(opt => selection[rt.name][opt.key]));
  const toggleAll   = () => {
    const next = !allSelected;
    setSelection(() => {
      const updated: SelectionMap = {};
      for (const rt of REPORT_TYPES) {
        updated[rt.name] = {};
        for (const opt of rt.options) updated[rt.name][opt.key] = next;
      }
      return updated;
    });
  };

  const hasAnySelection = Object.values(selection).some(opts => Object.values(opts).some(Boolean));

  // Download individual audio file
  const downloadAudio = (rec: VoiceRecording) => {
    const a = document.createElement("a");
    a.href  = `${API_BASE}/voice-recordings/${rec.id}/download`;
    a.download = `recording_${rec.id}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // AI Transcribe
  const transcribeRecording = async (rec: VoiceRecording) => {
    setTranscribing(prev => ({ ...prev, [rec.id]: true }));
    try {
      const res = await fetch(`${API_BASE}/voice-recordings/${rec.id}/transcribe`, {
        method: "POST",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Transcription failed");
      const data = await res.json();
      setRecordings(prev => prev.map(r => r.id === rec.id ? { ...r, transcript: data.transcript, transcribedAt: new Date().toISOString() } : r));
      setExpandedTranscript(prev => ({ ...prev, [rec.id]: true }));
      toast({ title: "Transcribed", description: data.cached ? "Loaded existing transcript." : "Audio transcribed successfully." });
    } catch {
      toast({ title: "Error", description: "Transcription failed. Please try again.", variant: "destructive" });
    } finally {
      setTranscribing(prev => ({ ...prev, [rec.id]: false }));
    }
  };

  // Generate & download PDF
  const generatePDF = async () => {
    if (!hasAnySelection) {
      toast({ title: "Nothing selected", description: "Please tick at least one column option.", variant: "destructive" });
      return;
    }
    setIsGenerating(true);
    try {
      let rooms: { name: string; roomId: string; branchCode: string; status: string; location: string }[] = [];
      if (branch === "ALL") {
        const all = await Promise.all(
          branches.map(b => fetch(`${API_BASE}/fitting-rooms?branchCode=${encodeURIComponent(b)}`, { headers: authHeaders() }).then(r => r.ok ? r.json() : []))
        );
        rooms = all.flat();
      } else if (branch) {
        const res = await fetch(`${API_BASE}/fitting-rooms?branchCode=${encodeURIComponent(branch)}`, { headers: authHeaders() });
        if (res.ok) rooms = await res.json();
      }

      const doc    = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const now    = new Date();
      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const dateStr = `${String(now.getDate()).padStart(2,"0")}-${months[now.getMonth()]}-${now.getFullYear()}`;
      const timeStr = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
      const pageW  = doc.internal.pageSize.getWidth();
      let yPos     = 15;

      doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.setTextColor(30, 63, 122);
      doc.text("Smart Fitting Room — Report", 14, yPos); yPos += 7;
      doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(80, 80, 80);
      const branchLabel = branch === "ALL" ? "All Branches" : branch || "All Branches";
      doc.text(`Generated: ${dateStr} ${timeStr}  |  Branch: ${branchLabel}  |  Generated by: ${admin?.username ?? ""}`, 14, yPos); yPos += 8;

      for (const rt of REPORT_TYPES) {
        const selectedOpts = rt.options.filter(o => selection[rt.name][o.key]);
        if (selectedOpts.length === 0) continue;

        doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(30, 63, 122);
        doc.text(rt.name, 14, yPos); yPos += 4;

        let head: string[][] = [];
        let body: string[][] = [];

        if (rt.name === "Fitting Room Stats") {
          const cols = ["Fitting Room", "Room ID", "Status", "Location"];
          const optCols: string[] = [];
          if (selection[rt.name].productCodes)      { cols.push("Product Codes");      optCols.push("productCodes"); }
          if (selection[rt.name].fittingRoomAlerts)  { cols.push("Fitting Room Alerts"); optCols.push("fittingRoomAlerts"); }
          if (selection[rt.name].alertsAttendants)   { cols.push("Alerts Attendants");   optCols.push("alertsAttendants"); }
          head = [cols];
          body = rooms.length > 0
            ? rooms.map(r => {
                const row = [r.name, r.roomId, r.status.charAt(0).toUpperCase() + r.status.slice(1), r.location || "—"];
                if (optCols.includes("productCodes"))      row.push("—");
                if (optCols.includes("fittingRoomAlerts")) row.push("0");
                if (optCols.includes("alertsAttendants"))  row.push("—");
                return row;
              })
            : [["No fitting rooms found", "", "", "", ...optCols.map(() => "")]];

        } else if (rt.name === "Branch Stats") {
          const cols = ["Branch Code", "Total Rooms", "Available", "Occupied", "Alert"];
          if (selection[rt.name].mainEntranceAlerts) cols.push("Main Entrance Alerts");
          if (selection[rt.name].alertsAttendants)   cols.push("Alerts Attendants");
          head = [cols];
          const groups = new Map<string, typeof rooms>();
          for (const r of rooms) {
            const bc = r.branchCode ?? branch;
            if (!groups.has(bc)) groups.set(bc, []);
            groups.get(bc)!.push(r);
          }
          if (groups.size === 0) groups.set(branch || "—", []);
          body = [...groups.entries()].map(([bc, bRooms]) => {
            const row = [bc, String(bRooms.length),
              String(bRooms.filter(r => r.status === "available").length),
              String(bRooms.filter(r => r.status === "occupied").length),
              String(bRooms.filter(r => r.status === "alert").length)];
            if (selection[rt.name].mainEntranceAlerts) row.push("0");
            if (selection[rt.name].alertsAttendants)   row.push("—");
            return row;
          });

        } else if (rt.name === "Verbal") {
          head = [["Fitting Room", "Alert Time", "Source", "Duration", "Transcript"]];
          body = recordings.length > 0
            ? recordings.map(r => [
                r.fittingRoomName ?? "—",
                fmtDate(r.alertTime),
                r.source === "mobile" ? "Mobile" : "Fitting Room",
                fmtDuration(r.durationSec),
                r.transcript ?? "(not transcribed)",
              ])
            : [["No recordings found for this branch", "", "", "", ""]];
        }

        autoTable(doc, {
          startY: yPos, head, body, theme: "grid",
          headStyles:         { fillColor: [30, 63, 122], textColor: 255, fontStyle: "bold", fontSize: 9 },
          bodyStyles:         { fontSize: 8.5, textColor: [40, 40, 40] },
          alternateRowStyles: { fillColor: [240, 244, 250] },
          margin:             { left: 14, right: 14 },
          tableWidth:         pageW - 28,
          columnStyles:       rt.name === "Verbal" ? { 4: { cellWidth: "auto" } } : {},
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i); doc.setFontSize(8); doc.setTextColor(150);
        doc.text(`Page ${i} of ${totalPages}  —  Smart Fitting Room Management System`, 14, doc.internal.pageSize.getHeight() - 6);
      }

      doc.save(`SFR_Report_${branch || "All"}_${dateStr}.pdf`);
      toast({ title: "Downloaded", description: "Your report PDF has been saved." });
    } catch {
      toast({ title: "Error", description: "Failed to generate report.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  if (!admin) return null;

  const verbalChecked = selection["Verbal"]["alertResponse"];

  return (
    <div className="min-h-screen w-full flex flex-col" style={{ backgroundColor: "#1e3f7a" }}>
      <PageHeader title={`Account: (${admin.username})`} breadcrumb="Home/Reports" />

      <main className="flex-1 flex flex-col px-8 pt-2 pb-8">

        {/* Branch selector */}
        <div className="flex items-stretch mb-6 rounded-lg overflow-hidden w-full max-w-xl" style={{ border: "2px solid #fff" }}>
          <div className="flex items-center px-5 font-bold text-white text-sm" style={{ backgroundColor: "#111827", minWidth: "130px" }}>
            Branch Code
          </div>
          <div className="relative flex-1">
            <select
              value={branch}
              onChange={e => setBranch(e.target.value)}
              className="w-full h-full appearance-none px-4 py-3 text-gray-500 text-sm font-medium focus:outline-none"
              style={{ backgroundColor: "#e0e0e0" }}
            >
              <option value="">Select branch code</option>
              <option value="ALL">All Branches</option>
              {branches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
              <svg viewBox="0 0 16 10" fill="none" className="w-4 h-3">
                <path d="M1 1l7 8 7-8" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* Report table */}
        <div className="w-full rounded-xl overflow-hidden border border-white/10 mb-4">
          {/* Header row */}
          <div className="grid text-white font-bold text-sm" style={{ backgroundColor: "#111827", gridTemplateColumns: "1fr 1.6fr" }}>
            <div className="flex items-center px-5 py-3 border-r border-white/10">Report Type</div>
            <div className="flex items-center justify-between px-5 py-3">
              <span>Column Options</span>
              <button
                onClick={toggleAll}
                className="flex items-center gap-2 text-xs font-semibold transition hover:opacity-80 active:scale-95 rounded px-2.5 py-1"
                style={{ backgroundColor: allSelected ? "#3b5fa0" : "#ffffff22", color: "#fff", border: "1px solid rgba(255,255,255,0.3)" }}
              >
                <span className="w-4 h-4 shrink-0 border-2 rounded flex items-center justify-center"
                  style={{ backgroundColor: allSelected ? "#fff" : "transparent", borderColor: "#fff" }}>
                  {allSelected && (
                    <svg viewBox="0 0 12 10" fill="none" className="w-2.5 h-2.5">
                      <path d="M1 5l3.5 3.5L11 1" stroke="#1e3f7a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                {allSelected ? "Deselect All" : "Select All"}
              </button>
            </div>
          </div>

          {/* Rows */}
          {REPORT_TYPES.map((rt, idx) => (
            <div key={rt.name}>
              <div
                className="grid border-t border-white/10"
                style={{ gridTemplateColumns: "1fr 1.6fr", backgroundColor: idx % 2 === 0 ? "#e8eaed" : "#d8dbe2" }}
              >
                <div className="flex items-center px-5 py-4 border-r border-white/20 text-sm font-medium text-gray-800">
                  {rt.name}
                  {rt.name === "Verbal" && (
                    <span className="ml-2 text-xs text-gray-500 font-normal">— AI transcribed</span>
                  )}
                </div>
                <div className="flex flex-col gap-2 px-5 py-4">
                  {rt.options.map(opt => {
                    const checked = selection[rt.name][opt.key];
                    return (
                      <label key={opt.key} className="flex items-center gap-3 cursor-pointer group">
                        <button
                          onClick={() => toggle(rt.name, opt.key)}
                          role="checkbox" aria-checked={checked}
                          className="w-5 h-5 shrink-0 border-2 rounded flex items-center justify-center transition"
                          style={{ backgroundColor: checked ? "#1e3f7a" : "#fff", borderColor: checked ? "#1e3f7a" : "#888" }}
                        >
                          {checked && (
                            <svg viewBox="0 0 12 10" fill="none" className="w-3 h-3">
                              <path d="M1 5l3.5 3.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </button>
                        <span className="text-sm text-gray-800 group-hover:text-gray-900 transition select-none"
                          onClick={() => toggle(rt.name, opt.key)}>
                          {opt.label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Voice Recordings Panel — shown when Verbal is checked */}
              {rt.name === "Verbal" && verbalChecked && (
                <div className="border-t border-white/10" style={{ backgroundColor: "#f0f4fb" }}>
                  <div className="px-5 py-3 flex items-center justify-between border-b border-gray-200">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                      <span className="text-sm font-semibold text-gray-800">
                        Alert Voice Recordings
                        {recordings.length > 0 && <span className="ml-2 text-xs text-gray-500">({recordings.length} recording{recordings.length !== 1 ? "s" : ""})</span>}
                      </span>
                    </div>
                    <button onClick={loadRecordings} className="text-xs text-blue-700 hover:underline">Refresh</button>
                  </div>

                  {loadingRecs ? (
                    <div className="px-5 py-4 text-sm text-gray-500">Loading recordings…</div>
                  ) : recordings.length === 0 ? (
                    <div className="px-5 py-5 text-sm text-gray-500 text-center">
                      No recordings found{branch && branch !== "ALL" ? ` for branch ${branch}` : ""}.<br />
                      <span className="text-xs">Recordings are uploaded by fitting room devices following an alert.</span>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {recordings.map(rec => (
                        <div key={rec.id} className="px-5 py-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm text-gray-800">{rec.fittingRoomName ?? `Room #${rec.fittingRoomId ?? rec.id}`}</span>
                                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                  style={{ backgroundColor: rec.source === "mobile" ? "#dbeafe" : "#d1fae5", color: rec.source === "mobile" ? "#1d4ed8" : "#065f46" }}>
                                  {rec.source === "mobile" ? "Mobile" : "Fitting Room"}
                                </span>
                                <span className="text-xs text-gray-500">{fmtDate(rec.alertTime)}</span>
                                {rec.durationSec && <span className="text-xs text-gray-400">{fmtDuration(rec.durationSec)}</span>}
                                <span className="text-xs text-gray-400">Branch: {rec.branchCode}</span>
                              </div>

                              {/* Transcript area */}
                              {rec.transcript && expandedTranscript[rec.id] && (
                                <div className="mt-2 rounded-lg p-3 text-xs text-gray-700 leading-relaxed" style={{ backgroundColor: "#e8f0fe", border: "1px solid #c7d7f9" }}>
                                  <span className="font-semibold text-blue-800 block mb-1">AI Transcript</span>
                                  {rec.transcript}
                                </div>
                              )}
                              {rec.transcribedAt && (
                                <button onClick={() => setExpandedTranscript(prev => ({ ...prev, [rec.id]: !prev[rec.id] }))}
                                  className="mt-1 text-xs text-blue-600 hover:underline">
                                  {expandedTranscript[rec.id] ? "Hide transcript" : "Show transcript"}
                                </button>
                              )}
                            </div>

                            {/* Action buttons */}
                            <div className="flex items-center gap-2 shrink-0">
                              {rec.audioObjectPath && (
                                <button onClick={() => downloadAudio(rec)}
                                  title="Download audio file"
                                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition hover:brightness-95"
                                  style={{ backgroundColor: "#1e3f7a", color: "#fff" }}>
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                  </svg>
                                  Audio
                                </button>
                              )}
                              <button
                                onClick={() => transcribeRecording(rec)}
                                disabled={transcribing[rec.id]}
                                title="Transcribe with AI"
                                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition hover:brightness-95"
                                style={{ backgroundColor: rec.transcript ? "#065f46" : "#7c3aed", color: "#fff", opacity: transcribing[rec.id] ? 0.6 : 1 }}
                              >
                                {transcribing[rec.id] ? (
                                  <>
                                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                    </svg>
                                    Transcribing…
                                  </>
                                ) : rec.transcript ? (
                                  <>
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Re-transcribe
                                  </>
                                ) : (
                                  <>
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                    </svg>
                                    AI Transcribe
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* API info for IoT devices */}
        {verbalChecked && (
          <div className="mb-6 rounded-xl px-5 py-3 text-xs text-blue-100 flex items-start gap-2" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
            <svg className="w-4 h-4 mt-0.5 shrink-0 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              <strong>Fitting room &amp; mobile devices</strong> upload recordings via <code className="bg-white/10 rounded px-1">POST {API_BASE}/voice-recordings/upload</code> (multipart/form-data: <code className="bg-white/10 rounded px-1">audio</code> file + <code className="bg-white/10 rounded px-1">branchCode</code>, <code className="bg-white/10 rounded px-1">fittingRoomName</code>, <code className="bg-white/10 rounded px-1">source</code> fields).
            </span>
          </div>
        )}

        {/* Download PDF button */}
        <div className="flex justify-center">
          <button
            onClick={generatePDF}
            disabled={isGenerating}
            className="rounded-xl px-20 py-3.5 font-semibold text-gray-700 text-base transition hover:brightness-95 active:scale-[0.98]"
            style={{ backgroundColor: "#ffffff", minWidth: "220px", opacity: isGenerating ? 0.7 : 1 }}
          >
            {isGenerating ? "Generating…" : "Download"}
          </button>
        </div>
      </main>
    </div>
  );
}
