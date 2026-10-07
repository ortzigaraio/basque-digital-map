#!/usr/bin/env python3
"""Genera GeoJSON con todas las calles/vías de municipios de Euskadi.

Salida: data/calles/<municipio>.geojson (LineString por vía de OSM) y
data/calles/index.json con la lista de municipios disponibles.

Uso:
  pip install shapely osmium
  python3 scripts/build_calles.py                   # municipios de 500 habitantes o más
  python3 scripts/build_calles.py --min 0           # todos los municipios
  python3 scripts/build_calles.py Zumaia Bermeo     # municipios concretos (nombre o osm_id)
  python3 scripts/build_calles.py --overpass Zumaia # usar Overpass en vez del extracto

Por defecto lee el extracto de OpenStreetMap de Euskadi (openstreetmap.fr,
~80 MB, se descarga una vez a scripts/.cache). Con --overpass consulta la API
de Overpass municipio a municipio (más lento).

Requiere data/municipios.geojson (scripts/build_data.py).
Datos © colaboradores de OpenStreetMap, licencia ODbL.
"""

import json
import os
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request

from shapely import STRtree
from shapely.geometry import LineString, MultiLineString, mapping, shape
from shapely.prepared import prep

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "scripts", ".cache", "calles")
OUT = os.path.join(ROOT, "data", "calles")
UA = "euskadi-mapa-digital/1.0 (+https://github.com/ortzigaraio/Euskadi-Mapa-digital-)"
OVERPASS = [
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
PBF_URL = "https://download.openstreetmap.fr/extracts/europe/spain/euskadi.osm.pbf"
POBLACION_MINIMA = 500
CAMPOS = (("name", "nombre"), ("name:eu", "izena_eu"), ("name:es", "nombre_es"), ("ref", "ref"),
          ("oneway", "oneway"), ("bridge", "puente"), ("tunnel", "tunel"), ("surface", "superficie"))
# Tipos de vía que no son calles ni caminos.
EXCLUIR = {"proposed", "construction", "platform", "bus_stop", "elevator", "raceway", "abandoned", "razed", "services", "rest_area"}
TESELA = 0.12  # grados; las consultas grandes se trocean


def slug(texto):
    texto = texto.split(" / ")[0]
    texto = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", texto.lower()).strip("-")


def overpass(bbox, cache_name):
    path = os.path.join(CACHE, cache_name)
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    s, w, n, e = bbox
    q = f'[out:json][timeout:240];way["highway"]["area"!="yes"]({s},{w},{n},{e});out tags geom;'
    body = urllib.parse.urlencode({"data": q}).encode()
    for intento in range(8):
        url = OVERPASS[intento % len(OVERPASS)]
        try:
            req = urllib.request.Request(url, data=body, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=300) as r:
                data = json.loads(r.read())
            break
        except Exception as ex:  # noqa: BLE001
            print(f"    fallo {url}: {str(ex)[:80]}", file=sys.stderr, flush=True)
            time.sleep(3 * (intento + 1))
    else:
        raise RuntimeError("Overpass no responde")
    os.makedirs(CACHE, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f)
    return data


def teselas(geom):
    w, s, e, n = geom.bounds
    nx, ny = max(1, round((e - w) / TESELA)), max(1, round((n - s) / TESELA))
    dx, dy = (e - w) / nx, (n - s) / ny
    for i in range(nx):
        for j in range(ny):
            yield (s + j * dy, w + i * dx, s + (j + 1) * dy, w + (i + 1) * dx)


def redondear(coords):
    return [[round(x, 5), round(y, 5)] for x, y in coords]


def es_via(tags):
    return "highway" in tags and tags.get("area") != "yes" and tags["highway"] not in EXCLUIR


class FuenteOverpass:
    """Vías de un municipio consultando Overpass por teselas."""

    def vias(self, muni, geom):
        vistos = {}
        for k, bbox in enumerate(teselas(geom)):
            for el in overpass(bbox, f"{muni['properties']['osm_id']}_{k}.json")["elements"]:
                if el["type"] == "way" and el["id"] not in vistos and len(el.get("geometry", [])) > 1:
                    t = el.get("tags", {})
                    if es_via(t):
                        vistos[el["id"]] = (el["id"], t, LineString([(pt["lon"], pt["lat"]) for pt in el["geometry"]]))
        return vistos.values()


class FuentePBF:
    """Todas las vías del extracto .osm.pbf, indexadas espacialmente."""

    def __init__(self, path):
        import osmium

        datos = []

        class Lector(osmium.SimpleHandler):
            def way(self, w):
                if "highway" not in w.tags:
                    return
                t = {k: v for k, v in w.tags}
                if not es_via(t):
                    return
                try:
                    coords = [(n.lon, n.lat) for n in w.nodes]
                except osmium.InvalidLocationError:
                    coords = [(n.lon, n.lat) for n in w.nodes if n.location.valid()]
                if len(coords) > 1:
                    datos.append((w.id, {k: t[k] for k, _ in CAMPOS + (("highway", ""),) if k in t}, LineString(coords)))

        print(f"Leyendo {path}…", flush=True)
        Lector().apply_file(path, locations=True)
        print(f"  {len(datos)} vías", flush=True)
        self.datos = datos
        self.arbol = STRtree([d[2] for d in datos])

    def vias(self, muni, geom):
        return [self.datos[i] for i in self.arbol.query(geom, predicate="intersects")]


def descargar_pbf():
    path = os.path.join(ROOT, "scripts", ".cache", "euskadi.osm.pbf")
    if not os.path.exists(path):
        print(f"Descargando {PBF_URL}…", flush=True)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        req = urllib.request.Request(PBF_URL, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=600) as r, open(path + ".part", "wb") as f:
            while bloque := r.read(1 << 20):
                f.write(bloque)
        os.replace(path + ".part", path)
    return path


def construir(muni, fuente):
    geom = shape(muni["geometry"])
    dentro = prep(geom)
    feats = []
    for via_id, t, linea in fuente.vias(muni, geom):
        if not dentro.intersects(linea):
            continue
        if not dentro.contains(linea):
            linea = linea.intersection(geom)
            if linea.is_empty:
                continue
        partes = [linea] if isinstance(linea, LineString) else [g for g in getattr(linea, "geoms", []) if isinstance(g, LineString)]
        if not partes:
            continue
        g = partes[0] if len(partes) == 1 else MultiLineString(partes)
        m = mapping(g)
        coords = redondear(m["coordinates"]) if m["type"] == "LineString" else [redondear(c) for c in m["coordinates"]]
        props = {"id": via_id, "highway": t["highway"]}
        for k_src, k_dst in CAMPOS:
            if k_src in t:
                props[k_dst] = t[k_src]
        feats.append({"type": "Feature", "properties": props, "geometry": {"type": m["type"], "coordinates": coords}})
    feats.sort(key=lambda f: f["properties"]["id"])
    return feats


def main():
    with open(os.path.join(ROOT, "data", "municipios.geojson")) as f:
        munis = [m for m in json.load(f)["features"] if m["properties"]["tipo"] == "municipio"]
    args = sys.argv[1:]
    usar_overpass = "--overpass" in args
    minimo = POBLACION_MINIMA
    if "--min" in args:
        i = args.index("--min")
        minimo = int(args[i + 1])
        del args[i:i + 2]
    if "--pbf" in args:
        i = args.index("--pbf")
        pbf = args[i + 1]
        del args[i:i + 2]
    else:
        pbf = None
    pedidos = [a for a in args if not a.startswith("--")]
    if pedidos:
        def coincide(m):
            p = m["properties"]
            return any(x.lower() in {str(p["osm_id"]), (p["nombre"] or "").lower(), (p["izena_eu"] or "").lower(),
                                     (p["nombre_es"] or "").lower(), slug(p["nombre"] or "")} for x in pedidos)
        elegidos = [m for m in munis if coincide(m)]
    else:
        elegidos = [m for m in munis if int(m["properties"].get("poblacion") or 0) >= minimo]
    print(f"{len(elegidos)} municipios", flush=True)
    fuente = FuenteOverpass() if usar_overpass else FuentePBF(pbf or descargar_pbf())

    os.makedirs(OUT, exist_ok=True)
    idx_path = os.path.join(OUT, "index.json")
    indice = {}
    if os.path.exists(idx_path):
        with open(idx_path) as f:
            indice = {e["archivo"]: e for e in json.load(f)}

    for m in elegidos:
        p = m["properties"]
        nombre = slug(p["nombre"]) + ".geojson"
        print(f"{p['nombre']}…", flush=True)
        try:
            feats = construir(m, fuente)
        except RuntimeError as ex:
            print(f"  omitido: {ex}", flush=True)
            continue
        path = os.path.join(OUT, nombre)
        with open(path, "w", encoding="utf-8") as f:
            json.dump({"type": "FeatureCollection", "features": feats}, f, ensure_ascii=False, separators=(",", ":"))
            f.write("\n")
        w, s, e, n = shape(m["geometry"]).bounds
        indice[nombre] = {"archivo": nombre, "nombre": p["nombre"], "izena_eu": p["izena_eu"], "nombre_es": p["nombre_es"],
                          "osm_id": p["osm_id"], "provincia": p["provincia"], "vias": len(feats),
                          "kb": round(os.path.getsize(path) / 1024), "bbox": [round(v, 5) for v in (w, s, e, n)]}
        print(f"  {len(feats)} vías, {indice[nombre]['kb']} KB", flush=True)
        with open(idx_path, "w", encoding="utf-8") as f:
            json.dump(sorted(indice.values(), key=lambda e: e["nombre"]), f, ensure_ascii=False, indent=1)
            f.write("\n")


if __name__ == "__main__":
    main()
