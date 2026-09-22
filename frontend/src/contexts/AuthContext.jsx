import { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "../services/supabase/client";
import { getCurrentAttendant } from "../services/supabase/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [attendant, setAttendant] = useState(null);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef(null);

  async function loadAttendant() {
    const data = await getCurrentAttendant();

    // Rede de seguranca: se por algum motivo a sessao foi restaurada
    // (ex: app reaberto) e a conta ja estava desativada nesse meio tempo,
    // nao deixa nem carregar - desloga direto.
    if (data && data.active === false) {
      await forceSignOut();
      return;
    }

    setAttendant(data);
    setLoading(false);
    subscribeToOwnStatus(data?.id);
  }

  /**
   * Assina mudancas na propria linha de attendants em tempo real. Se um
   * admin/supervisor desativar essa conta enquanto o usuario esta logado,
   * o realtime dispara na hora e a sessao e encerrada imediatamente, sem
   * esperar um proximo fetch ou reload.
   */
  function subscribeToOwnStatus(attendantId) {
    if (!attendantId) return;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    const uniqueChannelName = `attendant-status-${attendantId}-${Math.random().toString(36).substring(7)}`;

    const channel = supabase
      .channel(uniqueChannelName)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "attendants",
          filter: `id=eq.${attendantId}`,
        },
        (payload) => {
          console.log("Realtime event received:", payload);
          if (payload.new && (payload.new.active === false || payload.new.active === 'false')) {
            forceSignOut();
          }
        }
      )
      .subscribe((status) => {
        console.log("Realtime subscription status:", status);
      });

    channelRef.current = channel;
  }

  async function forceSignOut() {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    await supabase.auth.signOut();
    setAttendant(null);
    setLoading(false);
  }

  useEffect(() => {
    // Carrega a sessão inicial
    loadAttendant();

    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setAttendant(null);
        setLoading(false);
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }
        return;
      }
      // Apenas recarrega se for um evento de login explícito (evita duplo load no mount inicial se INITIAL_SESSION disparar)
      if (event === "SIGNED_IN") {
        loadAttendant();
      }
    });

    return () => {
      subscription.subscription.unsubscribe();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  return (
    <AuthContext.Provider value={{ attendant, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}