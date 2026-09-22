import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getSosById,
  finishSos,
  dispatchSos,
  attendSos,
} from "../../../services/supabase/sos";
import { useAuth } from "../../../contexts/AuthContext";
import { supabase } from "../../../services/supabase/client";
import {
  getElapsedTime,
  getVehicleStatus,
  getLatestAccuracy,
} from "../../../utils/sosDisplay";

export function useSosDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { attendant } = useAuth(); 

  const [sos, setSos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Carrega dados do SOS
  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        const data = await getSosById(id);
        if (active) setSos(data);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [id]);

  // Realtime updates
  useEffect(() => {
    const channel = supabase
      .channel(`sos-detail-${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sos",
          filter: `id=eq.${id}`,
        },
        (payload) =>
          setSos((current) =>
            current ? { ...current, ...payload.new } : current,
          ),
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "locations",
          filter: `sos_id=eq.${id}`,
        },
        (payload) =>
          setSos((current) =>
            current
              ? {
                  ...current,
                  locations: [...(current.locations ?? []), payload.new],
                }
              : current,
          ),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  // Handlers
  const handleAttend = useCallback(async () => {
    if (!id || !attendant?.id) {
      alert("Dados insuficientes para atender a ocorrência.");
      return;
    }
    try {
      await attendSos(id, attendant.id);
    } catch (err) {
      alert(err.message);
    }
  }, [id, attendant?.id]);

  const handleDispatch = useCallback(async () => {
    try {
      await dispatchSos(id);
    } catch (err) {
      alert(err.message);
    }
  }, [id]);

  const handleFinish = useCallback(async () => {
    try {
      await finishSos(id);
    } catch (err) {
      alert(err.message);
    }
  }, [id]);

  const goBack = useCallback(() => navigate("/home"), [navigate]);

  // Derivações de dados
  const accuracy = getLatestAccuracy(sos);

  const getShortId = () => {
    if (!sos) return "";
    const date = new Date(sos.created_at);
    const dateStr = date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    });
    const uf = sos.uf || "??";
    const shortHash = sos.id.slice(0, 4).toUpperCase();
    return `${uf}-${dateStr}-${shortHash}`;
  };

  const createdAt = sos ? new Date(sos.created_at) : null;
  const formattedDate = createdAt ? createdAt.toLocaleDateString() : "";
  const formattedTime = createdAt
    ? createdAt.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  const statusLabelMap = {
    active: "Aguardando atendimento",
    in_progress: "Em atendimento",
    finished: "Finalizado",
    cancelled: "Cancelado",
  };

  const isFinished = sos
    ? sos.status === "finished" || sos.status === "cancelled"
    : false;

  const sortedLocations = [...(sos?.locations ?? [])].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at),
  );

  return {
    sos,
    loading,
    error,
    attendant,
    accuracy,
    getShortId,
    formattedDate,
    formattedTime,
    statusLabelMap,
    isFinished,
    sortedLocations,
    handleAttend,
    handleDispatch,
    handleFinish,
    goBack,
    getElapsedTime,
    getVehicleStatus,
  };
}