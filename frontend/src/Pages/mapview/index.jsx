import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import styles from "./styles.module.css";
import {
  useMapView,
  FitBounds,
  makeIcon,
  STATUS_COLOR,
  STATUS_LABEL,
} from "./scripts";

import { MdOutlineSatelliteAlt } from "react-icons/md";
import { IoMapOutline } from "react-icons/io5";

export function MapView() {
  const {
    attendant,
    navigate,
    isAdmin,
    isSupervisor,
    canChooseScope,
    ownIbgeCode,
    cityLabel,
    regions,
    regionId,
    setRegionId,
    municipalities,
    cityFilter,
    setCityFilter,
    occurrences,
    selectedId,
    loading,
    mapType,
    setMapType,
    activeCount,
    inProgressCount,
    handleSelect,
    handleAssume,
    occurrencesWithCoords,
    tileLayer,
    mapCenter,
    scope,
    setSelectedId,
    markerRefs,
    lastInsertedOccurrence,
  } = useMapView();

  if (!canChooseScope && !ownIbgeCode) {
    return (
      <div className={styles.container}>
        <h1>Mapa</h1>
        <p className={styles.subtitle}>
          {attendant
            ? "Nenhum município associado à sua conta. Contate o administrador."
            : "Carregando dados do atendente..."}
        </p>
      </div>
    );
  }

  if (isSupervisor && !attendant?.municipalities?.region_id) {
    return (
      <div className={styles.container}>
        <h1>Mapa</h1>
        <p className={styles.subtitle}>
          Sua região não está configurada. Contate o administrador.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div>
          <h2>Mapa de Ocorrências</h2>
          {!canChooseScope && cityLabel && (
            <p className={styles.subtitle}>Município: {cityLabel}</p>
          )}

          {canChooseScope && (
            <div className={styles.scopeFilters}>
              {isAdmin && (
                <select
                  value={regionId ?? ""}
                  onChange={(e) =>
                    setRegionId(e.target.value ? Number(e.target.value) : null)
                  }
                >
                  <option value="">Todas as regiões</option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              )}

              {isSupervisor && (
                <select value={regionId ?? ""} disabled>
                  <option value={regionId ?? ""}>
                    {attendant?.municipalities?.regions?.name ?? "Sua região"}
                  </option>
                </select>
              )}

              {regionId && (
                <select
                  value={cityFilter}
                  onChange={(e) => setCityFilter(e.target.value)}
                >
                  <option value="all">Todas as cidades</option>
                  {municipalities.map((m) => (
                    <option key={m.ibge_code} value={m.ibge_code}>
                      {m.city} - {m.uf}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>

        <div className={styles.counters}>
          <span className={styles.counterBadge}>SOS ativos: {activeCount}</span>
          <span className={styles.counterBadge}>
            Em atendimento: {inProgressCount}
          </span>
          <div className={styles.mapTypeToggle}>
            <button
              type="button"
              className={
                mapType === "normal"
                  ? styles.mapTypeButtonActive
                  : styles.mapTypeButton
              }
              onClick={() => setMapType("normal")}
            >
              <IoMapOutline />
            </button>
            <button
              type="button"
              className={
                mapType === "satellite"
                  ? styles.mapTypeButtonActive
                  : styles.mapTypeButton
              }
              onClick={() => setMapType("satellite")}
            >
              <MdOutlineSatelliteAlt />
            </button>
          </div>
        </div>
      </div>

      <div className={styles.mapLayout}>
        <ul className={styles.occurrenceList}>
          {loading && <li className={styles.occurrenceEmpty}>Carregando...</li>}
          {!loading && occurrences.length === 0 && (
            <li className={styles.occurrenceEmpty}>
              Nenhuma ocorrência no momento
            </li>
          )}
          {occurrences.map((o) => (
            <li
              key={o.id}
              className={`${styles.occurrenceItem} ${selectedId === o.id ? styles.occurrenceItemActive : ""}`}
              onClick={() => handleSelect(o.id)}
            >
              <span
                className={styles.statusDot}
                style={{
                  background: STATUS_COLOR[o.status] ?? STATUS_COLOR.active,
                }}
              />
              <span>SOS #{String(o.id).slice(0, 6)}</span>
              <span className={styles.occurrenceStatus}>
                {STATUS_LABEL[o.status] ?? o.status}
              </span>
            </li>
          ))}
        </ul>

        <div className={styles.mapContainer}>
          <MapContainer
            center={mapCenter}
            zoom={13}
            className={styles.leafletMap}
          >
            <TileLayer
              url={tileLayer.url}
              attribution={tileLayer.attribution}
            />
            <FitBounds
              occurrences={occurrencesWithCoords}
              cityLat={mapCenter[0]}
              cityLng={mapCenter[1]}
              shouldFitBounds={scope !== "all"}
              focusOnOccurrence={lastInsertedOccurrence}
            />
            {occurrencesWithCoords.map((o) => (
              <Marker
                key={o.id}
                position={[o.latitude, o.longitude]}
                icon={makeIcon(o.status)}
                ref={(ref) => {
                  if (ref) markerRefs.current[o.id] = ref;
                }}
                eventHandlers={{ click: () => setSelectedId(o.id) }}
              >
                <Popup>
                  <div className={styles.popupContent}>
                    <strong>SOS #{String(o.id).slice(0, 6)}</strong>
                    <p>Status: {STATUS_LABEL[o.status] ?? o.status}</p>
                    <p>
                      Horário:{" "}
                      {new Date(o.created_at).toLocaleTimeString("pt-BR")}
                    </p>
                    {o.city && (
                      <p>
                        Local: {o.city} - {o.uf}
                      </p>
                    )}
                    <div className={styles.popupActions}>
                      <button
                        type="button"
                        onClick={() => navigate(`/sos/${o.id}`)}
                      >
                        Ver ocorrência
                      </button>
                      {o.status !== "in_progress" &&
                        o.status !== "finished" && (
                          <button
                            type="button"
                            onClick={() => handleAssume(o.id)}
                          >
                            Assumir atendimento
                          </button>
                        )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
