import { useEffect, useState, useCallback } from "react";
import { getDashboardStats } from "../../services/supabase/stats";
import { supabase } from "../../services/supabase/client";
import { getAllRegions, getMunicipalitiesByRegion, getRegionByIbgeCode } from "../../services/supabase/municipalities";

export const STATUS_LABELS = {
  active: "Ativo",
  in_progress: "Em andamento",
  finished: "Finalizada",
  cancelled: "Cancelada",
};

export const STATUS_COLORS = {
  active: "#f63b3bff",
  in_progress: "#318effff",
  finished: "#22c55e",
  cancelled: "#e8963fff",
};

const MIN_RANGE_DAYS = 7;

/* ---------- utilitários de data ---------- */
export function toISODateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function diffInDays(start, end) {
  const a = new Date(`${start}T00:00:00`);
  const b = new Date(`${end}T00:00:00`);
  return Math.round((b - a) / (1000 * 60 * 60 * 24)) + 1;
}

/* ---------- gráfico de área (linha do tempo) ---------- */
export function buildAreaChartOptions(lineData) {
  return {
    chart: {
      toolbar: { show: false },
      zoom: { enabled: false },
    },
    colors: ["#f63b3b"],
    stroke: {
      curve: "smooth",
      width: 2,
    },
    fill: {
      type: "gradient",
      gradient: {
        shade: "light",
        type: "vertical",
        shadeIntensity: 0,
        gradientToColors: ["#f63b3b"],
        inverseColors: false,
        opacityFrom: 0.5,
        opacityTo: 0,
        stops: [0, 100],
      },
    },
    dataLabels: { enabled: false },
    grid: {
      strokeDashArray: 0,
      borderColor: "#c6bfbfff",
    },
    xaxis: {
      categories: lineData.map((d) => d.data),
    },
    yaxis: {
      labels: {
        formatter: (val) => Math.round(val),
      },
    },
    tooltip: {
      theme: "dark",
    },
  };
}

/* ---------- gráfico de rosca (donut) ---------- */
export function buildDonutChartOptions(donutData) {
  return {
    labels: donutData.map((d) => d.name),
    colors: donutData.map((d) => d.color),
    legend: { show: false },
    dataLabels: { enabled: false },
    stroke: { width: 0 },
    plotOptions: {
      pie: {
        donut: {
          size: "65%",
          labels: {
            show: true,
            total: {
              show: true,
              label: "Total",
              color: "#ffffff",
            },
            value: {
              color: "#ffffff",
            },
          },
        },
      },
    },
    tooltip: {
      theme: "light",
    },
  };
}

export function getShortId(sos) {
  if (!sos) return "";
  const date = new Date(sos.created_at);
  const dateStr = date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
  const uf = sos.uf || "??";
  const shortHash = sos.id.slice(0, 4).toUpperCase();
  return `${uf}-${dateStr}-${shortHash}`;
}


