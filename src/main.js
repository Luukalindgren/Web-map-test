import "./style.css";
import "ol/ol.css";

import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import OSM from "ol/source/OSM";
import GeoJSON from "ol/format/GeoJSON";
import { Stroke, Fill, Style, Circle as CircleStyle } from "ol/style";
import { bbox as bboxStrategy } from "ol/loadingstrategy";

const featureCountEl = document.getElementById("feature-count");

const WFS_URL =
  "https://geo.stat.fi/geoserver/vaestoruutu/wfs?" +
  "service=WFS&version=2.0.0&request=GetFeature" +
  "&typeName=vaestoruutu:vaki2022_5km" +
  "&outputFormat=application/json" +
  "&srsName=EPSG:3857";

const vectorSource = new VectorSource({
  format: new GeoJSON(),
  url: (extent) => `${WFS_URL}&bbox=${extent.join(",")},EPSG:3857`,
  strategy: bboxStrategy,
});

vectorSource.on("featuresloadend", () => {
  const count = vectorSource.getFeatures().length;
  featureCountEl.textContent = `Loaded ${count} WFS feature${count !== 1 ? "s" : ""} from Statistics Finland`;
});

vectorSource.on("featuresloaderror", () => {
  featureCountEl.textContent =
    "Could not load WFS features — check the console for details.";
});

const wfsLayer = new VectorLayer({
  source: vectorSource,
  style: new Style({
    stroke: new Stroke({ color: "rgba(0, 100, 200, 0.8)", width: 1 }),
    fill: new Fill({ color: "rgba(0, 100, 200, 0.15)" }),
    image: new CircleStyle({
      radius: 5,
      fill: new Fill({ color: "rgba(0, 100, 200, 0.6)" }),
      stroke: new Stroke({ color: "#fff", width: 1 }),
    }),
  }),
});

const map = new Map({
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
    const props = features[0].getProperties();
    const entries = Object.entries(props)
      .filter(([key]) => key !== "geometry")
      .map(([key, val]) => `${key}: ${val}`)
      .join(" | ");
    featureCountEl.textContent = entries || "No attribute data";
  }
});
