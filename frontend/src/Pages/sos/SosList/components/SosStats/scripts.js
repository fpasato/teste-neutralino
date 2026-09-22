// components/HomeComponents/SosStats/scripts.js
import { useState, useEffect, useCallback, useRef } from "react";
import { getSosStats } from "../../../../../services/supabase/stats";
import { supabase } from "../../../../../services/supabase/client";

export function useSosStats({ status, startDate, endDate, ibgeCode, ibgeCodes } = {}) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const hasLoadedOnce = useRef(false);

  const fetchStats = useCallback(async () => {
    setError(null);
    try {
      const data = await getSosStats({ status, startDate, endDate, ibgeCode, ibgeCodes });
      setStats(data);
      hasLoadedOnce.current = true;
    } catch (err) {
      setError(err.message || "Erro ao carregar estatísticas.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(status), startDate, endDate, ibgeCode, ibgeCodes]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    let debounceTimer;
    const debouncedFetch = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(fetchStats, 1000);
    };

    const channel = supabase
      .channel("sos-stats-updates")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sos" },
        debouncedFetch,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "sos" },
        debouncedFetch,
      )
      .subscribe();

    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [fetchStats]);

  return { stats, error, refetch: fetchStats };
}
