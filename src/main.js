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

const featureCountEl = document.getElementById("feature-count");
const legendEl = document.getElementById("legend");

const WFS_URL =
  "https://geo.stat.fi/geoserver/vaestoruutu/wfs?" +
  "service=WFS&version=2.0.0&request=GetFeature" +
  "&typeName=vaestoruutu:vaki2022_5km" +
  "&outputFormat=application/json" +
  "&srsName=EPSG:3857";

const vectorSource = new VectorSource({
  format: new GeoJSON(),
  url: WFS_URL,
});

const kuntaPopulation = new Map();
const styleCache = new Map();

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

function buildKuntaPopulations() {
  kuntaPopulation.clear();
  styleCache.clear();

  for (const feature of vectorSource.getFeatures()) {
    const kunta = feature.get("kunta");
    const vaesto = feature.get("vaesto") || 0;
    if (kunta == null) continue;

    const existing = kuntaPopulation.get(kunta) || {
      totalPopulation: 0,
      gridCount: 0,
    };
    existing.totalPopulation += vaesto;
    existing.gridCount += 1;
    kuntaPopulation.set(kunta, existing);
  }
}

function municipalityStyle(feature) {
  const kunta = feature.get("kunta");
  if (kunta == null) return null;

  let style = styleCache.get(kunta);
  if (style) return style;

  const info = kuntaPopulation.get(kunta);
  const pop = info ? info.totalPopulation : 0;
  const c = getColor(pop);

  style = new Style({
    fill: new Fill({ color: `rgba(${c.r}, ${c.g}, ${c.b}, 0.85)` }),
    stroke: new Stroke({
      color: `rgba(${c.r}, ${c.g}, ${c.b}, 0.4)`,
      width: 0.5,
    }),
  });

  styleCache.set(kunta, style);
  return style;
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

  const featureCount = vectorSource.getFeatures().length;
  const municipalityCount = kuntaPopulation.size;
  featureCountEl.textContent = `Loaded ${featureCount.toLocaleString()} grid cells across ${municipalityCount} municipalities`;

  wfsLayer.changed();
  buildLegend();
});

vectorSource.on("featuresloaderror", () => {
  featureCountEl.textContent =
    "Could not load WFS features — check the console for details.";
});

const wfsLayer = new VectorLayer({
  source: vectorSource,
  style: municipalityStyle,
});

const map = new OlMap({
  target: "map",
  layers: [new TileLayer({ source: new OSM() }), wfsLayer],
  view: new View({
    center: [2900000, 8500000],
    zoom: 5,
  }),
});

map.on("singleclick", (evt) => {
  const features = map.getFeaturesAtPixel(evt.pixel);
  if (features.length > 0) {
    const kunta = features[0].get("kunta");
    const info = kuntaPopulation.get(kunta);
    if (info) {
      featureCountEl.textContent =
        `Municipality ${kunta} — Population: ${info.totalPopulation.toLocaleString()} (${info.gridCount} grid cells)`;
    }
  }
});
