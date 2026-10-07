// Visor del mapa digital de Euskadi (2D y 3D).
// Uso: <div id="map"></div> + iniciarMapa({ modo: "2d" | "3d" })

(function () {
  // ---------------------------------------------------------------- textos
  const TXT = {
    eu: { sub2d: "Mapa digitala · 2D", sub3d: "Mapa digitala · 3D", buscar: "Udalerria bilatu…", opciones: "Aukerak",
          idioma: "Izenen hizkuntza", capas: "Geruzak", c_mascara: "Kanpoaldea ilundu", c_prov: "Lurraldeak",
          c_muni: "Udalerriak", c_edif: "Eraikinak", c_relieve: "Erliebea", colores: "Koloreak", temas: "Gaiak",
          mascara: "Maskara", opacidad: "Opakutasuna", exagerar: "Erliebe-eskala", sombras: "Itzalak",
          restablecer: "Berrezarri", exportar: "Estiloa jaitsi", kaleak: "Kaleak GeoJSON", ninguno: "— Udalerria aukeratu —",
          m_tipo: "Mota", m_arco: "Ortzadarra", m_uno: "Kolore bat", vias: "bide", ocultar_base: "Oinarri-mapako kaleak ezkutatu", pob: "biztanle", prov: "Lurraldea",
          col: { fondo: "Lurra", agua: "Ura", calles: "Kaleak", autopistas: "Autobideak", edificios: "Eraikinak",
                 texto: "Testua", mascara: "Maskara", borde: "Muga" } },
    es: { sub2d: "Mapa digital · 2D", sub3d: "Mapa digital · 3D", buscar: "Buscar municipio…", opciones: "Opciones",
          idioma: "Idioma de los nombres", capas: "Capas", c_mascara: "Oscurecer el exterior", c_prov: "Provincias",
          c_muni: "Municipios", c_edif: "Edificios", c_relieve: "Relieve", colores: "Colores", temas: "Temas",
          mascara: "Máscara", opacidad: "Opacidad", exagerar: "Escala del relieve", sombras: "Sombreado",
          restablecer: "Restablecer", exportar: "Descargar estilo", kaleak: "Calles en GeoJSON", ninguno: "— Elegir municipio —",
          m_tipo: "Tipo", m_arco: "Arcoíris", m_uno: "Un color", vias: "vías", ocultar_base: "Ocultar calles del mapa base", pob: "habitantes", prov: "Provincia",
          col: { fondo: "Tierra", agua: "Agua", calles: "Calles", autopistas: "Autopistas", edificios: "Edificios",
                 texto: "Texto", mascara: "Máscara", borde: "Borde" } },
    en: { sub2d: "Digital map · 2D", sub3d: "Digital map · 3D", buscar: "Search municipality…", opciones: "Options",
          idioma: "Label language", capas: "Layers", c_mascara: "Darken outside", c_prov: "Provinces",
          c_muni: "Municipalities", c_edif: "Buildings", c_relieve: "Terrain", colores: "Colours", temas: "Themes",
          mascara: "Mask", opacidad: "Opacity", exagerar: "Terrain scale", sombras: "Hillshade",
          restablecer: "Reset", exportar: "Download style", kaleak: "Streets as GeoJSON", ninguno: "— Choose a municipality —",
          m_tipo: "Type", m_arco: "Rainbow", m_uno: "Single", vias: "ways", ocultar_base: "Hide base map streets", pob: "inhabitants", prov: "Province",
          col: { fondo: "Land", agua: "Water", calles: "Streets", autopistas: "Motorways", edificios: "Buildings",
                 texto: "Text", mascara: "Mask", borde: "Border" } },
  };
  const UI_LANG = { eu: "eu", es: "es", en: "en", ofi: "eu" };

  // Nombre según idioma. "ofi" = nombre oficial de OSM (a menudo bilingüe).
  const NOMBRE = {
    eu: ["coalesce", ["get", "name:eu"], ["get", "name"], ""],
    es: ["coalesce", ["get", "name:es"], ["get", "name"], ""],
    en: ["coalesce", ["get", "name:en"], ["get", "name"], ""],
    ofi: ["coalesce", ["get", "name"], ""],
  };

  // ----------------------------------------------------------------- temas
  const TEMAS = {
    oscuro:     { fondo: "#1a1d23", agua: "#0c1724", calles: "#3a3f4a", autopistas: "#8a6b40", edificios: "#262a32",
                  texto: "#d3d6dc", mascara: "#040508", borde: "#e8c987", opacidad: 0.74 },
    medianoche: { fondo: "#0f1626", agua: "#060b16", calles: "#2b3a57", autopistas: "#4d7fc0", edificios: "#18233a",
                  texto: "#c9d6ee", mascara: "#000000", borde: "#7fb3ff", opacidad: 0.76 },
    ikurrina:   { fondo: "#171b18", agua: "#0b1420", calles: "#3c433e", autopistas: "#c0392b", edificios: "#232924",
                  texto: "#ebe8de", mascara: "#030403", borde: "#2fae5f", opacidad: 0.74 },
    claro:      { fondo: "#ece8df", agua: "#a8c3d6", calles: "#fdfcf9", autopistas: "#e3b56b", edificios: "#d8d1c4",
                  texto: "#3a3934", mascara: "#1d2026", borde: "#b5822a", opacidad: 0.6 },
  };
  const NOMBRES_TEMA = { oscuro: "Oscuro · Iluna", medianoche: "Medianoche · Gauerdia", ikurrina: "Ikurriña", claro: "Claro · Argia" };
  const CLAVES_COLOR = ["fondo", "agua", "calles", "autopistas", "edificios", "texto", "mascara", "borde"];

  const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const mezcla = (a, b, t) => "#" + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, "0")).join("");
  const VERDE = "#3f7f52";

  function pintar(map, id, prop, valor) {
    if (map.getLayer(id)) map.setPaintProperty(id, prop, valor);
  }

  // Colores de la capa de calles GeoJSON
  const TIPOS_VIA = {
    grandes: ["motorway", "motorway_link", "trunk", "trunk_link"],
    principales: ["primary", "primary_link", "secondary", "secondary_link"],
    calles: ["tertiary", "tertiary_link", "residential", "unclassified", "living_street", "road"],
    peatonales: ["pedestrian", "footway", "steps", "path", "cycleway", "bridleway", "corridor"],
    servicio: ["service", "track"],
  };
  function colorCalles(modo, t) {
    if (modo === "uno") return t.borde;
    if (modo === "arcoiris") {
      return ["to-color", ["concat", "hsl(", ["%", ["*", ["get", "id"], 137], 360], ", 85%, 62%)"]];
    }
    return ["match", ["get", "highway"],
      TIPOS_VIA.grandes, t.autopistas,
      TIPOS_VIA.principales, t.borde,
      TIPOS_VIA.calles, "#7fb3ff",
      TIPOS_VIA.peatonales, "#5fd39a",
      TIPOS_VIA.servicio, "#b48cff",
      "#9aa0aa"];
  }

  function aplicarTema(map, t, modo) {
    const { fondo, agua, calles, autopistas, edificios, texto, mascara, borde } = t;
    const halo = fondo;
    pintar(map, "fondo", "background-color", fondo);
    pintar(map, "uso-residencial", "fill-color", mezcla(fondo, texto, 0.04));
    pintar(map, "uso-industrial", "fill-color", mezcla(fondo, texto, 0.025));
    pintar(map, "bosque", "fill-color", mezcla(fondo, VERDE, 0.13));
    pintar(map, "prado", "fill-color", mezcla(fondo, VERDE, 0.06));
    pintar(map, "parques", "fill-color", mezcla(fondo, VERDE, 0.16));
    pintar(map, "uso-verde", "fill-color", mezcla(fondo, VERDE, 0.17));
    pintar(map, "arena", "fill-color", mezcla(fondo, "#c2a46b", 0.1));
    pintar(map, "aeropuerto", "fill-color", mezcla(fondo, texto, 0.03));
    pintar(map, "pista", "line-color", mezcla(fondo, calles, 0.7));
    pintar(map, "agua", "fill-color", agua);
    pintar(map, "mar-sobre-mascara", "fill-color", agua);
    pintar(map, "rios", "line-color", mezcla(agua, texto, 0.08));
    pintar(map, "edificios", "fill-color", edificios);
    pintar(map, "edificios", "fill-outline-color", mezcla(edificios, texto, 0.1));
    pintar(map, "edificios-3d", "fill-extrusion-color", edificios);
    pintar(map, "tunel", "line-color", mezcla(fondo, calles, 0.6));
    pintar(map, "senderos", "line-color", mezcla(fondo, calles, 0.75));
    pintar(map, "servicio", "line-color", mezcla(fondo, calles, 0.75));
    pintar(map, "calles", "line-color", calles);
    pintar(map, "carreteras-secundarias", "line-color", mezcla(calles, texto, 0.12));
    pintar(map, "carreteras-principales", "line-color", mezcla(calles, autopistas, 0.35));
    pintar(map, "autopistas", "line-color", autopistas);
    pintar(map, "ferrocarril", "line-color", mezcla(fondo, texto, 0.25));
    pintar(map, "ferrocarril-traviesas", "line-color", mezcla(fondo, texto, 0.25));
    pintar(map, "municipios-linea", "line-color", mezcla(fondo, texto, 0.6));
    pintar(map, "provincias-linea", "line-color", borde);
    pintar(map, "mascara", "fill-color", mascara);
    pintar(map, "mascara", "fill-opacity", t.opacidad);
    pintar(map, "mascara-lejana", "fill-color", mascara);
    pintar(map, "mascara-lejana", "fill-opacity", t.opacidad);
    pintar(map, "euskadi-halo", "line-color", borde);
    pintar(map, "euskadi-borde", "line-color", borde);
    pintar(map, "municipio-resaltado", "line-color", borde);
    if (map.getLayer("calles-geojson")) map.setPaintProperty("calles-geojson", "line-color", colorCalles(map._modoCalles || "tipo", t));

    const textos = {
      "nombres-agua": [mezcla(agua, texto, 0.45), agua], "nombres-rios": [mezcla(agua, texto, 0.45), agua],
      "nombres-calles": [mezcla(texto, fondo, 0.2), halo], "ref-carreteras": [mezcla(autopistas, texto, 0.35), halo],
      "poi": [mezcla(texto, fondo, 0.4), halo], "cumbres": [mezcla(texto, fondo, 0.35), halo],
      "barrios": [mezcla(texto, fondo, 0.3), halo], "pueblos": [mezcla(texto, fondo, 0.12), halo],
      "villas": [texto, halo], "ciudades": [mezcla(texto, borde, 0.25), halo],
    };
    for (const [id, [color, h]] of Object.entries(textos)) {
      pintar(map, id, "text-color", color);
      pintar(map, id, "text-halo-color", h);
    }

    if (modo === "3d") {
      pintar(map, "sombreado", "hillshade-shadow-color", mezcla(fondo, "#000000", 0.75));
      pintar(map, "sombreado", "hillshade-highlight-color", mezcla(fondo, "#ffffff", 0.18));
      pintar(map, "sombreado", "hillshade-accent-color", mezcla(fondo, "#000000", 0.4));
      if (map.setSky) {
        map.setSky({
          "sky-color": mezcla(fondo, "#000000", 0.35), "horizon-color": mezcla(fondo, agua, 0.5),
          "fog-color": fondo, "sky-horizon-blend": 0.6, "horizon-fog-blend": 0.7, "fog-ground-blend": 0.55,
          "atmosphere-blend": 0,
        });
      }
    }
    document.body.style.background = fondo;
  }

  // ------------------------------------------------------------- utilidades
  const abs = (p) => new URL(p, location.href).href;
  const leer = (k, def) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } };
  const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  function panelHTML(modo) {
    const color = (k) => `<label class="color"><input type="color" data-color="${k}"> <span data-i18n-col="${k}"></span></label>`;
    return `
    <div class="titulo">
      <h1>Euskadi</h1>
      <nav class="seg" aria-label="2D / 3D">
        <a href="index.html" ${modo === "2d" ? 'aria-current="page"' : ""} data-vista>2D</a>
        <a href="3d.html" ${modo === "3d" ? 'aria-current="page"' : ""} data-vista>3D</a>
      </nav>
    </div>
    <p class="sub" data-i18n="${modo === "3d" ? "sub3d" : "sub2d"}"></p>

    <input id="buscar" type="search" list="lista-municipios" autocomplete="off" data-i18n-ph="buscar">
    <datalist id="lista-municipios"></datalist>

    <div class="row calles">
      <span class="label" data-i18n="kaleak"></span>
      <select id="calles-ciudad"><option value="" data-i18n="ninguno"></option></select>
      <div class="calles-opciones" id="calles-opciones" hidden>
        <div class="seg" id="calles-modo">
          <button data-modo="tipo" data-i18n="m_tipo"></button><button data-modo="arcoiris" data-i18n="m_arco"></button><button data-modo="uno" data-i18n="m_uno"></button>
        </div>
        <label class="chk"><input type="checkbox" id="calles-base"> <span data-i18n="ocultar_base"></span></label>
        <div class="links"><a id="calles-descarga" download>⇩ GeoJSON</a><span id="calles-info" class="info"></span></div>
      </div>
    </div>

    <details id="opciones" open>
      <summary data-i18n="opciones"></summary>

      <div class="row">
        <span class="label" data-i18n="idioma"></span>
        <div class="seg" id="idioma">
          <button data-lang="eu">EU</button><button data-lang="es">ES</button>
          <button data-lang="en">EN</button><button data-lang="ofi">EU / ES</button>
        </div>
      </div>

      <div class="row">
        <span class="label" data-i18n="capas"></span>
        <label class="chk"><input type="checkbox" data-capas="mascara,mascara-lejana,mar-sobre-mascara" checked> <span data-i18n="c_mascara"></span></label>
        <label class="chk"><input type="checkbox" data-capas="provincias-linea" checked> <span data-i18n="c_prov"></span></label>
        <label class="chk"><input type="checkbox" data-capas="municipios-linea" checked> <span data-i18n="c_muni"></span></label>
        <label class="chk"><input type="checkbox" data-capas="edificios,edificios-3d" checked> <span data-i18n="c_edif"></span></label>
        ${modo === "3d" ? '<label class="chk"><input type="checkbox" id="relieve" checked> <span data-i18n="c_relieve"></span></label>' : ""}
      </div>

      <div class="row">
        <span class="label" data-i18n="mascara"></span>
        <label class="slider"><span data-i18n="opacidad"></span><input type="range" id="opacidad" min="0" max="1" step="0.01"><output id="opacidad-v"></output></label>
        ${modo === "3d" ? `
        <label class="slider"><span data-i18n="exagerar"></span><input type="range" id="exagerar" min="0" max="3" step="0.1"><output id="exagerar-v"></output></label>
        <label class="slider"><span data-i18n="sombras"></span><input type="range" id="sombras" min="0" max="1" step="0.05"><output id="sombras-v"></output></label>` : ""}
      </div>

      <div class="row">
        <span class="label" data-i18n="temas"></span>
        <div class="temas">${Object.keys(TEMAS).map((k) =>
          `<button data-tema="${k}"><i style="background:${TEMAS[k].fondo};box-shadow:inset -6px 0 0 ${TEMAS[k].borde}"></i>${NOMBRES_TEMA[k]}</button>`).join("")}</div>
      </div>

      <div class="row">
        <span class="label" data-i18n="colores"></span>
        <div class="colores">${CLAVES_COLOR.map(color).join("")}</div>
      </div>

      <div class="row">
        <div class="links">
          <button id="restablecer" data-i18n="restablecer"></button>
          <button id="exportar" data-i18n="exportar"></button>
        </div>
      </div>

      <div class="row">
        <span class="label">GeoJSON</span>
        <div class="links">
          <a href="data/euskadi.geojson" download>euskadi</a>
          <a href="data/provincias.geojson" download>provincias</a>
          <a href="data/municipios.geojson" download>municipios</a>
          <a href="data/mascara.geojson" download>mascara</a>
        </div>
      </div>
    </details>`;
  }

  // ---------------------------------------------------------------- visor
  window.iniciarMapa = async function ({ modo = "2d" } = {}) {
    const panel = document.createElement("aside");
    panel.className = "panel";
    panel.innerHTML = panelHTML(modo);
    document.body.appendChild(panel);

    let lang = new URLSearchParams(location.search).get("lang") || leer("euskadi-lang", "ofi");
    if (!NOMBRE[lang]) lang = "ofi";
    const temaURL = new URLSearchParams(location.search).get("tema");
    let tema = TEMAS[temaURL] ? { ...TEMAS[temaURL] } : { ...TEMAS.oscuro, ...leer("euskadi-tema", {}) };
    const ajustes3d = { exagerar: 1.4, sombras: 0.6, relieve: true, ...leer("euskadi-3d", {}) };

    const estilo = await (await fetch("estilo/euskadi-oscuro.json")).json();
    for (const src of Object.values(estilo.sources)) {
      if (src.type === "geojson" && typeof src.data === "string") src.data = abs(src.data);
    }
    const mascara = await (await fetch("data/mascara.geojson")).json();
    const [w, s, e, n] = mascara.features[0].properties.bbox;

    // Fuera de la zona detallada todo se oscurece y el mar se vuelve a pintar
    // encima, así el mar nunca queda oscurecido (útil al inclinar en 3D).
    estilo.sources["mascara-lejana"] = { type: "geojson", data: { type: "Polygon", coordinates: [
      [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]],
      [[w, s], [w, n], [e, n], [e, s], [w, s]],
    ] } };
    const iMascara = estilo.layers.findIndex((l) => l.id === "mascara");
    estilo.layers.splice(iMascara + 1, 0,
      { id: "mascara-lejana", type: "fill", source: "mascara-lejana", paint: { "fill-color": "#000", "fill-opacity": 0.74, "fill-antialias": false } },
      { id: "mar-sobre-mascara", type: "fill", source: "osm", "source-layer": "water",
        filter: ["==", ["get", "class"], "ocean"], paint: { "fill-color": "#0c1724" } });

    if (modo === "3d") {
      const dem = {
        type: "raster-dem", encoding: "terrarium", tileSize: 256, maxzoom: 15,
        tiles: ["https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png"],
        attribution: '<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank">Terrain Tiles</a>',
      };
      estilo.sources.dem = dem;
      estilo.sources["dem-sombra"] = { ...dem };
      delete estilo.sources["dem-sombra"].attribution;
      const iFondo = estilo.layers.findIndex((l) => l.id === "agua");
      estilo.layers.splice(iFondo, 0, { id: "sombreado", type: "hillshade", source: "dem-sombra",
        paint: { "hillshade-exaggeration": ajustes3d.sombras, "hillshade-illumination-direction": 315 } });
      const iEdif = estilo.layers.findIndex((l) => l.id === "edificios");
      estilo.layers[iEdif] = { ...estilo.layers[iEdif], layout: { visibility: "none" } };
      const iTrasEdif = estilo.layers.findIndex((l) => l.id === "municipios-linea");
      estilo.layers.splice(iTrasEdif, 0, { id: "edificios-3d", type: "fill-extrusion", source: "osm", "source-layer": "building",
        minzoom: 13, filter: ["!=", ["get", "hide_3d"], true],
        paint: {
          "fill-extrusion-color": "#262a32",
          "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 13, 0, 14.5, ["coalesce", ["get", "render_height"], 8]],
          "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
          "fill-extrusion-opacity": 0.92,
          "fill-extrusion-vertical-gradient": true,
        } });
    }

    const margen = modo === "3d" ? 1.2 : 0;
    const map = new maplibregl.Map({
      container: "map",
      style: estilo,
      center: estilo.center,
      zoom: modo === "3d" ? 8.9 : estilo.zoom,
      pitch: modo === "3d" ? 55 : 0,
      bearing: modo === "3d" ? -12 : 0,
      maxPitch: 85,
      minZoom: 7,
      maxZoom: 19,
      maxBounds: [[w - margen, s - margen], [e + margen, n + margen]],
      hash: true,
      attributionControl: { compact: false },
    });
    window.map = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true } }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

    // Mantener el modo 2D/3D al cambiar de vista conservando la posición
    panel.querySelectorAll("[data-vista]").forEach((a) =>
      a.addEventListener("click", (ev) => { ev.preventDefault(); location.href = a.getAttribute("href") + location.search + location.hash; }));

    // ---- idioma
    function aplicarIdioma() {
      for (const capa of map.isStyleLoaded() ? map.getStyle().layers : []) {
        if (!capa.metadata || !capa.metadata.etiqueta) continue;
        map.setLayoutProperty(capa.id, "text-field", capa.id === "cumbres"
          ? ["case", ["has", "ele"], ["concat", "▲ ", NOMBRE[lang], "\n", ["to-string", ["get", "ele"]], " m"], ["concat", "▲ ", NOMBRE[lang]]]
          : NOMBRE[lang]);
      }
      const t = TXT[UI_LANG[lang]];
      document.documentElement.lang = UI_LANG[lang];
      panel.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t[el.dataset.i18n]; });
      panel.querySelectorAll("[data-i18n-ph]").forEach((el) => { el.placeholder = t[el.dataset.i18nPh]; });
      panel.querySelectorAll("[data-i18n-col]").forEach((el) => { el.textContent = t.col[el.dataset.i18nCol]; });
      panel.querySelectorAll("#idioma button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.lang === lang));
    }
    const nombreMunicipio = (p) => (lang === "eu" ? p.izena_eu : lang === "es" ? p.nombre_es : null) || p.nombre;

    // ---- colores
    function sincronizarControles() {
      panel.querySelectorAll("[data-color]").forEach((inp) => { inp.value = tema[inp.dataset.color]; });
      const op = panel.querySelector("#opacidad");
      op.value = tema.opacidad;
      panel.querySelector("#opacidad-v").textContent = Math.round(tema.opacidad * 100) + "%";
      if (modo === "3d") {
        panel.querySelector("#exagerar").value = ajustes3d.exagerar;
        panel.querySelector("#exagerar-v").textContent = ajustes3d.exagerar.toFixed(1) + "×";
        panel.querySelector("#sombras").value = ajustes3d.sombras;
        panel.querySelector("#sombras-v").textContent = Math.round(ajustes3d.sombras * 100) + "%";
        panel.querySelector("#relieve").checked = ajustes3d.relieve;
      }
    }
    function cambiarTema(nuevo) {
      tema = nuevo;
      guardar("euskadi-tema", tema);
      if (map.isStyleLoaded()) aplicarTema(map, tema, modo);
      sincronizarControles();
    }
    function aplicar3d() {
      guardar("euskadi-3d", ajustes3d);
      map.setTerrain(ajustes3d.relieve && ajustes3d.exagerar > 0 ? { source: "dem", exaggeration: ajustes3d.exagerar } : null);
      pintar(map, "sombreado", "hillshade-exaggeration", ajustes3d.sombras);
      sincronizarControles();
    }

    panel.querySelectorAll("[data-color]").forEach((inp) =>
      inp.addEventListener("input", () => cambiarTema({ ...tema, [inp.dataset.color]: inp.value })));
    panel.querySelector("#opacidad").addEventListener("input", (ev) => cambiarTema({ ...tema, opacidad: +ev.target.value }));
    panel.querySelectorAll("[data-tema]").forEach((b) =>
      b.addEventListener("click", () => cambiarTema({ ...TEMAS[b.dataset.tema] })));
    panel.querySelector("#restablecer").addEventListener("click", () => {
      Object.assign(ajustes3d, { exagerar: 1.4, sombras: 0.6, relieve: true });
      cambiarTema({ ...TEMAS.oscuro });
      if (modo === "3d") aplicar3d();
    });
    panel.querySelector("#exportar").addEventListener("click", () => {
      const st = map.getStyle();
      st.name = "Euskadi (personalizado)";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify(st, null, 2)], { type: "application/json" }));
      a.download = `euskadi-${modo}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    if (modo === "3d") {
      panel.querySelector("#exagerar").addEventListener("input", (ev) => { ajustes3d.exagerar = +ev.target.value; aplicar3d(); });
      panel.querySelector("#sombras").addEventListener("input", (ev) => { ajustes3d.sombras = +ev.target.value; aplicar3d(); });
      panel.querySelector("#relieve").addEventListener("change", (ev) => { ajustes3d.relieve = ev.target.checked; aplicar3d(); });
    }
    sincronizarControles();

    panel.querySelectorAll("#idioma button").forEach((b) =>
      b.addEventListener("click", () => {
        lang = b.dataset.lang;
        guardar("euskadi-lang", lang);
        if (map.isStyleLoaded()) aplicarIdioma();
      }));
    panel.querySelectorAll("[data-capas]").forEach((chk) =>
      chk.addEventListener("change", () => {
        for (const id of chk.dataset.capas.split(",")) {
          if (modo === "3d" && id === "edificios") continue;
          if (modo === "2d" && id === "edificios-3d") continue;
          if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", chk.checked ? "visible" : "none");
        }
      }));
    if (window.matchMedia("(max-width: 600px)").matches) panel.querySelector("#opciones").open = false;
    aplicarIdioma();

    map.on("load", async () => {
      // Relleno invisible para consultar municipios y línea de resaltado
      map.addLayer({ id: "municipios-clic", type: "fill", source: "municipios", minzoom: 8,
        paint: { "fill-color": "#000", "fill-opacity": 0 } }, "municipios-linea");
      map.addLayer({ id: "municipio-resaltado", type: "line", source: "municipios",
        filter: ["==", ["get", "osm_id"], -1],
        paint: { "line-color": tema.borde, "line-width": 1.6, "line-opacity": 0.85 } }, "mascara");

      aplicarIdioma();
      aplicarTema(map, tema, modo);
      if (modo === "3d") aplicar3d();

      // Buscador de municipios
      const munis = await (await fetch("data/municipios.geojson")).json();
      const indice = new Map();
      const lista = panel.querySelector("#lista-municipios");
      for (const f of munis.features) {
        const p = f.properties;
        for (const nom of new Set([p.nombre, p.izena_eu, p.nombre_es])) {
          if (!nom || indice.has(nom.toLowerCase())) continue;
          indice.set(nom.toLowerCase(), f);
          const o = document.createElement("option");
          o.value = nom;
          lista.appendChild(o);
        }
      }
      const buscar = panel.querySelector("#buscar");
      let cargarCallesDe = null;
      const irA = () => {
        const f = indice.get(buscar.value.trim().toLowerCase());
        if (!f) return;
        const b = new maplibregl.LngLatBounds();
        const recorrer = (c) => (typeof c[0] === "number" ? b.extend(c) : c.forEach(recorrer));
        recorrer(f.geometry.coordinates);
        map.fitBounds(b, { padding: 60, duration: 1600, pitch: map.getPitch(), bearing: map.getBearing() });
        map.setFilter("municipio-resaltado", ["==", ["get", "osm_id"], f.properties.osm_id]);
        buscar.blur();
        if (cargarCallesDe) cargarCallesDe(f.properties.osm_id);
      };
      buscar.addEventListener("change", irA);
      buscar.addEventListener("keydown", (ev) => { if (ev.key === "Enter") irA(); });

      map.on("click", "municipios-clic", (ev) => {
        if (map.getZoom() >= 15) return;
        if (map.getLayer("calles-geojson") && map.queryRenderedFeatures(ev.point, { layers: ["calles-geojson"] }).length) return;
        const p = ev.features[0].properties;
        map.setFilter("municipio-resaltado", ["==", ["get", "osm_id"], p.osm_id]);
        const t = TXT[UI_LANG[lang]];
        const pob = p.poblacion ? `<br><small>${Number(p.poblacion).toLocaleString(UI_LANG[lang])} ${t.pob}</small>` : "";
        const ine = p.ine ? `<br><small>INE ${p.ine}</small>` : "";
        new maplibregl.Popup({ closeButton: false, maxWidth: "260px" })
          .setLngLat(ev.lngLat)
          .setHTML(`<b>${nombreMunicipio(p)}</b><br><small>${t.prov}: ${p.provincia || "—"}</small>${pob}${ine}`)
          .addTo(map);
      });
      map.on("mouseenter", "municipios-clic", () => { if (map.getZoom() < 15) map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "municipios-clic", () => { map.getCanvas().style.cursor = ""; });

      // Calles en GeoJSON por municipio (data/calles/)
      map.addSource("calles-geojson", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "calles-geojson", type: "line", source: "calles-geojson",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": colorCalles(map._modoCalles, tema),
          "line-width": ["interpolate", ["exponential", 1.5], ["zoom"],
            10, ["match", ["get", "highway"], TIPOS_VIA.grandes, 1.2, TIPOS_VIA.principales, 0.9, 0.45],
            14, ["match", ["get", "highway"], TIPOS_VIA.grandes, 3, TIPOS_VIA.principales, 2.2, 1.2],
            18, ["match", ["get", "highway"], TIPOS_VIA.grandes, 10, TIPOS_VIA.principales, 7, 4]],
          "line-opacity": 0.9,
        } }, "municipios-linea");
      const CAPAS_BASE = ["tunel", "senderos", "servicio", "calles", "carreteras-secundarias", "carreteras-principales", "autopistas", "ferrocarril", "ferrocarril-traviesas"];

      const sel = panel.querySelector("#calles-ciudad");
      const ciudades = await fetch("data/calles/index.json", { cache: "no-cache" }).then((r) => r.json()).catch(() => []);
      const grupos = {};
      for (const c of ciudades) {
        const prov = c.provincia || "—";
        if (!grupos[prov]) {
          grupos[prov] = document.createElement("optgroup");
          grupos[prov].label = prov;
        }
        const o = document.createElement("option");
        o.value = c.archivo;
        o.textContent = `${c.nombre} · ${c.kb >= 1024 ? (c.kb / 1024).toFixed(1) + " MB" : c.kb + " KB"}`;
        grupos[prov].appendChild(o);
      }
      for (const prov of Object.keys(grupos).sort()) sel.appendChild(grupos[prov]);
      const cargarCalles = async (archivo) => {
        const links = panel.querySelector("#calles-opciones");
        if (!archivo) {
          map.getSource("calles-geojson").setData({ type: "FeatureCollection", features: [] });
          links.hidden = true;
          return;
        }
        const c = ciudades.find((x) => x.archivo === archivo);
        if (!c) return;
        const t = TXT[UI_LANG[lang]];
        links.hidden = false;
        panel.querySelector("#calles-info").textContent = "…";
        panel.querySelector("#calles-descarga").href = "data/calles/" + archivo;
        map.getSource("calles-geojson").setData(abs("data/calles/" + archivo));
        panel.querySelector("#calles-info").textContent = `${c.vias.toLocaleString(UI_LANG[lang])} ${t.vias}`;
        const [cw, cs, ce, cn] = c.bbox;
        map.fitBounds([[cw, cs], [ce, cn]], { padding: 40, duration: 1400, pitch: map.getPitch(), bearing: map.getBearing() });
      };
      sel.addEventListener("change", () => cargarCalles(sel.value));
      cargarCallesDe = (osm) => {
        const c = ciudades.find((x) => x.osm_id === osm);
        if (c && sel.value !== c.archivo) { sel.value = c.archivo; cargarCalles(c.archivo); }
      };
      const ponerModo = (m) => {
        map._modoCalles = m;
        map.setPaintProperty("calles-geojson", "line-color", colorCalles(m, tema));
        panel.querySelectorAll("#calles-modo button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.modo === m));
      };
      panel.querySelectorAll("#calles-modo button").forEach((b) => b.addEventListener("click", () => ponerModo(b.dataset.modo)));
      panel.querySelector("#calles-base").addEventListener("change", (ev) => {
        for (const id of CAPAS_BASE) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", ev.target.checked ? "none" : "visible");
      });
      const params = new URLSearchParams(location.search);
      ponerModo(["tipo", "arcoiris", "uno"].includes(params.get("modo")) ? params.get("modo") : "tipo");
      const pedida = params.get("calles");
      if (pedida) {
        const c = ciudades.find((x) => x.archivo === pedida + ".geojson");
        if (c) { sel.value = c.archivo; cargarCalles(c.archivo); }
      }
      if (params.get("base") === "0") panel.querySelector("#calles-base").click();

      map.on("click", "calles-geojson", (ev) => {
        const p = ev.features[0].properties;
        const nom = (lang === "eu" ? p.izena_eu : lang === "es" ? p.nombre_es : null) || p.nombre || "—";
        new maplibregl.Popup({ closeButton: false, maxWidth: "260px" })
          .setLngLat(ev.lngLat)
          .setHTML(`<b>${nom}</b><br><small>${p.highway}${p.ref ? " · " + p.ref : ""}</small><br><small>OSM way ${p.id}</small>`)
          .addTo(map);
      });
      map.on("mouseenter", "calles-geojson", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "calles-geojson", () => { map.getCanvas().style.cursor = ""; });
    });

    return map;
  };
})();
