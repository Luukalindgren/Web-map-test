import "./style.css";
import "ol/ol.css";

import OlMap from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import OSM from "ol/source/OSM";
import GeoJSON from "ol/format/GeoJSON";
import { Stroke, Fill, Style } from "ol/style";
import Polygon from "ol/geom/Polygon";
import MultiPolygon from "ol/geom/MultiPolygon";
import Feature from "ol/Feature";
import union from "@turf/union";
import { polygon, featureCollection } from "@turf/helpers";
import proj4 from "proj4";
import { register } from "ol/proj/proj4";
import { get as getProjection } from "ol/proj";

// EPSG:3067 (ETRS-TM35FIN) – Finland's national projection. Grid cells align with North (0° rotation) across all of Finland.
proj4.defs(
  "EPSG:3067",
  "+proj=tmerc +lat_0=0 +lon_0=27 +k=0.9996 +x_0=500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs"
);
register(proj4);

const PROJECTION = "EPSG:3067";
const FINLAND_EXTENT = [50199, 6582464, 761274, 7799839]; // Finland in EPSG:3067
const FINLAND_CENTER = [405700, 7191000];

const featureCountEl = document.getElementById("feature-count");
const legendEl = document.getElementById("legend");

const DATASETS = [
  {
    id: "grid-5km",
    label: "Population 5km grid",
    workspace: "vaestoruutu",
    typeName: "vaestoruutu:vaki2024_5km",
    type: "grid",
  },
  {
    id: "grid-1km",
    label: "Population 1km grid",
    workspace: "vaestoruutu",
    typeName: "vaestoruutu:vaki2024_1km",
    type: "grid",
  },
  {
    id: "grid-1km-kp",
    label: "Population 1km grid (kp)",
    workspace: "vaestoruutu",
    typeName: "vaestoruutu:vaki2024_1km_kp",
    type: "grid",
  },
  {
    id: "municipality",
    label: "Municipality boundaries",
    workspace: "vaestoalue",
    typeName: "vaestoalue:kunta_vaki2024",
    type: "municipality",
  },
];

function buildWfsUrl(dataset) {
  const base = `https://geo.stat.fi/geoserver/${dataset.workspace}/wfs`;
  const params = new URLSearchParams({
    service: "WFS",
    version: "2.0.0",
    request: "GetFeature",
    typeName: dataset.typeName,
    outputFormat: "application/json",
    srsName: PROJECTION,
  });
  return `${base}?${params}`;
}

const vectorSource = new VectorSource({
  format: new GeoJSON({
    dataProjection: PROJECTION,
    featureProjection: PROJECTION,
  }),
  url: buildWfsUrl(DATASETS[0]),
});

const kuntaPopulation = new Map();
const styleCache = new Map();
let selectedKunta = null;
let currentDataset = DATASETS[0];

// WFS data is fetched once on load; no refetch on click or style changes
function getColor(population) {
  const stops = [
    { val: 0, r: 255, g: 255, b: 229 },
    { val: 1000, r: 255, g: 237, b: 160 },
    { val: 5000, r: 254, g: 198, b: 79 },
    { val: 10000, r: 254, g: 153, b: 41 },
    { val: 30000, r: 236, g: 112, b: 20 },
    { val: 80000, r: 204, g: 76, b: 2 },
    { val: 150000, r: 153, g: 52, b: 4 },
    { val: 300000, r: 102, g: 37, b: 6 },
  ];

  if (population <= stops[0].val) return stops[0];
  if (population >= stops[stops.length - 1].val) return stops[stops.length - 1];

  for (let i = 0; i < stops.length - 1; i++) {
    if (population >= stops[i].val && population < stops[i + 1].val) {
      const t =
        (population - stops[i].val) / (stops[i + 1].val - stops[i].val);
      return {
        r: Math.round(stops[i].r + t * (stops[i + 1].r - stops[i].r)),
        g: Math.round(stops[i].g + t * (stops[i + 1].g - stops[i].g)),
        b: Math.round(stops[i].b + t * (stops[i + 1].b - stops[i].b)),
      };
    }
  }
  return stops[stops.length - 1];
}

function safeSum(acc, val) {
  const n = Number(val);
  return n > 0 ? acc + n : acc;
}

function darkenColor(c, factor = 0.5) {
  return {
    r: Math.round(c.r * factor),
    g: Math.round(c.g * factor),
    b: Math.round(c.b * factor),
  };
}

function vibrantColor(c, boost = 1.15) {
  return {
    r: Math.min(255, Math.round(c.r * boost)),
    g: Math.min(255, Math.round(c.g * boost)),
    b: Math.min(255, Math.round(c.b * boost)),
  };
}

