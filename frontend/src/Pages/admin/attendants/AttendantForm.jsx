import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import styles from "./formStyles.module.css";
import { createAttendant, updateAttendant, updateAttendantEmail, updateAttendantPassword } from "../../../services/supabase/attendants";
import { supabase } from "../../../services/supabase/client";

/* ---------- utilitários ---------- */
function normalize(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/* ---------- constantes ---------- */
const ROLE_OPTIONS = [
  { value: "attendant", label: "Atendente" },
  { value: "supervisor", label: "Supervisor" },
  { value: "admin", label: "Administrador" },
];

/* ---------- hook: carregamento de municípios ---------- */
function useMunicipalities(isSupervisor, regionMunicipalities) {
  const [municipalities, setMunicipalities] = useState([]);
  const [loading, setLoading] = useState(!isSupervisor);

  useEffect(() => {
    if (isSupervisor) {
      setMunicipalities(regionMunicipalities);
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function loadAll() {
      setLoading(true);
      let all = [];
      let from = 0;
      const pageSize = 1000;

      try {
        while (true) {
          const { data, error } = await supabase
            .from("municipalities")
            .select("ibge_code, city, uf")
            .order("city", { ascending: true })
            .range(from, from + pageSize - 1);

          if (error || !data) break;
          all = all.concat(data);
          if (data.length < pageSize) break;
          from += pageSize;
        }
      } catch (err) {
        console.error(err);
      }

      if (!cancelled) {
        setMunicipalities(all);
        setLoading(false);
      }
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [isSupervisor, regionMunicipalities]);

  return { municipalities, loading };
}

/* ---------- AttendantForm ---------- */
export function AttendantForm({
  attendant,
  onClose,
  currentAttendant,
  regionMunicipalities = [],
}) {
  const isEditing = Boolean(attendant);
  const isSupervisor = currentAttendant?.role === "supervisor";

  const roleOptions = isSupervisor
    ? ROLE_OPTIONS.filter((opt) => opt.value === "attendant")
    : ROLE_OPTIONS;

  // Dados do município já selecionado (para edição) em formato display
  const initialCityDisplay = attendant?.municipalities
    ? `${attendant.municipalities.city}/${attendant.municipalities.uf}`
    : "";

  // Estado do formulário
  const [name, setName] = useState(attendant?.name || "");
  const [email, setEmail] = useState(attendant?.email || "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(
    attendant?.role || (isSupervisor ? "attendant" : "attendant")
  );
  const [ibgeCode, setIbgeCode] = useState(attendant?.ibge_code || "");
  const [municipalitySearch, setMunicipalitySearch] = useState(initialCityDisplay);
  const [municipalityListOpen, setMunicipalityListOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);
  const [emailError, setEmailError] = useState(null);
  const originalEmail = attendant?.email || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");


  // Carrega municípios via hook
  const { municipalities, loading: municipalitiesLoading } = useMunicipalities(
    isSupervisor,
    regionMunicipalities
  );

  // Input referência para posicionar o portal
  const inputRef = useRef(null);

  // Filtro de municípios
  const filteredMunicipalities = useMemo(() => {
    const term = normalize(municipalitySearch);
    if (!term) return municipalities.slice(0, 50);
    return municipalities
      .filter((m) => normalize(`${m.city} ${m.uf}`).includes(term))
      .slice(0, 50);
  }, [municipalities, municipalitySearch]);

  // Handlers
  const handleSelectMunicipality = useCallback((m) => {
    setIbgeCode(m.ibge_code);
    setMunicipalitySearch(`${m.city}/${m.uf}`);
    setMunicipalityListOpen(false);
  }, []);

  const handleClearMunicipality = useCallback(() => {
    setMunicipalitySearch("");
    setIbgeCode("");
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (isSupervisor && role !== "attendant") {
      setError("Supervisores só podem cadastrar atendentes com função 'Atendente'.");
      return;
    }
    if (isSupervisor && !ibgeCode) {
      setError("Selecione um município da sua região.");
      return;
    }

    // Validação da troca de senha (se preenchida)
    if (isEditing && newPassword) {
      if (newPassword.length < 6) {
        setError("A nova senha deve ter pelo menos 6 caracteres.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setError("As senhas não conferem.");
        return;
      }
    }

    setSubmitting(true);
    try {
      if (isEditing) {
        if (email !== attendant.email) {
          await updateAttendantEmail(attendant.id, email);
        }
        if (newPassword) {
          await updateAttendantPassword(attendant.id, newPassword);
        }
        await updateAttendant(attendant.id, {
          name,
          role,
          ibge_code: ibgeCode || null,
        });
      } else {
        if (!password || password.length < 6) {
          throw new Error("A senha deve ter pelo menos 6 caracteres.");
        }
        await createAttendant({
          name,
          email,
          password,
          role,
          ibge_code: ibgeCode || null,
        });
      }
      onClose(true);
    } catch (err) {
      console.error(err);
      setError(err.message || "Erro ao salvar atendente.");
    } finally {
      setSubmitting(false);
    }
  };

  /* -------- Portal da lista de municípios -------- */
  const renderPortalList = () => {
    if (!municipalityListOpen || !inputRef.current) return null;

    const rect = inputRef.current.getBoundingClientRect();
    const listStyle = {
      position: "fixed",
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    };

    const listContent =
      filteredMunicipalities.length > 0 ? (
        filteredMunicipalities.map((m) => (
          <li key={m.ibge_code}>
            <button type="button" onClick={() => handleSelectMunicipality(m)}>
              {m.city}/{m.uf}
            </button>
          </li>
        ))
      ) : (
        <li className={styles.comboboxEmpty}>
          {isSupervisor
            ? "Nenhum município da sua região encontrado."
            : "Nenhum município encontrado."}
        </li>
      );

    return createPortal(
      <ul className={styles.comboboxListPortal} style={listStyle}>
        {listContent}
      </ul>,
      document.body
    );
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.title}>
            {isEditing ? "Editar atendente" : "Novo atendente"}
          </h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={() => onClose(false)}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        {isSupervisor && !isEditing && (
          <p className={styles.hint}>
            Como supervisor, você só pode cadastrar atendentes nos municípios da sua região.
          </p>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>

          {/* Nome */}
          <label className={styles.field}>
            <span>Nome</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              required
            />
          </label>

          {/* Email */}
          <label className={styles.field}>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {isEditing && (
              <small className={styles.hint}>
                Alterar o email aqui também atualiza o login do atendente.
              </small>
            )}
          </label>

          {/* Nova senha (apenas edição, opcional) */}
          {isEditing && (
            <>
              <label className={styles.field}>
                <span>Nova senha (deixe em branco para não alterar)</span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={6}
                  placeholder="••••••"
                />
              </label>

              {newPassword && (
                <label className={styles.field}>
                  <span>Confirmar nova senha</span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={6}
                    placeholder="••••••"
                  />
                </label>
              )}
            </>
          )}

          {/* Senha (apenas novo) */}
          {!isEditing && (
            <label className={styles.field}>
              <span>Senha inicial</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </label>
          )}

          {/* Função */}
          <label className={styles.field}>
            <span>Função</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={isSupervisor}
            >
              {roleOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          {/* Município */}
          <label className={styles.field}>
            <span>Município de atuação</span>
            <div className={styles.comboboxWrapper}>
              <input
                ref={inputRef}
                type="text"
                placeholder={
                  isSupervisor
                    ? "Digite para buscar na sua região"
                    : "Digite para buscar (ex: Araraquara)"
                }
                value={municipalitySearch}
                onChange={(e) => {
                  setMunicipalitySearch(e.target.value);
                  setIbgeCode("");
                  setMunicipalityListOpen(true);
                }}
                onFocus={() => setMunicipalityListOpen(true)}
                onBlur={() => setTimeout(() => setMunicipalityListOpen(false), 150)}
              />
              {municipalitySearch && (
                <button
                  type="button"
                  className={styles.clearButton}
                  onClick={handleClearMunicipality}
                  aria-label="Limpar município"
                >
                  ×
                </button>
              )}
            </div>
          </label>

          {error && <p className={styles.errorMessage}>{error}</p>}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => onClose(false)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={styles.primaryButton}
              disabled={submitting}
            >
              {submitting ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>

      {/* Renderiza a lista de sugestões via portal */}
      {renderPortalList()}
    </div>
  );
}