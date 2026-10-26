import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from "maplibre-gl";

// Estilo próprio do globo. Fontes de dados abertas e sem chave:
// - NASA Blue Marble (satélite, domínio público) para a Terra vista de longe;
// - OpenFreeMap (mapa vetorial do OpenStreetMap, esquema OpenMapTiles) para
//   nomes de países, estados e cidades em qualquer zoom e, de perto, ruas,
//   água, parques e prédios em 3D;
// - Terrain Tiles (relevo, dados abertos).

const OFM = "https://tiles.openfreemap.org";
const zoom: ExpressionSpecification = ["zoom"];
/** Entra suavemente entre dois zooms (o mapa vetorial aparece quando o satélite sai). */
const fadeIn = (from: number, to: number, max = 1): ExpressionSpecification => ["interpolate", ["linear"], zoom, from, 0, to, max];
/** Nome em português quando existir, senão o nome local. */
const name: ExpressionSpecification = ["coalesce", ["get", "name:pt"], ["get", "name:latin"], ["get", "name"]];
const FONT = ["Noto Sans Regular"];
const FONT_BOLD = ["Noto Sans Bold"];
const FONT_ITALIC = ["Noto Sans Italic"];

// Rótulos: claros com contorno escuro sobre o satélite; escuros com contorno claro sobre o mapa.
const labelColor: ExpressionSpecification = ["interpolate", ["linear"], zoom, 7, "#ffffff", 9, "#1c2a33"];
const haloColor: ExpressionSpecification = ["interpolate", ["linear"], zoom, 7, "rgba(8,16,28,0.85)", 9, "rgba(255,255,255,0.95)"];

const road = (id: string, classes: string[], color: string, widths: [number, number][], minzoom: number, casing = false): LayerSpecification => ({
  id,
  type: "line",
  source: "ofm",
  "source-layer": "transportation",
  minzoom,
  filter: ["all", ["in", ["get", "class"], ["literal", classes]], ["!=", ["get", "brunnel"], "tunnel"]],
  layout: { "line-cap": "round", "line-join": "round" },
  paint: {
    "line-color": color,
    "line-width": ["interpolate", ["exponential", 1.5], zoom, ...widths.flatMap(([z, w]) => [z, casing ? w + 2 : w])] as unknown as ExpressionSpecification,
    "line-opacity": fadeIn(minzoom, minzoom + 1.5),
  },
});

