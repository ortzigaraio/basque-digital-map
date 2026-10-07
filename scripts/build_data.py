#!/usr/bin/env python3
"""Genera los GeoJSON de Euskadi a partir de OpenStreetMap.

Salida (en ../data):
  euskadi.geojson     contorno de la Comunidad Autónoma de Euskadi
  provincias.geojson  Araba/Álava, Bizkaia y Gipuzkoa
  municipios.geojson  todos los municipios (udalerriak)
  mascara.geojson     tierra que NO es Euskadi (el mar queda fuera)

Uso:
  pip install shapely
  python3 scripts/build_data.py

Las descargas se guardan en scripts/.cache para no repetirlas.
Datos © colaboradores de OpenStreetMap, licencia ODbL.
"""

import json
import os
import sys
import time
import urllib.parse
import urllib.request

from shapely.geometry import LineString, Polygon, box, mapping, shape
from shapely.ops import polygonize, unary_union

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "scripts", ".cache")
OUT = os.path.join(ROOT, "data")
UA = "euskadi-mapa-digital/1.0 (+https://github.com/ortzigaraio/Euskadi-Mapa-digital-)"

EUSKADI = 349042

# Regiones/provincias vecinas usadas para oscurecer la tierra de alrededor.
# Sus límites siguen la línea de costa, así que el mar no se oscurece.
VECINOS = {
    6426101: "Cantabria",
    349033: "Asturias",
    349032: "Palencia",
    349004: "Burgos",  # incluye el enclave de Treviño
    348991: "La Rioja",
    349005: "Soria",
    6429242: "Navarra",
    349030: "Zaragoza",
    349022: "Huesca",
    7450: "Pyrénées-Atlantiques",
    7376: "Landes",
    7422: "Gers",
    7467: "Hautes-Pyrénées",
}

# Zona cubierta por la máscara (lon_min, lat_min, lon_max, lat_max).
# El visor limita el desplazamiento a esta zona.
MASK_BBOX = (-4.5, 41.95, -0.45, 44.05)

# Tolerancias de simplificación en grados (~1 m y ~5 m).
SIMPLIFY_FINO = 0.00001
SIMPLIFY_MUNI = 0.00004
SIMPLIFY_MASK = 0.00004


def fetch(url, cache_name):
    path = os.path.join(CACHE, cache_name)
    if os.path.exists(path):
        with open(path, "rb") as f:
            return f.read()
    for intento in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=180) as r:
                data = r.read()
            break
        except Exception as e:  # noqa: BLE001
            espera = 2 ** (intento + 1)
            print(f"  fallo {url}: {e}; reintento en {espera}s", file=sys.stderr)
            time.sleep(espera)
    else:
        raise RuntimeError(f"no se pudo descargar {url}")
    os.makedirs(CACHE, exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)
    time.sleep(1)
    return data


def relation(rid):
    data = fetch(f"https://api.openstreetmap.org/api/0.6/relation/{rid}.json", f"rel_{rid}.json")
    return json.loads(data)["elements"][0]


def geometry_overpass(rid):
    """Alternativa: une las vías de la relación con Overpass y poligoniza."""
    d = overpass(f"[out:json][timeout:120];rel({rid});way(r);out geom;", f"ways_{rid}.json")
    lineas = [LineString([(p["lon"], p["lat"]) for p in w["geometry"]]) for w in d["elements"] if len(w.get("geometry", [])) > 1]
    anillos = [Polygon(c.exterior) for c in polygonize(unary_union(lineas))]
    # Los anillos interiores aparecen como caras propias: se resuelven por paridad.
    geom = None
    for a in sorted(anillos, key=lambda a: -a.area):
        geom = a if geom is None else geom.symmetric_difference(a)
    return geom


def geometry(rid):
    try:
        data = fetch(f"https://polygons.openstreetmap.fr/get_geojson.py?id={rid}&params=0", f"geom_{rid}.json")
    except RuntimeError:
        print(f"  usando Overpass para la relación {rid}", file=sys.stderr)
        geom = geometry_overpass(rid)
        if geom is None or geom.is_empty:
            raise
        with open(os.path.join(CACHE, f"geom_{rid}.json"), "w") as f:
            json.dump(mapping(geom), f)
        return geom
    geom = shape(json.loads(data))
    if not geom.is_valid:
        geom = geom.buffer(0)
    return geom


def partes(geom):
    return list(getattr(geom, "geoms", [geom]))


def quitar_enclaves(geom, vecinos):
    """Resta los trozos de territorios vecinos que quedan dentro (p. ej. Treviño).

    Algunos polígonos generados no incluyen los anillos interiores de la relación.
    """
    dentro = geom.buffer(-0.0005)
    enclaves = [p for p in partes(vecinos) if dentro.contains(p.representative_point())]
    return geom.difference(unary_union(enclaves)).buffer(0) if enclaves else geom


def subareas(rel):
    return [m["ref"] for m in rel.get("members", []) if m["type"] == "relation" and m["role"] == "subarea"]


