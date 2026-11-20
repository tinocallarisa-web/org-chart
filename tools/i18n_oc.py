# -*- coding: utf-8 -*-
"""Textos nuevos de Org Chart 1.1 en los 12 idiomas, y src/strings.ts regenerado.

 - añade o actualiza en stringResources/<idioma>/resources.resjson las claves de tools/i18n_oc_1_1.json;
 - regenera src/strings.ts con TODAS las claves que no están en capabilities.json (textos que escribe el propio
   visual: barra, avisos, inicio, tooltips). Power BI Desktop solo traduce con getDisplayName las claves declaradas
   en capabilities.json, así que las demás viajan en el bundle.
Ejecutar desde la raíz del repo:  python tools/i18n_oc.py
"""
import io, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LANGS = ["en-US", "de-DE", "es-ES", "fr-FR", "it-IT", "ja-JP", "ko-KR", "nl-NL", "pl-PL", "pt-BR", "pt-PT", "zh-CN"]
NUEVOS = json.load(io.open(os.path.join(ROOT, "tools", "i18n_oc_1_1.json"), encoding="utf-8"))
CAB = '''/**
 * Traducciones de los textos que escribe el propio visual (barra, avisos, inicio, tooltips). Power BI Desktop solo
 * resuelve con getDisplayName las claves declaradas en capabilities.json, así que estas viajan en el bundle.
 * Generado por tools/i18n_oc.py desde stringResources: no editar a mano.
 */
'''


def main():
    res = {}
    for lg in LANGS:
        p = os.path.join(ROOT, "stringResources", lg, "resources.resjson")
        d = json.load(io.open(p, encoding="utf-8-sig"))
        for k, por_idioma in NUEVOS.items():
            d[k] = por_idioma.get(lg) or por_idioma["en-US"]
        io.open(p, "w", encoding="utf-8", newline="\n").write(json.dumps(d, indent=2, ensure_ascii=False) + "\n")
        res[lg] = d
    caps = io.open(os.path.join(ROOT, "capabilities.json"), encoding="utf-8").read()
    claves = sorted(k for k in res["en-US"] if '"%s"' % k not in caps)
    tabla = {lg: {k: res[lg][k] for k in claves if k in res[lg] and res[lg][k] != res["en-US"].get(k)} for lg in LANGS if lg != "en-US"}
    io.open(os.path.join(ROOT, "src", "strings.ts"), "w", encoding="utf-8", newline="\n").write(
        CAB + "export const STRINGS: Record<string, Record<string, string>> = " + json.dumps(tabla, ensure_ascii=False, indent=4) + ";\n")
    print(len(NUEVOS), "claves nuevas ·", len(claves), "en el bundle")


if __name__ == "__main__":
    main()
