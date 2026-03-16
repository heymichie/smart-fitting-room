import { useState } from "react";
import MainEntranceAlertModal, { type EntranceAlertPayload } from "../components/MainEntranceAlertModal";

const DEMO_ALERT: EntranceAlertPayload = {
  sessionId:   1,
  branchCode:  "BRANCH-501",
  customerId:  "CID-X7K3M2",
  alertTime:   "1617",
  entryCodes:  ["1053578", "1055767", "1055767"],
  exitCodes:   ["1053578"],
  entryCount:  3,
  exitCount:   1,
  quantityOk:  false,
  codesOk:     false,
  cctvClipUrl: null,
};

export default function AlertDemoPage() {
  const [show, setShow] = useState(true);
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6"
      style={{ backgroundColor: "#1e3a6e" }}>
      <p className="text-white/70 text-sm">Main Fitting Room Entrance Alert — live preview</p>
      <button
        onClick={() => setShow(true)}
        className="px-6 py-3 rounded-xl font-bold text-white transition hover:brightness-90"
        style={{ backgroundColor: "#dd0000" }}
      >
        Show Alert
      </button>
      {show && (
        <MainEntranceAlertModal
          alert={DEMO_ALERT}
          onClose={() => setShow(false)}
        />
      )}
    </div>
  );
}