OVERPASS = [
    "https://overpass-api.de/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]

# Prefijo INE de cada provincia.
INE_PROVINCIA = {"01": 349011, "20": 349015, "48": 349034}


def overpass(query, cache_name):
    path = os.path.join(CACHE, cache_name)
    if os.path.exists(path):
        with open(path, "rb") as f:
            return json.loads(f.read())
    body = urllib.parse.urlencode({"data": query}).encode()
    for intento in range(6):
        url = OVERPASS[intento % len(OVERPASS)]
        try:
            req = urllib.request.Request(url, data=body, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=240) as r:
                data = r.read()
            json.loads(data)
            break
        except Exception as e:  # noqa: BLE001
            print(f"  fallo overpass {url}: {e}", file=sys.stderr)
            time.sleep(2 ** (intento + 1))
    else:
        raise RuntimeError("Overpass no responde")
    os.makedirs(CACHE, exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)
    return json.loads(data)


def ine(tags):
    return tags.get("ine:municipio") or tags.get("ref:ine")


def municipios(eus):
    """Relaciones admin_level=8 de Euskadi (municipios y partzuergoak/facerías)."""
    w, s_, e, n = eus.bounds
    q = f'[out:json][timeout:180];rel["boundary"="administrative"]["admin_level"="8"]({s_},{w},{n},{e});out tags;'
    out = []
    for el in overpass(q, "admin8.json")["elements"]:
        codigo = ine(el["tags"])
        if codigo:
            if codigo[:2] in INE_PROVINCIA:
                out.append((el, INE_PROVINCIA[codigo[:2]], "municipio"))
            continue
        geom = geometry(el["id"])
        if eus.contains(geom.representative_point()):
            out.append((el, None, "partzuergoa"))
    return out


def round_coords(obj, nd=6):
    if isinstance(obj, (list, tuple)):
        if obj and isinstance(obj[0], (int, float)):
            return [round(c, nd) for c in obj]
        return [round_coords(o, nd) for o in obj]
    return obj


def feature(geom, props):
    g = mapping(geom)
    return {"type": "Feature", "properties": props, "geometry": {"type": g["type"], "coordinates": round_coords(g["coordinates"])}}


def props_de(rel, extra=None):
    t = rel["tags"]
    p = {
        "nombre": t.get("name"),
        "izena_eu": t.get("name:eu", t.get("name")),
        "nombre_es": t.get("name:es", t.get("name")),
        "admin_level": int(t.get("admin_level", 0)),
        "osm_id": rel["id"],
    }
    for k_src, k_dst in (("ine:municipio", "ine"), ("ref:ine", "ine"), ("ISO3166-2", "iso3166_2"), ("population", "poblacion"), ("wikidata", "wikidata")):
        if k_src in t and k_dst not in p:
            p[k_dst] = t[k_src]
    if extra:
        p.update(extra)
    return p


def write(name, features):
    path = os.path.join(OUT, name)
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": features}, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    print(f"  {name}: {len(features)} features, {os.path.getsize(path) / 1024:.0f} KB")


def main():
    os.makedirs(OUT, exist_ok=True)

    print("Euskadi…")
    eus_rel = relation(EUSKADI)
    vecinos = unary_union([geometry(rid) for rid in VECINOS])
    eus = quitar_enclaves(geometry(EUSKADI), vecinos)

    print("Provincias…")
    provincias = []
    prov_geom = {}
    for pid in subareas(eus_rel):
        prel = relation(pid)
        prov_geom[pid] = (prel["tags"].get("name"), quitar_enclaves(geometry(pid), vecinos))
        provincias.append(feature(prov_geom[pid][1].simplify(SIMPLIFY_FINO), props_de(prel)))

    print("Municipios…")
    muni_feats = []
    for mrel, pid, tipo in municipios(eus):
        mgeom = geometry(mrel["id"])
        if pid is None:  # partzuergoa: provincia por posición
            punto = mgeom.representative_point()
            pid = next((k for k, (_, g) in prov_geom.items() if g.contains(punto)), None)
        extra = {"tipo": tipo, "provincia": prov_geom[pid][0] if pid else None}
        muni_feats.append(feature(mgeom.simplify(SIMPLIFY_MUNI), props_de(mrel, extra)))
    muni_feats.sort(key=lambda f: (f["properties"]["provincia"] or "", f["properties"]["tipo"], f["properties"]["nombre"] or ""))

    print("Máscara…")
    eus_s = eus.simplify(SIMPLIFY_FINO).buffer(0)
    marco = box(*MASK_BBOX)
    # Se resta el mismo contorno que se publica para que encajen sin huecos.
    mascara = vecinos.intersection(marco).simplify(SIMPLIFY_MASK).buffer(0).difference(eus_s)

    print("Escribiendo…")
    write("euskadi.geojson", [feature(eus_s, props_de(eus_rel))])
    write("provincias.geojson", provincias)
    write("municipios.geojson", muni_feats)
    write("mascara.geojson", [feature(mascara, {"descripcion": "Tierra fuera de Euskadi (para oscurecer)", "bbox": list(MASK_BBOX)})])


if __name__ == "__main__":
    main()