function buildSelectionOutlineGeometry(kunta) {
  const features = vectorSource.getFeatures().filter((f) => f.get("kunta") === kunta);
  if (features.length === 0) return null;
  if (currentDataset.type === "municipality" || features.length === 1) {
    return features[0].getGeometry().clone();
  }
  const turfPolys = features.map((f) => {
    const coords = f.getGeometry().getCoordinates();
    return polygon(coords);
  });
  const fc = featureCollection(turfPolys);
  const unioned = union(fc);
  if (!unioned || !unioned.geometry) return null;
  const coords = unioned.geometry.coordinates;
  return unioned.geometry.type === "MultiPolygon"
    ? new MultiPolygon(coords)
    : new Polygon(coords);
}

function buildKuntaPopulations() {
  kuntaPopulation.clear();
  styleCache.clear();
  selectedKunta = null;

  if (currentDataset.type === "municipality") {
    for (const feature of vectorSource.getFeatures()) {
      const kunta = feature.get("kunta");
      if (kunta == null) continue;
      const vaesto = feature.get("vaesto") || 0;
      const miehet = feature.get("miehet") ?? 0;
      const naiset = feature.get("naiset") ?? 0;
      const ika0_14 = feature.get("ika_0_14") ?? 0;
      const ika15_64 = feature.get("ika_15_64") ?? 0;
      const ika65_ = feature.get("ika_65_") ?? 0;
      kuntaPopulation.set(kunta, {
        totalPopulation: vaesto,
        gridCount: 1,
        miehet: miehet > 0 ? miehet : 0,
        naiset: naiset > 0 ? naiset : 0,
        ika_0_14: ika0_14 > 0 ? ika0_14 : 0,
        ika_15_64: ika15_64 > 0 ? ika15_64 : 0,
        ika_65_: ika65_ > 0 ? ika65_ : 0,
        name: feature.get("name") || feature.get("nimi") || kunta,
      });
    }
  } else {
    for (const feature of vectorSource.getFeatures()) {
      const kunta = feature.get("kunta");
      if (kunta == null) continue;
      const vaesto = feature.get("vaesto") || 0;
      const miehet = feature.get("miehet") ?? -1;
      const naiset = feature.get("naiset") ?? -1;
      const ika0_14 = feature.get("ika_0_14") ?? -1;
      const ika15_64 = feature.get("ika_15_64") ?? -1;
      const ika65_ = feature.get("ika_65_") ?? -1;
      const existing = kuntaPopulation.get(kunta) || {
        totalPopulation: 0,
        gridCount: 0,
        miehet: 0,
        naiset: 0,
        ika_0_14: 0,
        ika_15_64: 0,
        ika_65_: 0,
      };
      existing.totalPopulation += vaesto;
      existing.gridCount += 1;
      existing.miehet = safeSum(existing.miehet, miehet);
      existing.naiset = safeSum(existing.naiset, naiset);
      existing.ika_0_14 = safeSum(existing.ika_0_14, ika0_14);
      existing.ika_15_64 = safeSum(existing.ika_15_64, ika15_64);
      existing.ika_65_ = safeSum(existing.ika_65_, ika65_);
      kuntaPopulation.set(kunta, existing);
    }
  }
}

function municipalityStyle(feature) {
  const kunta = feature.get("kunta");
  if (kunta == null) return null;

  const info = kuntaPopulation.get(kunta);
  const pop = info ? info.totalPopulation : 0;
  const c = getColor(pop);
  const isSelected = selectedKunta === kunta;

  let style = styleCache.get(kunta);
  if (style && !isSelected) return style;

  const color = isSelected ? vibrantColor(c) : c;
  const fill = new Fill({
    color: `rgba(${color.r}, ${color.g}, ${color.b}, ${isSelected ? 0.55 : 0.45})`,
  });
  const stroke = isSelected
    ? null
    : new Stroke({ color: `rgba(${c.r}, ${c.g}, ${c.b}, 0.25)`, width: 0.5 });

  style = new Style({ fill, stroke });
  if (!isSelected) styleCache.set(kunta, style);
  return style;
}

const LABELS = {
  totalPopulation: "Total population",
  gridCount: "Grid cells",
  miehet: "Men",
  naiset: "Women",
  ika_0_14: "Age 0–14",
  ika_15_64: "Age 15–64",
  ika_65_: "Age 65+",
  name: "Name",
};

function formatValue(key, value) {
  if (key === "gridCount") return value.toLocaleString();
  if (key === "name") return String(value ?? "");
  return typeof value === "number" ? value.toLocaleString() : String(value);
}

