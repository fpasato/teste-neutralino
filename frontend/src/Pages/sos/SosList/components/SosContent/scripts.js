import { useEffect, useState, useCallback } from "react";
import {
  getAllSos,
  getSosById,
  attendSos,
} from "../../../../../services/supabase/sos";
import { supabase } from "../../../../../services/supabase/client";
import { useAuth } from "../../../../../contexts/AuthContext";

const TIMEZONE_OFFSET = "-03:00";

export function useSosContent({
  selectedStatuses = [],
  startDate,
  endDate,
  attendantId,
  sortBy = "recent",
  ibgeCode,
  ibgeCodes,
}) {
  const { attendant } = useAuth();
  const [sosList, setSosList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadSos() {
      try {
        setLoading(true);
        const statusParam =
          selectedStatuses.length > 0 ? selectedStatuses : null;
        const data = await getAllSos({
          status: selectedStatuses,
          startDate,
          endDate,
          sortBy,
          attendantId,
          ibgeCode,
          ibgeCodes,
        });
        if (active) {
          setSosList(data);
          setError(null);
        }
      } catch (err) {
        if (active) {
          console.error(err);
          setError(err.message);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadSos();
    return () => {
      active = false;
    };
  }, [selectedStatuses, startDate, endDate, attendantId, sortBy, ibgeCode, ibgeCodes]);

  useEffect(() => {
    const channel = supabase
      .channel("sos-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sos" },
        async (payload) => {
          try {
            const matchesStatus =
              selectedStatuses.length === 0 ||
              selectedStatuses.includes(payload.new.status);
            const matchesAttendant =
              !attendantId || payload.new.attendant_id === attendantId;

            // Compara como Date real, não como string — evita bug de timezone
            const createdAtDate = new Date(payload.new.created_at);
            const matchesStart =
              !startDate ||
              createdAtDate >=
                new Date(`${startDate}T00:00:00${TIMEZONE_OFFSET}`);
            const matchesEnd =
              !endDate ||
              createdAtDate <=
                new Date(`${endDate}T23:59:59${TIMEZONE_OFFSET}`);

            if (
              !matchesStatus ||
              !matchesAttendant ||
              !matchesStart ||
              !matchesEnd
            ) {
              return;
            }

            const fullSos = await getSosById(payload.new.id);
            setSosList((current) => [fullSos, ...current]);
          } catch (err) {
            console.error(err);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "sos" },
        (payload) => {
          setSosList((current) =>
            current.map((sos) =>
              sos.id === payload.new.id ? { ...sos, ...payload.new } : sos,
            ),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "locations" },
        (payload) => {
          setSosList((current) =>
            current.map((sos) =>
              sos.id === payload.new.sos_id
                ? { ...sos, locations: [...(sos.locations ?? []), payload.new] }
                : sos,
            ),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedStatuses, startDate, endDate, attendantId]);

  const getShortId = useCallback((sos) => {
    if (!sos) return "";
    const date = new Date(sos.created_at);
    const dateStr = date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    });
    const uf = sos.uf || "??";
    const shortHash = sos.id.slice(0, 4).toUpperCase();
    return `${uf}-${dateStr}-${shortHash}`;
  }, []);

  const handleAttend = useCallback(
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
    async (sosId) => {
      try {
        await attendSos(sosId, attendant.id);
        return sosId;
      } catch (err) {
        alert(err.message);
        return null;
      }
    },
    [attendant?.id],
  );

  const statusClassMap = {
    active: "statusActive",
    in_progress: "statusProgress",
    finished: "statusFinished",
    cancelled: "statusCancelled",
  };

  const statusLabelMap = {
    active: "Ativo",
    in_progress: "Em progresso",
    finished: "Finalizado",
    cancelled: "Cancelado",
  };

  return {
    sosList,
    loading,
    error,
    getShortId,
    handleAttend,
    statusClassMap,
    statusLabelMap,
  };
}