/* ---------- hook principal ---------- */
export function useDashboard(attendant) {
  const today = new Date();
  const defaultEnd = toISODateOnly(today);
  const defaultStartDate = new Date(today);
  defaultStartDate.setDate(defaultStartDate.getDate() - (MIN_RANGE_DAYS - 1));

  const [range, setRange] = useState({
    startDate: toISODateOnly(defaultStartDate),
    endDate: defaultEnd,
  });
  const [rangeError, setRangeError] = useState("");
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [regions, setRegions] = useState([]);
  const [municipalities, setMunicipalities] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [regionName, setRegionName] = useState("");
  const [supervisorRegion, setSupervisorRegion] = useState(null);

  const load = useCallback(
    async (currentRange, currentCity, currentRegion, currentMunicipalities, { isBackground = false } = {}) => {
      try {
        if (isBackground) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        let ibgeCode = null;
        let ibgeCodes = [];

        if (currentCity) {
          ibgeCode = currentCity;
        } else if (currentRegion && currentMunicipalities.length > 0) {
          ibgeCodes = currentMunicipalities.map((m) => m.ibge_code);
        }

        const data = await getDashboardStats({ ...currentRange, ibgeCode, ibgeCodes });
        setStats(data);
      } catch (err) {
        console.error("Erro ao carregar estatísticas:", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    // Supervisor: so busca depois que a regiao dele foi resolvida (senao busca sem filtro por 1 frame)
    if (attendant?.role === "supervisor" && !selectedRegion) return;

    load(range, selectedCity, selectedRegion, municipalities, { isBackground: stats !== null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, selectedCity, selectedRegion, municipalities, attendant]);

  useEffect(() => {
    async function loadRegions() {
      try {
        const data = await getAllRegions();
        setRegions(data);
      } catch (err) {
        console.error("Erro ao carregar regiões:", err);
      }
    }
    loadRegions();
  }, []);

  useEffect(() => {
    async function loadSupervisorRegion() {
      if (attendant?.role === "supervisor" && attendant?.ibge_code) {
        try {
          const region = await getRegionByIbgeCode(attendant.ibge_code);
          if (region) {
            setSupervisorRegion(region);
            setRegionName(region.name);
            setSelectedRegion(region.id);
            const municipalitiesData = await getMunicipalitiesByRegion(region.id);
            setMunicipalities(municipalitiesData);
          }
        } catch (err) {
          console.error("Erro ao carregar região do supervisor:", err);
        }
      }
    }
    loadSupervisorRegion();
  }, [attendant]);

  useEffect(() => {
    async function loadMunicipalities() {
      if (selectedRegion && attendant?.role !== "supervisor") {
        try {
          const data = await getMunicipalitiesByRegion(selectedRegion);
          setMunicipalities(data);
          if (selectedCity && !data.some((c) => c.ibge_code === selectedCity)) {
            setSelectedCity("");
          }
        } catch (err) {
          console.error("Erro ao carregar municípios:", err);
        }
      } else if (!selectedRegion && attendant?.role !== "supervisor") {
        setMunicipalities([]);
        setSelectedCity("");
      }
    }
    loadMunicipalities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRegion, attendant]);

  useEffect(() => {
    let debounceTimer = null;

    const channel = supabase
      .channel("dashboard-sos-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sos" },
        () => {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            load(range, selectedCity, selectedRegion, municipalities, { isBackground: true });
          }, 400);
        },
      )
      .subscribe();

    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, selectedCity, selectedRegion, municipalities]);

  function handleStartDateChange(value) {
    const days = diffInDays(value, range.endDate);
    if (days < MIN_RANGE_DAYS) {
      setRangeError(`O período mínimo é de ${MIN_RANGE_DAYS} dias.`);
      return;
    }
    setRangeError("");
    setRange((r) => ({ ...r, startDate: value }));
  }

  function handleEndDateChange(value) {
    const days = diffInDays(range.startDate, value);
    if (days < MIN_RANGE_DAYS) {
      setRangeError(`O período mínimo é de ${MIN_RANGE_DAYS} dias.`);
      return;
    }
    setRangeError("");
    setRange((r) => ({ ...r, endDate: value }));
  }

  const donutData = stats
    ? Object.entries(stats.statusCounts)
        .filter(([status]) => status !== 'unresolved')
        .map(([status, value]) => ({
      name: STATUS_LABELS[status],
      value,
      color: STATUS_COLORS[status],
    }))
    : [];

  const donutTotal = stats ? stats.cards.totalGeral : 0;

  return {
    range,
    rangeError,
    stats,
    loading,
    refreshing,
    today,
    donutData,
    donutTotal,
    recentes: stats?.recentes ?? [],
    getShortId,
    handleStartDateChange,
    handleEndDateChange,
    regions,
    municipalities,
    selectedRegion,
    selectedCity,
    regionName,
    setSelectedRegion,
    setSelectedCity,
  };
}