import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";

import styles from "./styles.module.css";
import { SosContent } from "./components/SosContent";
import { SosFilter } from "./components/SosFilter";


import { usePersistedState } from "../../../hooks/usePersistedState";
import { useAuth } from "../../../contexts/AuthContext";
import {
  getAllRegions,
  getMunicipalitiesByRegion,
  getRegionByIbgeCode,
} from "../../../services/supabase/municipalities";

function getTodayISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function Home() {
  const { attendant } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tab, setTab] = useState("all");
  const [selectedStatuses, setSelectedStatuses] = usePersistedState(
    "sosFilter_statuses",
    [],
  );
  const [startDate, setStartDate] = usePersistedState(
    "sosFilter_startDate",
    getTodayISO(),
  );
  const [endDate, setEndDate] = usePersistedState(
    "sosFilter_endDate",
    getTodayISO(),
  );
  const [sortBy, setSortBy] = usePersistedState("sosFilter_sortBy", "recent");
  const [viewMode, setViewMode] = usePersistedState(
    "sosFilter_viewMode",
    "grid",
  );

  // ---- filtro geografico ----
  const [regions, setRegions] = useState([]);
  const [municipalities, setMunicipalities] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState(
    searchParams.get("region") || "",
  );
  const [selectedCity, setSelectedCity] = useState(
    searchParams.get("city") || "",
  );
  const [regionName, setRegionName] = useState("");

  const isAdmin = attendant?.role === "admin";
  const isSupervisor = attendant?.role === "supervisor";

  useEffect(() => {
    if (!isAdmin) return;
    async function loadRegions() {
      try {
        const data = await getAllRegions();
        setRegions(data);
      } catch (err) {
        console.error("Erro ao carregar regiões:", err);
      }
    }
    loadRegions();
  }, [isAdmin]);

  useEffect(() => {
    if (!isSupervisor || !attendant?.ibge_code) return;
    async function loadSupervisorRegion() {
      try {
        const region = await getRegionByIbgeCode(attendant.ibge_code);
        if (region) {
          setRegionName(region.name);
          setSelectedRegion(region.id);
        }
      } catch (err) {
        console.error("Erro ao carregar região do supervisor:", err);
      }
    }
    loadSupervisorRegion();
  }, [isSupervisor, attendant]);

  useEffect(() => {
    if (!selectedRegion) {
      setMunicipalities([]);
      return;
    }
    async function loadMunicipalities() {
      try {
        const data = await getMunicipalitiesByRegion(selectedRegion);
        setMunicipalities(data);
        if (selectedCity && !data.some((c) => c.ibge_code === selectedCity)) {
          setSelectedCity("");
        }
      } catch (err) {
        console.error("Erro ao carregar municípios:", err);
      }
    }
    loadMunicipalities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRegion]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (selectedRegion) params.set("region", selectedRegion);
    else params.delete("region");
    if (selectedCity) params.set("city", selectedCity);
    else params.delete("city");
    setSearchParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRegion, selectedCity]);

  function handleRegionChange(value) {
    if (isSupervisor) return;
    setSelectedRegion(value);
    setSelectedCity("");
  }

  function handleCityChange(value) {
    setSelectedCity(value);
  }

  function handleClearFilters() {
    setSelectedStatuses([]);
    setStartDate(getTodayISO());
    setEndDate(getTodayISO());
    setSortBy("recent");
  }

  let geoFilter = {};
  if (selectedCity) {
    geoFilter = { ibgeCode: selectedCity };
  } else if (selectedRegion && municipalities.length > 0) {
    geoFilter = { ibgeCodes: municipalities.map((m) => m.ibge_code) };
  }

  const tabConfig = {
    all: {
      statuses: selectedStatuses,
      attendantId: null,
    },
    in_progress: {
      statuses: ["in_progress"],
      attendantId: attendant?.id ?? null,
    },
    finished: {
      statuses: ["finished"],
      attendantId: attendant?.id ?? null,
    },
  };

  const activeConfig = tabConfig[tab];

  return (
    <div className={styles.container}>

      <div className={styles.content}>
        <div className={styles.filterBar}>
          <SosFilter
            tab={tab}
            selectedStatuses={selectedStatuses}
            onStatusesChange={setSelectedStatuses}
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            sortBy={sortBy}
            onSortByChange={setSortBy}
            onClearFilters={handleClearFilters}
            attendant={attendant}
            regions={regions}
            municipalities={municipalities}
            selectedRegion={selectedRegion}
            selectedCity={selectedCity}
            regionName={regionName}
            onRegionChange={handleRegionChange}
            onCityChange={handleCityChange}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
        </div>

        <div className={styles.tabs}>
          <button
            type="button"
            className={tab === "all" ? styles.tabActive : ""}
            onClick={() => setTab("all")}
          >
            Todas
          </button>
          <button
            type="button"
            className={tab === "in_progress" ? styles.tabActive : ""}
            onClick={() => setTab("in_progress")}
          >
            Atendendo
          </button>
          <button
            type="button"
            className={tab === "finished" ? styles.tabActive : ""}
            onClick={() => setTab("finished")}
          >
            Encerradas
          </button>
        </div>

        <div className={styles.contentBody}>
          <SosContent
            selectedStatuses={activeConfig.statuses}
            startDate={startDate}
            endDate={endDate}
            sortBy={sortBy}
            attendantId={activeConfig.attendantId}
            viewMode={viewMode}
            {...geoFilter}
          />
        </div>
      </div>
    </div>
  );
}