function renderMunicipalityDetails(kunta, info) {
  const detailsEl = document.getElementById("municipality-details");
  detailsEl.classList.remove("hidden");

  const title = info.name ? `${info.name} (${kunta})` : `Municipality ${kunta}`;
  const rows = Object.entries(LABELS)
    .filter(
      ([k]) =>
        info[k] !== undefined &&
        (k !== "gridCount" || currentDataset.type === "grid")
    )
    .map(
      ([key, label]) =>
        `<tr><td class="label">${label}</td><td class="value">${formatValue(key, info[key])}</td></tr>`
    )
    .join("");

  detailsEl.innerHTML = `
    <h3 class="municipality-title">${title}</h3>
    <table class="municipality-table">
      <tbody>${rows}</tbody>
    </table>
  `;
}

function hideMunicipalityDetails() {
  const detailsEl = document.getElementById("municipality-details");
  detailsEl.classList.add("hidden");
  detailsEl.innerHTML = "";
}

function buildLegend() {
  const labels = ["0", "1k", "5k", "10k", "30k", "80k", "150k", "300k+"];
  const vals = [0, 1000, 5000, 10000, 30000, 80000, 150000, 300000];

  let html = "<strong>Population</strong><div class='legend-bar'>";
  for (let i = 0; i < vals.length; i++) {
    const c = getColor(vals[i]);
    html += `<span class="legend-stop" style="background:rgb(${c.r},${c.g},${c.b})" title="${labels[i]}"></span>`;
  }
  html += "</div><div class='legend-labels'>";
  for (const label of labels) {
    html += `<span>${label}</span>`;
  }
  html += "</div>";
  legendEl.innerHTML = html;
}

vectorSource.on("featuresloadend", () => {
  buildKuntaPopulations();
  selectionOverlaySource.clear();

  const featureCount = vectorSource.getFeatures().length;
  const municipalityCount = kuntaPopulation.size;
  const isGrid = currentDataset.type === "grid";
  featureCountEl.textContent = isGrid
    ? `Loaded ${featureCount.toLocaleString()} grid cells across ${municipalityCount} municipalities`
    : `Loaded ${municipalityCount} municipalities`;

  wfsLayer.changed();
  buildLegend();
});

vectorSource.on("featuresloaderror", () => {
  featureCountEl.textContent =
    "Could not load WFS features — check the console for details.";
});

function switchDataset(dataset) {
  currentDataset = dataset;
  selectedKunta = null;
  selectionOverlaySource.clear();
  hideMunicipalityDetails();
  featureCountEl.textContent = "Loading…";
  vectorSource.setUrl(buildWfsUrl(dataset));
  vectorSource.refresh();
}

const wfsLayer = new VectorLayer({
  source: vectorSource,
  style: municipalityStyle,
});

const selectionOverlaySource = new VectorSource();
const selectionOverlayLayer = new VectorLayer({
  source: selectionOverlaySource,
  style: (feature) => {
    const kunta = feature.get("kunta");
    const info = kuntaPopulation.get(kunta);
    const pop = info ? info.totalPopulation : 0;
    const c = darkenColor(getColor(pop), 0.55);
    return new Style({
      fill: new Fill({ color: "transparent" }),
      stroke: new Stroke({
        color: `rgb(${c.r}, ${c.g}, ${c.b})`,
        width: 3,
      }),
    });
  },
});

getProjection(PROJECTION).setExtent(FINLAND_EXTENT);

const map = new OlMap({
  target: "map",
  layers: [
    new TileLayer({ source: new OSM() }),
    wfsLayer,
    selectionOverlayLayer,
  ],
  view: new View({
    projection: PROJECTION,
    center: FINLAND_CENTER,
    zoom: 5,
    extent: FINLAND_EXTENT,
  }),
});

function updateSelectionOverlay() {
  selectionOverlaySource.clear();
  if (selectedKunta) {
    const geom = buildSelectionOutlineGeometry(selectedKunta);
    if (geom) {
      const outlineFeature = new Feature({ geometry: geom, kunta: selectedKunta });
      selectionOverlaySource.addFeature(outlineFeature);
    }
  }
}

map.on("singleclick", (evt) => {
  const features = map.getFeaturesAtPixel(evt.pixel);
  if (features.length > 0) {
    const kunta = features[0].get("kunta");
    const info = kuntaPopulation.get(kunta);
    if (info) {
      selectedKunta = kunta;
      wfsLayer.changed();
      updateSelectionOverlay();
      renderMunicipalityDetails(kunta, info);
    }
  } else {
    selectedKunta = null;
    wfsLayer.changed();
    selectionOverlaySource.clear();
    hideMunicipalityDetails();
  }
});

document.getElementById("dataset-select").addEventListener("change", (e) => {
  const dataset = DATASETS.find((d) => d.id === e.target.value);
  if (dataset) switchDataset(dataset);
});
