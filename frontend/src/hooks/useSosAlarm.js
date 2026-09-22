import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../services/supabase/client";

export function useSosAlarm() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const channel = supabase
      .channel("sos-alarm-global")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sos" },
        (payload) => {
          if (payload.new.status === "active") {
            playAlarm();
            // Verifica se o usuário está na rota do mapa
            if (!location.pathname.includes("/mapview")) {
              navigate("/home");
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [navigate, location.pathname]);
}

function playAlarm() {
  const audio = new Audio(new URL("/alarme.mp3", import.meta.url).href);
  audio
    .play()
    .catch((err) => console.warn("Não foi possível tocar o alarme:", err));
}