export const GLOBE_STYLE: StyleSpecification = {
  version: 8,
  projection: { type: "globe" },
  glyphs: `${OFM}/fonts/{fontstack}/{range}.pbf`,
  sources: {
    satelite: {
      type: "raster",
      tiles: ["https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg"],
      tileSize: 256,
      maxzoom: 8,
      attribution: "Imagens da Terra: NASA Blue Marble",
    },
    ofm: {
      type: "vector",
      url: `${OFM}/planet`,
      attribution: '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
    },
    relevo: {
      type: "raster-dem",
      tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
      encoding: "terrarium",
      tileSize: 256,
      maxzoom: 14,
      attribution: "Relevo: Terrain Tiles (dados abertos)",
    },
  },
  layers: [
    // A superfície: oceano de longe (enquanto o satélite carrega), terra clara de perto.
    { id: "superficie", type: "background", paint: { "background-color": ["interpolate", ["linear"], zoom, 6, "#173f63", 8.5, "#f3efe7"] } },
    { id: "satelite", type: "raster", source: "satelite", paint: { "raster-opacity": ["interpolate", ["linear"], zoom, 6.5, 1, 9, 0], "raster-fade-duration": 200 } },

    // Mapa vetorial (aparece de perto).
    { id: "vegetacao", type: "fill", source: "ofm", "source-layer": "landcover", minzoom: 6, filter: ["in", ["get", "class"], ["literal", ["wood", "grass", "farmland"]]], paint: { "fill-color": ["match", ["get", "class"], "wood", "#cfe3c3", "grass", "#ddecd0", "#ecefd9"], "fill-opacity": fadeIn(7, 9, 0.8) } },
    { id: "parques", type: "fill", source: "ofm", "source-layer": "park", minzoom: 7, paint: { "fill-color": "#cde8c0", "fill-opacity": fadeIn(7.5, 9, 0.9) } },
    { id: "bairros", type: "fill", source: "ofm", "source-layer": "landuse", minzoom: 9, filter: ["in", ["get", "class"], ["literal", ["residential", "commercial", "hospital", "school", "university"]]], paint: { "fill-color": ["match", ["get", "class"], "hospital", "#f6dede", "school", "#f2ead2", "university", "#f2ead2", "commercial", "#efe7e0", "#ece6dc"], "fill-opacity": fadeIn(9, 11, 0.7) } },
    { id: "rios", type: "line", source: "ofm", "source-layer": "waterway", minzoom: 8, paint: { "line-color": "#9ec7e6", "line-width": ["interpolate", ["linear"], zoom, 8, 0.5, 14, 3], "line-opacity": fadeIn(8, 9.5) } },
    { id: "agua", type: "fill", source: "ofm", "source-layer": "water", paint: { "fill-color": "#a9cfea", "fill-opacity": fadeIn(6.5, 8.5) } },
    { id: "sombras", type: "hillshade", source: "relevo", minzoom: 7, paint: { "hillshade-exaggeration": 0.3, "hillshade-shadow-color": "#3a4a55", "hillshade-highlight-color": "#ffffff" } },

    road("ruas-menores-borda", ["minor", "service", "tertiary"], "#d7d0c4", [[12, 0.5], [18, 14]], 12, true),
    road("ruas-principais-borda", ["primary", "secondary", "trunk", "motorway"], "#d2b58a", [[7, 0.6], [18, 20]], 7, true),
    road("ruas-menores", ["minor", "service", "tertiary"], "#ffffff", [[12, 0.5], [18, 14]], 12),
    road("ruas-principais", ["primary", "secondary"], "#fff3c4", [[7, 0.6], [18, 20]], 7),
    road("rodovias", ["trunk", "motorway"], "#ffd27f", [[6, 0.8], [18, 22]], 6),

    // Prédios: chapados de longe, em 3D quando aproxima (altura real quando o mapa informa).
    { id: "predios", type: "fill", source: "ofm", "source-layer": "building", minzoom: 13, maxzoom: 15, paint: { "fill-color": "#e2dbd0", "fill-outline-color": "#d3cabd" } },
    {
      id: "predios-3d",
      type: "fill-extrusion",
      source: "ofm",
      "source-layer": "building",
      minzoom: 15,
      paint: {
        "fill-extrusion-color": ["interpolate", ["linear"], ["coalesce", ["get", "render_height"], 6], 0, "#e7e1d7", 60, "#cfc6b8", 200, "#b8ae9f"],
        "fill-extrusion-height": ["coalesce", ["get", "render_height"], 6],
        "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
        "fill-extrusion-opacity": 0.9,
      },
    },

    // Fronteiras (visíveis também sobre o satélite).
    { id: "estados", type: "line", source: "ofm", "source-layer": "boundary", minzoom: 3, filter: ["all", ["==", ["get", "admin_level"], 4], ["!=", ["get", "maritime"], 1]], paint: { "line-color": ["interpolate", ["linear"], zoom, 7, "rgba(255,255,255,0.45)", 9, "#b9a8c6"], "line-width": ["interpolate", ["linear"], zoom, 3, 0.5, 10, 1.5], "line-dasharray": [3, 2] } },
    { id: "paises", type: "line", source: "ofm", "source-layer": "boundary", filter: ["all", ["==", ["get", "admin_level"], 2], ["!=", ["get", "maritime"], 1], ["!=", ["get", "disputed"], 1]], paint: { "line-color": ["interpolate", ["linear"], zoom, 7, "rgba(255,255,255,0.7)", 9, "#9b86ad"], "line-width": ["interpolate", ["linear"], zoom, 1, 0.6, 10, 2.2] } },

    // Nomes.
    { id: "nomes-ruas", type: "symbol", source: "ofm", "source-layer": "transportation_name", minzoom: 13, layout: { "symbol-placement": "line", "text-field": name, "text-font": FONT, "text-size": ["interpolate", ["linear"], zoom, 13, 10, 18, 14], "text-max-angle": 30 }, paint: { "text-color": "#4a4a4a", "text-halo-color": "#ffffff", "text-halo-width": 1.5 } },
    { id: "nomes-agua", type: "symbol", source: "ofm", "source-layer": "water_name", layout: { "text-field": name, "text-font": FONT_ITALIC, "text-size": ["interpolate", ["linear"], zoom, 1, 11, 8, 14], "text-letter-spacing": 0.15 }, paint: { "text-color": ["interpolate", ["linear"], zoom, 7, "#cfe6ff", 9, "#3f7aa8"], "text-halo-color": haloColor, "text-halo-width": 1 } },
    {
      id: "nomes-bairros",
      type: "symbol",
      source: "ofm",
      "source-layer": "place",
      minzoom: 11,
      filter: ["in", ["get", "class"], ["literal", ["suburb", "quarter", "neighbourhood", "village", "hamlet"]]],
      layout: { "text-field": name, "text-font": FONT, "text-size": ["interpolate", ["linear"], zoom, 11, 11, 16, 14], "text-transform": "uppercase", "text-letter-spacing": 0.08 },
      paint: { "text-color": "#6b6158", "text-halo-color": "#ffffff", "text-halo-width": 1.5 },
    },
    {
      id: "nomes-cidades",
      type: "symbol",
      source: "ofm",
      "source-layer": "place",
      minzoom: 3,
      filter: ["in", ["get", "class"], ["literal", ["city", "town"]]],
      layout: {
        "text-field": name,
        "text-font": ["match", ["get", "class"], "city", ["literal", FONT_BOLD], ["literal", FONT]],
        "text-size": ["interpolate", ["linear"], zoom, 3, ["match", ["get", "class"], "city", 11, 9], 8, ["match", ["get", "class"], "city", 16, 13], 14, ["match", ["get", "class"], "city", 22, 17]],
        "symbol-sort-key": ["coalesce", ["get", "rank"], 99],
        "text-max-width": 8,
        "text-padding": 4,
      },
      paint: { "text-color": labelColor, "text-halo-color": haloColor, "text-halo-width": 1.6 },
    },
    {
      id: "nomes-estados",
      type: "symbol",
      source: "ofm",
      "source-layer": "place",
      minzoom: 3,
      maxzoom: 8,
      filter: ["==", ["get", "class"], "state"],
      layout: { "text-field": name, "text-font": FONT, "text-size": ["interpolate", ["linear"], zoom, 3, 10, 7, 14], "text-transform": "uppercase", "text-letter-spacing": 0.12, "text-max-width": 7 },
      paint: { "text-color": "rgba(255,255,255,0.85)", "text-halo-color": "rgba(8,16,28,0.8)", "text-halo-width": 1.2 },
    },
    {
      id: "nomes-paises",
      type: "symbol",
      source: "ofm",
      "source-layer": "place",
      maxzoom: 7,
      filter: ["==", ["get", "class"], "country"],
      layout: { "text-field": name, "text-font": FONT_BOLD, "text-size": ["interpolate", ["linear"], zoom, 1, 11, 5, 17], "text-transform": "uppercase", "text-letter-spacing": 0.1, "text-max-width": 6 },
      paint: { "text-color": "#ffffff", "text-halo-color": "rgba(8,16,28,0.85)", "text-halo-width": 1.6 },
    },
  ],
  sky: {
    "sky-color": "#0b1d3a",
    "horizon-color": "#9cc8ff",
    "fog-color": "#cfe4ff",
    "sky-horizon-blend": 0.6,
    "horizon-fog-blend": 0.5,
    "fog-ground-blend": 0.6,
    "atmosphere-blend": ["interpolate", ["linear"], zoom, 0, 1, 6, 1, 9, 0],
  },
};
