import { useMemo, memo } from "react";
import {
  MapContainer,
  TileLayer,
  Polygon,
  Circle,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import styles from "./styles.module.css";

const BRAZIL_CENTER = [-14.235, -51.9253];
const BRAZIL_ZOOM = 4;

/**
 * Calcula o fecho convexo (convex hull) de uma lista de pontos [lat, lng]
 * usando o algoritmo de Andrew's monotone chain. Retorna os pontos do
 * hull em ordem, formando um poligono.
 */
function convexHull(points) {
  if (points.length < 3) return points;

  const sorted = [...points].sort((a, b) =>
    a[0] === b[0] ? a[1] - b[1] : a[0] - b[0],
  );

  const cross = (o, a, b) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

  const lower = [];
  for (const p of sorted) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0
    ) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0
    ) {
      upper.pop();
    }
    upper.push(p);
  }

  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

/**
 * Expande o poligono a partir do centroide, pra parecer uma "area de
 * cobertura" em vez de um contorno fino colado exatamente nos centros das
 * cidades (que sao so pontos, nao a fronteira real do municipio).
 */
function expandPolygon(hullPoints, factor = 1.35) {
  const centroid = hullPoints.reduce(
    (acc, p) => [
      acc[0] + p[0] / hullPoints.length,
      acc[1] + p[1] / hullPoints.length,
    ],
    [0, 0],
  );

  return hullPoints.map(([lat, lng]) => [
    centroid[0] + (lat - centroid[0]) * factor,
    centroid[1] + (lng - centroid[1]) * factor,
  ]);
}

/**
 * Componente auxiliar sem render proprio - so ajusta o bounds do mapa
 * (mapa em si e controlado pelo MapContainer, entao usamos useMap()
 * pra pegar a instancia e chamar fitBounds nela quando os pontos mudam).
 */
function FitBounds({ points }) {
  const map = useMap();

  useMemo(() => {
    if (points.length === 0) {
      map.setView(BRAZIL_CENTER, BRAZIL_ZOOM);
      return;
    }
    map.fitBounds(points, { padding: [32, 32], maxZoom: 11 });
  }, [points, map]);

  return null;
}

/**
 * Mapa da regiao de atuacao.
 *
 * - `municipalities`: lista de { ibge_code, city, uf, latitude, longitude }
 * - `highlightRegion`: quando true, desenha uma unica area colorida (fecho
 *   convexo expandido) cobrindo os municipios, em vez de um circulo por
 *   cidade. Nao e a fronteira real da regiao (o banco nao tem poligono),
 *   e uma aproximacao visual.
 * - Marcadores pequenos (CircleMarker) indicam cada cidade sem poluir o
 *   mapa, com popup do nome ao clicar.
 */
export const RegionMap = memo(function RegionMap({
  municipalities = [],
  highlightRegion = false,
  title,
}) {
  const validPoints = useMemo(
    () =>
      municipalities.filter((m) => m.latitude != null && m.longitude != null),
    [municipalities],
  );

  const latLngPoints = useMemo(
    () => validPoints.map((m) => [m.latitude, m.longitude]),
    [validPoints],
  );

  const regionPolygon = useMemo(() => {
    if (!highlightRegion || latLngPoints.length < 3) return null;
    return expandPolygon(convexHull(latLngPoints));
  }, [highlightRegion, latLngPoints]);

  const showFallbackCircles =
    highlightRegion && latLngPoints.length > 0 && latLngPoints.length < 3;

  return (
    <div className={styles.wrapper}>
      {title && <h3 className={styles.title}>{title}</h3>}
      <MapContainer
        center={BRAZIL_CENTER}
        zoom={BRAZIL_ZOOM}
        scrollWheelZoom={true}
        className={styles.mapContainer}
      >
        <TileLayer
          // url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&​copy; OpenStreetMap contributors"
          updateWhenIdle
          keepBuffer={4}
        />

        <FitBounds points={latLngPoints} />

        {regionPolygon && (
          <Polygon
            positions={regionPolygon}
            pathOptions={{
              color: "#175cd3",
              weight: 2,
              fillColor: "#93c5fd",
              fillOpacity: 0.35,
            }}
          />
        )}

        {showFallbackCircles &&
          latLngPoints.map((point, idx) => (
            <Circle
              key={idx}
              center={point}
              radius={15000}
              pathOptions={{
                color: "#175cd3",
                weight: 2,
                fillColor: "#93c5fd",
                fillOpacity: 0.35,
              }}
            />
          ))}

        {validPoints.map((m) => (
          <CircleMarker
            key={m.ibge_code}
            center={[m.latitude, m.longitude]}
            radius={5}
            pathOptions={{
              color: "#175cd3",
              fillColor: "#175cd3",
              fillOpacity: 1,
              weight: 1,
            }}
          >
            <Popup>
              {m.city}
              {m.uf ? `/${m.uf}` : ""}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
});
