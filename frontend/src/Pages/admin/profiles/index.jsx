import styles from "./styles.module.css";
import { useEffect, useState, useMemo } from "react";
import { getAllProfiles } from "../../../services/supabase/profiles";

const STATUS_LABELS = {
  active: "Ativo",
  in_progress: "Em Andamento",
  dispatched: "Despachado",
  finished: "Finalizado",
  cancelled: "Cancelado",
  unresolved: "Não Resolvido",
};

const STATUS_COLORS = {
  active: "#f87171",
  in_progress: "#fbbf24",
  dispatched: "#3b82f6",
  finished: "#4ade80",
  cancelled: "#94a3b8",
  unresolved: "#f97316",
};

/* Status que contam como "SOS em andamento" */
const ACTIVE_SOS_STATUSES = ["active", "in_progress", "dispatched"];

function formatCpf(cpf) {
  if (!cpf) return "—";
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function formatBirthDate(birthDate) {
  if (!birthDate) return "—";
  const [year, month, day] = birthDate.split("-");
  return `${day}/${month}/${year}`;
}

function normalize(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[.\-/ ]/g, "");
}

export function UsersTable() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  useEffect(() => {
    async function loadProfiles() {
      try {
        const data = await getAllProfiles();
        setProfiles(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadProfiles();
  }, []);

  /* -------- estatísticas dos cards -------- */
  const stats = useMemo(() => {
    const total = profiles.length;
    const withActiveSos = profiles.filter((p) =>
      ACTIVE_SOS_STATUSES.includes(p.lastSos?.status)
    ).length;
    const neverTriggered = profiles.filter((p) => !p.sosCount).length;
    const unresolved = profiles.filter(
      (p) => p.lastSos?.status === "unresolved"
    ).length;
    return { total, withActiveSos, neverTriggered, unresolved };
  }, [profiles]);

  /* -------- filtro por status + busca -------- */
  const filteredProfiles = useMemo(() => {
    let result = profiles;

    if (statusFilter === "active") {
      result = result.filter((p) =>
        ACTIVE_SOS_STATUSES.includes(p.lastSos?.status)
      );
    } else if (statusFilter === "none") {
      result = result.filter((p) => !p.sosCount);
    } else if (statusFilter === "unresolved") {
      result = result.filter((p) => p.lastSos?.status === "unresolved");
    }

    if (!searchTerm.trim()) return result;
    const term = normalize(searchTerm);

    return result.filter((profile) => {
      const nameNormalized = normalize(profile.name);
      const cpfRaw = normalize(profile.cpf);
      const cpfFormatted = normalize(formatCpf(profile.cpf));
      const phoneNormalized = normalize(profile.phone);
      const birthRaw = normalize(profile.birth_date);
      const birthFormatted = normalize(formatBirthDate(profile.birth_date));
      const emailNormalized = profile.email ? normalize(profile.email) : "";

      return (
        nameNormalized.includes(term) ||
        cpfRaw.includes(term) ||
        cpfFormatted.includes(term) ||
        phoneNormalized.includes(term) ||
        birthRaw.includes(term) ||
        birthFormatted.includes(term) ||
        emailNormalized.includes(term)
      );
    });
  }, [profiles, searchTerm, statusFilter]);

  /* -------- ordenação -------- */
  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const sortedProfiles = useMemo(() => {
    if (!sortConfig.key) return filteredProfiles;

    const sorted = [...filteredProfiles].sort((a, b) => {
      let valA, valB;

      switch (sortConfig.key) {
        case "name":
          valA = normalize(a.name);
          valB = normalize(b.name);
          break;
        case "cpf":
          valA = (a.cpf || "").replace(/\D/g, "");
          valB = (b.cpf || "").replace(/\D/g, "");
          break;
        case "birth_date":
          valA = a.birth_date || "";
          valB = b.birth_date || "";
          break;
        case "phone":
          valA = (a.phone || "").replace(/\D/g, "");
          valB = (b.phone || "").replace(/\D/g, "");
          break;
        case "email":
          valA = normalize(a.email || "");
          valB = normalize(b.email || "");
          break;
        case "sosCount":
          valA = a.sosCount ?? 0;
          valB = b.sosCount ?? 0;
          break;
        case "lastSos":
          valA = a.lastSos?.created_at
            ? new Date(a.lastSos.created_at).getTime()
            : 0;
          valB = b.lastSos?.created_at
            ? new Date(b.lastSos.created_at).getTime()
            : 0;
          break;
        case "created_at":
          valA = a.created_at ? new Date(a.created_at).getTime() : 0;
          valB = b.created_at ? new Date(b.created_at).getTime() : 0;
          break;
        default:
          return 0;
      }

      if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
      if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [filteredProfiles, sortConfig]);

  const renderSortIcon = (key) =>
    sortConfig.key === key ? (sortConfig.direction === "asc" ? " ▲" : " ▼") : "";

  /* -------- chips -------- */
  const chips = [
    { key: "all", label: "Todos" },
    { key: "active", label: "SOS Ativo" },
    { key: "unresolved", label: "Não Resolvido" },
    { key: "none", label: "Sem SOS" },
  ];

  const hasActiveFilters = statusFilter !== "all" || searchTerm.trim() !== "";

  return (
    <div className={styles.container}>
      {/* -------- Cards de estatística -------- */}
      <div className={styles.statsCards}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total de Usuários</span>
          <span className={styles.statValue}>{stats.total}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Com SOS Ativo</span>
          <span className={styles.statValue}>{stats.withActiveSos}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Nunca Acionaram</span>
          <span className={styles.statValue}>{stats.neverTriggered}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Não Resolvidos</span>
          <span className={styles.statValue}>{stats.unresolved}</span>
        </div>
      </div>

      {/* -------- Toolbar: busca + chips -------- */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Buscar por nome, CPF, email, data ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Filtrar usuários"
          />
        </div>

        <div className={styles.filterChips}>
          {chips.map((chip) => (
            <button
              key={chip.key}
              className={
                statusFilter === chip.key ? styles.chipActive : styles.chip
              }
              onClick={() => setStatusFilter(chip.key)}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* -------- Tabela -------- */}
      {loading ? (
        <p className={styles.emptyState}>Carregando usuários...</p>
      ) : sortedProfiles.length === 0 ? (
        <p className={styles.emptyState}>
          {hasActiveFilters
            ? "Nenhum usuário encontrado para os filtros aplicados."
            : "Nenhum usuário cadastrado."}
        </p>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th
                  className={styles.sortable}
                  onClick={() => handleSort("name")}
                >
                  Nome{renderSortIcon("name")}
                </th>
                <th
                  className={styles.sortable}
                  onClick={() => handleSort("cpf")}
                >
                  CPF{renderSortIcon("cpf")}
                </th>
                <th
                  className={styles.sortable}
                  onClick={() => handleSort("birth_date")}
                >
                  Nascimento{renderSortIcon("birth_date")}
                </th>
                <th
                  className={styles.sortable}
                  onClick={() => handleSort("phone")}
                >
                  Telefone{renderSortIcon("phone")}
                </th>
                <th
                  className={styles.sortable}
                  onClick={() => handleSort("email")}
                >
                  Email{renderSortIcon("email")}
                </th>
                <th
                  className={styles.sortable}
                  onClick={() => handleSort("sosCount")}
                >
                  SOS{renderSortIcon("sosCount")}
                </th>
                <th
                  className={styles.sortable}
                  onClick={() => handleSort("lastSos")}
                >
                  Último SOS{renderSortIcon("lastSos")}
                </th>
                <th
                  className={styles.sortable}
                  onClick={() => handleSort("created_at")}
                >
                  Cadastrado em{renderSortIcon("created_at")}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedProfiles.map((profile) => (
                <tr key={profile.id}>
                  <td className={styles.nameCell}>{profile.name}</td>
                  <td>{formatCpf(profile.cpf)}</td>
                  <td>{formatBirthDate(profile.birth_date)}</td>
                  <td>{profile.phone || "—"}</td>
                  <td className={styles.emailCell}>{profile.email || "—"}</td>
                  <td className={styles.sosCell}>{profile.sosCount ?? 0}</td>
                  <td>
                    {profile.lastSos ? (
                      <div className={styles.lastSosCell}>
                        <span
                          className={styles.statusBadge}
                          style={{
                            background: `${
                              STATUS_COLORS[profile.lastSos.status] ?? "#64748b"
                            }22`,
                            color:
                              STATUS_COLORS[profile.lastSos.status] ?? "#94a3b8",
                            borderColor: `${
                              STATUS_COLORS[profile.lastSos.status] ?? "#64748b"
                            }55`,
                          }}
                        >
                          {STATUS_LABELS[profile.lastSos.status] ||
                            profile.lastSos.status}
                        </span>
                        <span className={styles.lastSosMeta}>
                          {profile.lastSos.city
                            ? `${profile.lastSos.city} · `
                            : ""}
                          {new Date(
                            profile.lastSos.created_at
                          ).toLocaleDateString()}
                        </span>
                      </div>
                    ) : (
                      <span className={styles.emptyBadge}>—</span>
                    )}
                  </td>
                  <td>
                    {profile.created_at
                      ? new Date(profile.created_at).toLocaleDateString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}