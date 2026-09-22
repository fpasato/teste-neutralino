import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { HiOutlineViewGrid, HiOutlineViewList } from "react-icons/hi";
import styles from "./styles.module.css";

const STATUS_OPTIONS = [
  { value: "active", label: "Ativos" },
  { value: "in_progress", label: "Em andamento" },
  { value: "finished", label: "Finalizados" },
  { value: "cancelled", label: "Cancelados" },
];

const SORT_OPTIONS = [
  { value: "recent", label: "Mais recentes" },
  { value: "oldest", label: "Mais antigos" },
  { value: "longest_wait", label: "Maior tempo de espera" },
];

function toLocalISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromLocalISODate(isoString) {
  const [year, month, day] = isoString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function SosFilter({
  tab = "all",
  selectedStatuses = [],
  onStatusesChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  searchTerm = "",
  sortBy = "recent",
  onSortByChange,
  onClearFilters,
  attendant,
  regions = [],
  municipalities = [],
  selectedRegion = "",
  selectedCity = "",
  regionName = "",
  onRegionChange,
  onCityChange,
  viewMode = "grid",
  onViewModeChange,
}) {
  const showStatusFilter = tab === "all";

  const allStatusValues = STATUS_OPTIONS.map((opt) => opt.value);
  const allSelected =
    allStatusValues.length > 0 &&
    allStatusValues.every((v) => selectedStatuses.includes(v));

  const activeFilterCount =
    (showStatusFilter ? selectedStatuses.length : 0) +
    (startDate ? 1 : 0) +
    (endDate ? 1 : 0) +
    (searchTerm ? 1 : 0) +
    (selectedRegion ? 1 : 0) +
    (selectedCity ? 1 : 0);

  function toggleStatus(statusValue) {
    if (selectedStatuses.includes(statusValue)) {
      onStatusesChange(selectedStatuses.filter((s) => s !== statusValue));
    } else {
      onStatusesChange([...selectedStatuses, statusValue]);
    }
  }

  function toggleAll() {
    onStatusesChange(allSelected ? [] : [...allStatusValues]);
  }

  function handleClearFilters() {
    if (attendant?.role !== "supervisor") {
      onRegionChange?.("");
    }
    onCityChange?.("");
    onClearFilters();
  }

  const isSupervisor = attendant?.role === "supervisor";
  const isAdmin = attendant?.role === "admin";
  const showGeoFilter = isSupervisor || isAdmin;

  return (
    <div className={styles.container}>
      <div className={styles.body}>
        <div className={styles.filterHeader}>
          <h3>Filtros</h3>
          <span className={styles.headerCount}>{activeFilterCount}</span>
        </div>

        {showStatusFilter && (
          <div className={`${styles.section} ${styles.sectionStatus}`}>
            <span className={styles.sectionLabel}>Status</span>
            <div className={styles.statusGrid}>
              <button
                type="button"
                className={`${styles.statusChip} ${allSelected ? styles.chipActive : ""}`}
                onClick={toggleAll}
              >
                Todos
              </button>
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`${styles.statusChip} ${
                    selectedStatuses.includes(option.value)
                      ? styles.chipActive
                      : ""
                  }`}
                  onClick={() => toggleStatus(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={`${styles.section} ${styles.sectionPeriod}`}>
          <span className={styles.sectionLabel}>Período</span>
          <div className={styles.dateGroup}>
            <div className={styles.dateField}>
              <label className={styles.dateLabel}>De</label>
              <DatePicker
                selected={startDate ? fromLocalISODate(startDate) : null}
                onChange={(date) =>
                  onStartDateChange(date ? toLocalISODate(date) : null)
                }
                dateFormat="dd/MM/yyyy"
                placeholderText="Selecionar"
                className={styles.dateInput}
                maxDate={new Date()}
              />
            </div>

            <div className={styles.dateField}>
              <label className={styles.dateLabel}>Até</label>
              <DatePicker
                selected={endDate ? fromLocalISODate(endDate) : null}
                onChange={(date) =>
                  onEndDateChange(date ? toLocalISODate(date) : null)
                }
                dateFormat="dd/MM/yyyy"
                placeholderText="Selecionar"
                className={styles.dateInput}
                minDate={startDate ? fromLocalISODate(startDate) : null}
              />
            </div>
          </div>
        </div>

        {showGeoFilter && (
          <>
            <div className={`${styles.section} ${styles.sectionRegion}`}>
              <span className={styles.sectionLabel}>Região</span>
              {isAdmin ? (
                <select
                  className={styles.selectInput}
                  value={selectedRegion}
                  onChange={(e) => onRegionChange?.(e.target.value)}
                >
                  <option value="">Todas</option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  className={styles.dateInput}
                  value={regionName || "Carregando..."}
                  disabled
                />
              )}
            </div>

            <div className={`${styles.section} ${styles.sectionCity}`}>
              <span className={styles.sectionLabel}>Cidade</span>
              <select
                className={styles.selectInput}
                value={selectedCity}
                onChange={(e) => onCityChange?.(e.target.value)}
                disabled={!selectedRegion}
              >
                <option value="">Todas</option>
                {municipalities.map((m) => (
                  <option key={m.ibge_code} value={m.ibge_code}>
                    {m.city}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        <div className={`${styles.section} ${styles.sectionSort}`}>
          <label className={styles.sectionLabel} htmlFor="sos-sort">
            Ordenar
          </label>
          <select
            id="sos-sort"
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value)}
            className={styles.selectInput}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className={`${styles.section} ${styles.sectionView}`}>
          <span className={styles.sectionLabel}>Visualização</span>
          <div className={styles.viewToggle}>
            <button
              type="button"
              className={`${styles.viewButton} ${viewMode === "grid" ? styles.viewActive : ""}`}
              onClick={() => onViewModeChange?.("grid")}
              title="Visualizar em cards"
            >
              <HiOutlineViewGrid />
            </button>
            <button
              type="button"
              className={`${styles.viewButton} ${viewMode === "list" ? styles.viewActive : ""}`}
              onClick={() => onViewModeChange?.("list")}
              title="Visualizar em lista"
            >
              <HiOutlineViewList />
            </button>
          </div>
        </div>

        {activeFilterCount > 0 && (
          <div className={`${styles.section} ${styles.sectionClear}`}>
            <span className={styles.sectionLabel}>&nbsp;</span>
            <button
              type="button"
              className={styles.clearButton}
              onClick={handleClearFilters}
            >
              Limpar
              <span className={styles.filterCount}>{activeFilterCount}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}