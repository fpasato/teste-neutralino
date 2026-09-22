import { useEffect, useState, useMemo } from "react";
import styles from "./styles.module.css";
import {
  getAllAttendants,
  setAttendantActive,
  getCurrentAttendant,
  deleteAttendant,
} from "../../../services/supabase/attendants";
import {
  getMunicipalitiesByRegion,
  getRegionByIbgeCode,
  getAllRegions,
} from "../../../services/supabase/municipalities";
import { AttendantForm } from "./AttendantForm";
import { RegionMap } from "../RegionMap";

import {
  HiMiniUserGroup,
  HiEllipsisVertical,
  HiPencilSquare,
} from "react-icons/hi2";
import { IoPerson } from "react-icons/io5";
import { MdCircle, MdSupervisorAccount } from "react-icons/md";

const ROLE_LABELS = {
  attendant: "Atendente",
  supervisor: "Supervisor",
  admin: "Administrador",
};

function normalize(text) {
  return (text || "").toLowerCase().replace(/[.\-/ ]/g, "");
}

export function AttendantsTab() {
  const [attendants, setAttendants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingAttendant, setEditingAttendant] = useState(null);
  const [actionError, setActionError] = useState(null);

  const [currentAttendant, setCurrentAttendant] = useState(null);
  const [region, setRegion] = useState(null);
  const [regionMunicipalities, setRegionMunicipalities] = useState([]);

  const [allRegions, setAllRegions] = useState([]);
  const [selectedRegionId, setSelectedRegionId] = useState("");
  const [selectedIbgeCode, setSelectedIbgeCode] = useState("");
  const [adminMunicipalities, setAdminMunicipalities] = useState([]);

  // { id, top, right } | null
  const [openMenu, setOpenMenu] = useState(null);

  async function loadAttendants() {
    setLoading(true);
    try {
      const data = await getAllAttendants();
      setAttendants(data);
    } catch (err) {
      console.error(err);
      setActionError("Erro ao carregar atendentes.");
    } finally {
      setLoading(false);
    }
  }

  async function loadCurrentAttendantAndRegion() {
    try {
      const me = await getCurrentAttendant();
      setCurrentAttendant(me);

      if (me.role === "supervisor" && me.ibge_code) {
        const regionData = await getRegionByIbgeCode(me.ibge_code);
        setRegion(regionData);
        setSelectedRegionId(regionData?.id ? String(regionData.id) : "");

        if (regionData?.id) {
          const municipios = await getMunicipalitiesByRegion(regionData.id);
          setRegionMunicipalities(municipios);
        }
      }
    } catch (err) {
      console.error(err);
      setActionError((prev) => prev || "Erro ao carregar dados de região.");
    }
  }

  useEffect(() => {
    loadAttendants();
    loadCurrentAttendantAndRegion();
  }, []);

  const isSupervisor = currentAttendant?.role === "supervisor";
  const isAdmin = currentAttendant?.role === "admin";

  useEffect(() => {
    if (currentAttendant?.role === "admin") {
      getAllRegions()
        .then(setAllRegions)
        .catch((err) => {
          console.error(err);
          setActionError((prev) => prev || "Erro ao carregar regiões.");
        });
    }
  }, [currentAttendant]);

  useEffect(() => {
    if (!isAdmin || !selectedRegionId) {
      setAdminMunicipalities([]);
      return;
    }
    getMunicipalitiesByRegion(Number(selectedRegionId))
      .then(setAdminMunicipalities)
      .catch((err) => {
        console.error(err);
        setActionError(
          (prev) => prev || "Erro ao carregar municípios da região."
        );
      });
  }, [isAdmin, selectedRegionId]);

  // Fecha o menu de ações ao clicar fora, rolar ou redimensionar.
  useEffect(() => {
    if (!openMenu) return;
    const close = () => setOpenMenu(null);
    const onClickOutside = (e) => {
      if (!e.target.closest("[data-actions-menu]")) close();
    };
    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [openMenu]);

  const regionIbgeCodes = useMemo(
    () => new Set(regionMunicipalities.map((m) => m.ibge_code)),
    [regionMunicipalities]
  );

  function canManage(attendant) {
    if (isAdmin) return true;
    if (isSupervisor) {
      return (
        attendant.role === "attendant" && regionIbgeCodes.has(attendant.ibge_code)
      );
    }
    return attendant.id === currentAttendant?.id;
  }

  function canDelete(attendant) {
    if (attendant.id === currentAttendant?.id) return false;
    if (isAdmin) return true;
    if (isSupervisor) {
      return (
        attendant.role === "attendant" && regionIbgeCodes.has(attendant.ibge_code)
      );
    }
    return false;
  }

  const visibleAttendants = useMemo(() => {
    if (isSupervisor) {
      return attendants.filter((a) => regionIbgeCodes.has(a.ibge_code));
    }
    return attendants;
  }, [attendants, isSupervisor, regionIbgeCodes]);

  const municipalityOptions = isSupervisor
    ? regionMunicipalities
    : adminMunicipalities;

  const filteredAttendants = useMemo(() => {
    let result = visibleAttendants;

    if (isAdmin && selectedRegionId) {
      const regionIbgeSet = new Set(adminMunicipalities.map((m) => m.ibge_code));
      result = result.filter((a) => regionIbgeSet.has(a.ibge_code));
    }

    if (selectedIbgeCode) {
      result = result.filter((a) => a.ibge_code === Number(selectedIbgeCode));
    }

    if (searchTerm.trim()) {
      const term = normalize(searchTerm);
      result = result.filter((a) => {
        const city = a.municipalities?.city || "";
        const regionName = a.municipalities?.regions?.name || "";
        return (
          normalize(a.name).includes(term) ||
          normalize(a.email).includes(term) ||
          normalize(ROLE_LABELS[a.role]).includes(term) ||
          normalize(city).includes(term) ||
          normalize(regionName).includes(term)
        );
      });
    }

    return result;
  }, [
    visibleAttendants,
    searchTerm,
    isAdmin,
    selectedRegionId,
    selectedIbgeCode,
    adminMunicipalities,
  ]);

  const mapMunicipalities = useMemo(() => {
    if (isSupervisor) return regionMunicipalities;

    const seen = new Map();
    attendants.forEach((a) => {
      if (a.municipalities && a.ibge_code && !seen.has(a.ibge_code)) {
        seen.set(a.ibge_code, {
          ibge_code: a.ibge_code,
          city: a.municipalities.city,
          uf: a.municipalities.uf,
          latitude: a.municipalities.latitude,
          longitude: a.municipalities.longitude,
        });
      }
    });
    return Array.from(seen.values());
  }, [isSupervisor, regionMunicipalities, attendants]);

  function handleOpenCreate() {
    setEditingAttendant(null);
    setFormOpen(true);
  }

  function handleOpenEdit(attendant) {
    setEditingAttendant(attendant);
    setFormOpen(true);
  }

  function handleRegionChange(e) {
    setSelectedRegionId(e.target.value);
    setSelectedIbgeCode("");
  }

  function handleMunicipalityChange(e) {
    setSelectedIbgeCode(e.target.value);
  }

  function toggleMenu(e, id) {
    e.stopPropagation();
    if (openMenu?.id === id) {
      setOpenMenu(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setOpenMenu({
      id,
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
    });
  }

  async function handleToggleActive(attendant) {
    setActionError(null);
    try {
      await setAttendantActive(attendant.id, !attendant.active);
      await loadAttendants();
    } catch (err) {
      console.error(err);
      setActionError(err.message || "Erro ao alterar status do atendente.");
    }
  }

  async function handleDelete(attendant) {
    if (
      !window.confirm(
        `Tem certeza que deseja deletar o atendente ${attendant.name}?\n\nSe ele possuir chamados no histórico, será apenas desativado para manter a integridade dos dados.`
      )
    ) {
      return;
    }

    setActionError(null);
    try {
      const res = await deleteAttendant(attendant.id);

      if (res.deactivated) {
        alert(
          `O atendente ${attendant.name} foi desativado porque possui histórico de chamados.`
        );
      } else if (res.deleted) {
        alert(`O atendente ${attendant.name} foi deletado com sucesso.`);
      } else {
        alert(res.message || "Ação concluída com sucesso.");
      }

      await loadAttendants();
    } catch (err) {
      console.error(err);
      setActionError(err.message || "Erro ao deletar atendente.");
    }
  }

  function handleFormClose(shouldReload) {
    setFormOpen(false);
    setEditingAttendant(null);
    if (shouldReload) loadAttendants();
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>
          <HiMiniUserGroup color="var(--accent)" /> Atendentes
        </h2>
        <small>Gerencie os atendentes do sistema</small>
      </div>

      <div className={styles.toolbar}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Buscar por nome, email, função, cidade ou região..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label="Filtrar atendentes"
        />

        {(isAdmin || isSupervisor) && (
          <select
            className={styles.filterSelect}
            value={selectedRegionId}
            onChange={handleRegionChange}
            disabled={isSupervisor}
            aria-label="Filtrar por região"
          >
            <option value={isSupervisor ? String(region?.id ?? "") : ""}>
              {isSupervisor ? region?.name || "Sua região" : "Todas as regiões"}
            </option>
            {isAdmin &&
              allRegions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
          </select>
        )}

        {(isAdmin || isSupervisor) && (
          <select
            className={styles.filterSelect}
            value={selectedIbgeCode}
            onChange={handleMunicipalityChange}
            disabled={isAdmin && !selectedRegionId}
            aria-label="Filtrar por município"
          >
            <option value="">Todos os municípios</option>
            {municipalityOptions.map((m) => (
              <option key={m.ibge_code} value={m.ibge_code}>
                {m.city}/{m.uf}
              </option>
            ))}
          </select>
        )}

        {(isAdmin || isSupervisor) && (
          <button className={styles.primaryButton} onClick={handleOpenCreate}>
            + Novo atendente
          </button>
        )}
      </div>

      <div className={styles.stats}>

        <div className={styles.statItem}>
          <div className={styles.statIcon}>
            <HiMiniUserGroup color="#8b5cf6" />
          </div>
          <div className={styles.statContent}>
            <span>{filteredAttendants.length}</span>
            <small>Total de funcionários</small>
          </div>
        </div>

        <div className={styles.statItem}>
          <div className={styles.statIcon}>
            <MdCircle color="var(--finished)" style={{ filter: "drop-shadow(0 0 8px var(--finished))" }} />
          </div>
          <div className={styles.statContent}>
            <span>{filteredAttendants.filter((a) => a.active).length}</span>
            <small>Funcionários ativos</small>
          </div>
        </div>

        <div className={styles.statItem}>
          <div className={styles.statIcon}>
            <MdCircle color="var(--accent)" style={{ filter: "drop-shadow(0 0 8px var(--accent))" }} />
          </div>
          <div className={styles.statContent}>
            <span>{filteredAttendants.filter((a) => !a.active).length}</span>
            <small>Funcionários desativados</small>
          </div>
        </div>

        <div className={styles.statItem}>
          <div className={styles.statIcon}>
            <MdSupervisorAccount color="var(--progress)" />
          </div>
          <div className={styles.statContent}>
            <span>{filteredAttendants.filter((a) => a.role === "supervisor").length}</span>
            <small> Supervisores</small>
          </div>
        </div>

        <div className={styles.statItem}>
          <div className={styles.statIcon}>
            <IoPerson color="var(--active)" />
          </div>
          <div className={styles.statContent}>
            <span>{filteredAttendants.filter((a) => a.role === "attendant").length}</span>
            <small>Atendentes</small>
          </div>
        </div>
      </div>

      {actionError && <p className={styles.errorMessage}>{actionError}</p>}

      <div className={styles.contentGrid}>
        <div className={styles.tableColumn}>
          {loading ? (
            <p className={styles.emptyState}>Carregando...</p>
          ) : filteredAttendants.length === 0 ? (
            <p className={styles.emptyState}>Nenhum atendente encontrado.</p>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Email</th>
                    <th>Função</th>
                    <th>Cidade / Região</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAttendants.map((attendant) => (
                    <tr key={attendant.id}>
                      <td className={styles.nameCell} title={attendant.name}>
                        {attendant.name}
                      </td>
                      <td>{attendant.email}</td>
                      <td>
                        <span
                          className={styles.roleBadge}
                          data-role={attendant.role}
                        >
                          {ROLE_LABELS[attendant.role] || attendant.role}
                        </span>
                      </td>
                      <td>
                        {attendant.municipalities
                          ? `${attendant.municipalities.city}/${attendant.municipalities.uf}`
                          : "—"}
                        {attendant.municipalities?.regions?.name
                          ? ` (${attendant.municipalities.regions.name})`
                          : ""}
                      </td>
                      <td>
                        <span
                          className={styles.statusBadge}
                          data-active={attendant.active}
                        >
                          {attendant.active ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td className={styles.actionsCell}>
                        {canManage(attendant) ? (
                          <button
                            type="button"
                            className={styles.menuTrigger}
                            data-actions-menu
                            onClick={(e) => toggleMenu(e, attendant.id)}
                            aria-label="Abrir ações"
                            aria-expanded={openMenu?.id === attendant.id}
                          >
                            <HiEllipsisVertical size={18} />
                          </button>
                        ) : (
                          <span className={styles.noAction}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Menu renderizado fora da tabela pra escapar do overflow */}
          {openMenu && (
            <div
              className={styles.menuDropdown}
              data-actions-menu
              style={{ top: openMenu.top, right: openMenu.right }}
            >
              {(() => {
                const attendant = filteredAttendants.find(
                  (a) => a.id === openMenu.id
                );
                if (!attendant) return null;
                return (
                  <>
                    <button
                      type="button"
                      className={styles.menuItem}
                      onClick={() => {
                        handleOpenEdit(attendant);
                        setOpenMenu(null);
                      }}
                    >
                      <HiPencilSquare /> Editar
                    </button>
                    <button
                      type="button"
                      className={styles.menuItem}
                      data-danger={attendant.active}
                      onClick={() => {
                        handleToggleActive(attendant);
                        setOpenMenu(null);
                      }}
                    >
                      {attendant.active ? "Desativar" : "Reativar"}
                    </button>
                    {canDelete(attendant) && (
                      <button
                        type="button"
                        className={styles.menuItem}
                        data-danger="true"
                        onClick={() => {
                          handleDelete(attendant);
                          setOpenMenu(null);
                        }}
                      >
                        Deletar
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>

        <div className={styles.mapColumn}>
          <RegionMap
            municipalities={mapMunicipalities}
            highlightRegion={isSupervisor}
            title={
              isSupervisor
                ? region?.name
                  ? `Região: ${region.name}`
                  : "Sua região"
                : "Municípios com atendentes"
            }
          />
        </div>
      </div>

      {formOpen && (
        <AttendantForm
          attendant={editingAttendant}
          onClose={handleFormClose}
          currentAttendant={currentAttendant}
          regionMunicipalities={regionMunicipalities}
        />
      )}
    </div>
  );
}