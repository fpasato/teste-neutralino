import { Outlet } from "react-router-dom";
import { Header } from "../Header";
import { Sidebar } from "../Sidebar";
import { useSosAlarm } from "../../hooks/useSosAlarm";
import { useEscapeToHome, useLeafletAttributionInNewTab } from "../../utils/useEscapeToHome";

export function AppLayout() {
  useSosAlarm();
  useEscapeToHome();
  useLeafletAttributionInNewTab();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <Header />
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <Sidebar />
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}