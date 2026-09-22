import { useEffect, useMemo, useState, useCallback } from "react";
import {
  getAllSos,
  subscribeToSos,
  removeAttendantFromSos,
} from "../../../services/supabase/sos";
import { supabase } from "../../../services/supabase/client";
import {
  getAllRegions,
  getMunicipalitiesByRegion,
} from "../../../services/supabase/municipalities";
import AssignAttendantModal from "./AssignAttendantModal";
import OccurrenceDetails from "./OccurrenceDetails";
import {
  STATUS_LABELS,
  shortId,
  formatDateTime,
  diffToHuman,
} from "../../../utils/occurrenceFormat";
import styles from "./styles.module.css";

const STATUS_CLASS = {
  active: styles.statusActive,
  in_progress: styles.statusInProgress,
  finished: styles.statusFinished,
  cancelled: styles.statusCancelled,
  unresolved: styles.statusUnresolved,
};

const SORT_OPTIONS = {
  created_desc: "Mais recentes primeiro",
  created_asc: "Mais antigos primeiro",
  status: "Status",
};

const DEFAULT_FILTERS = {
  dateStart: "",
  dateEnd: "",
  regionId: "",
  ibgeCode: "",
  sort: "created_desc",
};

export function OccurrencesTab() {
  const [occurrences, setOccurrences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [assignTarget, setAssignTarget] = useState(null);

  // Ocorrência destacada no painel lateral (resumo) x ocorrência aberta (página)
  const [selectedId, setSelectedId] = useState(null);
  const [openId, setOpenId] = useState(null);

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [allRegions, setAllRegions] = useState([]);
  const [regionMunicipalities, setRegionMunicipalities] = useState([]);

  const loadOccurrences = useCallback(async () => {
    try {
      setError(null);
      const data = await getAllSos();
      setOccurrences(data);
    } catch (err) {
      setError(err.message || "Não foi possível carregar as ocorrências.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOccurrences();
    const channel = subscribeToSos(() => loadOccurrences());
    return () => supabase.removeChannel(channel);
  }, [loadOccurrences]);

  useEffect(() => {
    getAllRegions().then(setAllRegions).catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    if (!filters.regionId) {
      setRegionMunicipalities([]);
      return;
    }
    getMunicipalitiesByRegion(Number(filters.regionId))
      .then(setRegionMunicipalities)
      .catch((err) => console.error(err));
  }, [filters.regionId]);

  function handleFilterChange(field, value) {
    setFilters((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "regionId") next.ibgeCode = ""; // reseta cidade ao trocar região
      return next;
    });
  }

  function handleClearFilters() {
    setFilters(DEFAULT_FILTERS);
    setSearch("");
    setStatusFilter("all");
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let result = occurrences.filter((occ) => {
      if (statusFilter !== "all" && occ.status !== statusFilter) return false;

      if (filters.dateStart) {
        const start = new Date(filters.dateStart + "T00:00:00");
        if (new Date(occ.created_at) < start) return false;
      }
      if (filters.dateEnd) {
        const end = new Date(filters.dateEnd + "T23:59:59");
        if (new Date(occ.created_at) > end) return false;
      }

      if (filters.regionId) {
        const regionIbgeSet = new Set(regionMunicipalities.map((m) => m.ibge_code));
        if (!regionIbgeSet.has(occ.ibge_code)) return false;
      }

      if (filters.ibgeCode && occ.ibge_code !== Number(filters.ibgeCode)) return false;

      if (!term) return true;
      const requesterName = occ.profiles?.name?.toLowerCase() || "";
      const attendantName = occ.attendants?.name?.toLowerCase() || "";
      const city = occ.city?.toLowerCase() || "";
      return (
        requesterName.includes(term) ||
        attendantName.includes(term) ||
        city.includes(term) ||
        occ.id.toLowerCase().includes(term)
      );
    });

    result = [...result].sort((a, b) => {
      if (filters.sort === "created_asc") {
        return new Date(a.created_at) - new Date(b.created_at);
      }
      if (filters.sort === "status") {
        return (a.status || "").localeCompare(b.status || "");
      }
      return new Date(b.created_at) - new Date(a.created_at);
    });

    return result;
  }, [occurrences, search, statusFilter, filters, regionMunicipalities]);

  const selectedOccurrence = useMemo(
    () => occurrences.find((o) => o.id === selectedId) || null,
    [occurrences, selectedId]
  );

  useEffect(() => {
    if (selectedId && !occurrences.some((o) => o.id === selectedId)) {
      setSelectedId(null);
    }
  }, [occurrences, selectedId]);

  async function handleRemoveAttendant(occurrence) {
    if (!window.confirm("Remover o atendente desta ocorrência?")) return;
    try {
      await removeAttendantFromSos(occurrence.id);
      await loadOccurrences();
    } catch (err) {
      setError(err.message || "Não foi possível remover o atendente.");
    }
  }

  async function handleModalSuccess() {
    setAssignTarget(null);
    await loadOccurrences();
  }

  // -------- Página de detalhes --------
  if (openId) {
    return (
      <>
        <OccurrenceDetails
          sosId={openId}
          onBack={() => {
            setOpenId(null);
            loadOccurrences();
          }}
          onAssign={(occ) => setAssignTarget(occ)}
          onRemoveAttendant={handleRemoveAttendant}
        />
        {assignTarget && (
          <AssignAttendantModal
            occurrence={assignTarget}
            onClose={() => setAssignTarget(null)}
            onSuccess={handleModalSuccess}
          />
        )}
      </>
    );
  }

  if (loading) {
    return <div className={styles.emptyState}>Carregando ocorrências...</div>;
  }

  return (
    <div className={styles.container}>
      {/* -------- Filtros -------- */}
      <div className={styles.filtersBar}>
        <input
          type="text"
          placeholder="Buscar por solicitante, atendente, cidade ou ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={styles.searchInput}
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={styles.statusSelect}
        >
          <option value="all">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <input
          type="date"
          className={styles.dateInput}
          value={filters.dateStart}
          onChange={(e) => handleFilterChange("dateStart", e.target.value)}
          aria-label="Data inicial"
        />
        <input
          type="date"
          className={styles.dateInput}
          value={filters.dateEnd}
          onChange={(e) => handleFilterChange("dateEnd", e.target.value)}
          aria-label="Data final"
        />

        <select
          className={styles.filterSelect}
          value={filters.regionId}
          onChange={(e) => handleFilterChange("regionId", e.target.value)}
          aria-label="Filtrar por região"
        >
          <option value="">Todas as regiões</option>
          {allRegions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>

        <select
          className={styles.filterSelect}
          value={filters.ibgeCode}
          onChange={(e) => handleFilterChange("ibgeCode", e.target.value)}
          disabled={!filters.regionId}
          aria-label="Filtrar por cidade"
        >
          <option value="">Todas as cidades</option>
          {regionMunicipalities.map((m) => (
            <option key={m.ibge_code} value={m.ibge_code}>
              {m.city}/{m.uf}
            </option>
          ))}
        </select>

        <select
          className={styles.filterSelect}
          value={filters.sort}
          onChange={(e) => handleFilterChange("sort", e.target.value)}
          aria-label="Ordenar"
        >
          {Object.entries(SORT_OPTIONS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <button className={styles.clearFiltersButton} onClick={handleClearFilters}>
          Limpar filtros
        </button>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      {/* -------- Grid 70/20 -------- */}
      <div className={styles.occurrencesGrid}>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Status</th>
                <th>Solicitante</th>
                <th>Município/UF</th>
                <th>Atendente</th>
                <th>Criado em</th>
                <th>Despachado em</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className={styles.emptyRow}>
                    Nenhuma ocorrência encontrada. Ajuste os filtros para ver mais.
                  </td>
                </tr>
              )}

              {filtered.map((occ) => (
                <tr
                  key={occ.id}
                  className={occ.id === selectedId ? styles.rowSelected : ""}
                  onClick={() => setSelectedId(occ.id)}
                  onDoubleClick={() => setOpenId(occ.id)}
                  title="Clique para ver o resumo, duplo clique para abrir"
                >
                  <td>
                    <span className={`${styles.badge} ${STATUS_CLASS[occ.status] || ""}`}>
                      {STATUS_LABELS[occ.status] || occ.status}
                    </span>
                  </td>
                  <td>{occ.profiles?.name || "-"}</td>
                  <td>{occ.city ? `${occ.city}/${occ.uf || ""}` : "-"}</td>
                  <td>
                    {occ.attendants?.name || (
                      <span className={styles.unassigned}>Não atribuído</span>
                    )}
                  </td>
                  <td>{formatDateTime(occ.created_at)}</td>
                  <td>{formatDateTime(occ.dispatched_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* -------- Resumo (20%) -------- */}
        <aside className={styles.infoPanel}>
          {!selectedOccurrence ? (
            <div className={styles.infoPlaceholder}>
              Selecione uma ocorrência para ver o resumo.
            </div>
          ) : (
            <div className={styles.infoContent}>
              <div className={styles.infoHeader}>
                <span
                  className={`${styles.badge} ${STATUS_CLASS[selectedOccurrence.status] || ""}`}
                >
                  {STATUS_LABELS[selectedOccurrence.status] || selectedOccurrence.status}
                </span>
                <small className={styles.infoId}>{shortId(selectedOccurrence.id)}</small>
              </div>

              <dl className={styles.infoList}>
                <dt>Solicitante</dt>
                <dd>{selectedOccurrence.profiles?.name || "-"}</dd>

                <dt>Cidade/UF</dt>
                <dd>
                  {selectedOccurrence.city
                    ? `${selectedOccurrence.city}/${selectedOccurrence.uf || ""}`
                    : "-"}
                </dd>

                <dt>Atendente</dt>
                <dd>
                  {selectedOccurrence.attendants?.name || (
                    <span className={styles.unassigned}>Não atribuído</span>
                  )}
                </dd>

                <dt>Criado em</dt>
                <dd>{formatDateTime(selectedOccurrence.created_at)}</dd>

                <dt>Tempo total</dt>
                <dd>
                  {diffToHuman(
                    selectedOccurrence.created_at,
                    selectedOccurrence.closed_at || new Date().toISOString()
                  )}
                </dd>
              </dl>

              <button
                className={styles.actionButton}
                onClick={() => setOpenId(selectedOccurrence.id)}
              >
                Abrir ocorrência
              </button>
            </div>
          )}
        </aside>
      </div>

      {assignTarget && (
        <AssignAttendantModal
          occurrence={assignTarget}
          onClose={() => setAssignTarget(null)}
          onSuccess={handleModalSuccess}
        />
      )}
    </div>
  );
}