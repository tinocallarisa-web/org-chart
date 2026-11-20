# -*- coding: utf-8 -*-
"""Simulador Playwright de Org Chart 1.1: valor del equipo en la tarjeta del jefe, formato dinámico, Accesibilidad,
estilos de la colección y tema del informe, aviso de jefes que faltan, allowInteractions y textos en el bundle.
Datos: Begudes Nord (ficticia), equipo comercial y de operaciones.

    node build-test.js && rm -rf .tmp/sim && cp -r .tmp/drop .tmp/sim
    python tools/simulador/harness.py            (pruebas)
    python tools/simulador/harness.py ficha      (capturas para las imágenes de la ficha)
"""
import asyncio, io, json, os, sys
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "capturas")
FALLOS = []

STUB = r"""
window.__ev = []; window.__warn = []; window.__sel = [];
window.powerbi = { visuals: { plugins: {} }, extensibility: {} };
(function(){
 function mkId(k){ return { __k:k, getKey(){return k;}, getSelector(){return {k};}, equals(o){return !!o && o.__k===k;}, includes(o){ return !!o && o.__k===k; } }; }
 window.__persist = [];
 window.__host = {
  eventService: { renderingStarted(){ __ev.push('S'); }, renderingFinished(){ __ev.push('F'); }, renderingFailed(o,m){ __ev.push('X'); console.error('FAILED', m); } },
  createSelectionManager(){ return { select(ids){ __sel.push(ids.length); return Promise.resolve([]); }, clear(){ return Promise.resolve(); }, getSelectionIds(){ return []; },
     hasSelection(){ return false; }, registerOnSelectCallback(){}, showContextMenu(){ return Promise.resolve(); } }; },
  createSelectionIdBuilder(){ const k=[]; return { withCategory(c,i){ k.push(c.source.queryName+'='+c.values[i]); return this; },
     withMeasure(m){ k.push(m); return this; }, withSeries(){ return this; }, createSelectionId(){ return mkId(k.join('|')); } }; },
  createLocalizationManager(){ return { getDisplayName(k){ return k; } }; },
  tooltipService: { enabled(){ return true; }, show(o){ window.__tip = o; }, move(){}, hide(){} },
  subSelectionService: { subSelect(){}, updateRegionOutlines(){} },
  hostCapabilities: { allowInteractions: window.__allow !== false }, locale: window.__locale || 'en-US',
  colorPalette: { isHighContrast: !!window.__sysHC, foreground:{value: window.__sysHC ? '#FFFF00' : '#252423'}, background:{value: window.__sysHC ? '#000000' : '#FFFFFF'},
    foregroundNeutralSecondary:{value:'#605E5C'}, foregroundSelected:{value:'#1AEBFF'},
    getColor(k){ const c=['#118DFF','#12239E','#E66C37','#6B007B','#E044A7','#744EC2']; let h=0; for (const ch of String(k)) h=(h*31+ch.charCodeAt(0))>>>0; return {value:c[h%c.length]}; } },
  fetchMoreData(){ return false; }, persistProperties(p){ __persist.push(p); }, launchUrl(){},
  displayWarningIcon(t, m){ __warn.push(m); }, hideWarningIcon(){},
 };
})();
"""

# (id, jefe, nombre, puesto, departamento, ventas propias o None)
GENTE = [
    ("E01", "", "Marta Puig", "Managing Director", "Management", None),
    ("E02", "E01", "Jordi Vidal", "Sales Director", "Sales", None),
    ("E03", "E01", "Laia Serra", "Operations Director", "Operations", None),
    ("E04", "E01", "Pau Roca", "Finance Manager", "Finance", None),
    ("E05", "E02", "Núria Ferrer", "Area Manager Barcelona", "Sales", None),
    ("E06", "E02", "Marc Soler", "Area Manager Girona", "Sales", None),
    ("E07", "E02", "Anna Mas", "Key Account Horeca", "Sales", 410.0),
    ("E08", "E05", "Joan Prat", "Sales Rep", "Sales", 320.5),
    ("E09", "E05", "Clara Font", "Sales Rep", "Sales", 287.0),
    ("E10", "E05", "Oriol Camps", "Sales Rep", "Sales", 198.4),
    ("E11", "E06", "Eva Pons", "Sales Rep", "Sales", 256.0),
    ("E12", "E06", "Toni Riera", "Sales Rep", "Sales", 174.3),
    ("E13", "E03", "Sergi Bosch", "Warehouse Lead", "Operations", None),
    ("E14", "E03", "Rosa Martí", "Fleet Coordinator", "Operations", None),
    ("E15", "E13", "Xavi Coll", "Picker", "Operations", None),
    ("E16", "E04", "Mireia Sala", "Accountant", "Finance", None),
]


def dv(objects=None, dyn=False, gente=None, value=True):
    g = gente or GENTE
    def cat(role, n, i):
        return {"source": {"displayName": n, "queryName": "S." + n, "roles": {role: True}}, "values": [x[i] for x in g]}
    cats = [cat("employee", "Employee ID", 0), cat("manager", "Manager ID", 1), cat("name", "Name", 2), cat("title", "Job title", 3), cat("department", "Department", 4)]
    vals = []
    if value:
        v = {"source": {"displayName": "Sales", "queryName": "Sum(S.Sales)", "roles": {"value": True}, "isMeasure": True, "format": "#,0.0"}, "values": [x[5] for x in g]}
        if dyn:
            v["objects"] = [{"general": {"formatString": '#,0 "k€"'}} for _ in g]
        vals.append(v)
    return {"metadata": {"columns": [c["source"] for c in cats] + [v["source"] for v in vals], "objects": objects or {}},
            "categorical": {"categories": cats, "values": vals}}


def check(name, ok, detail=""):
    print(f"  {'OK   ' if ok else 'FALLO'} {name}{'  — ' + detail if detail else ''}")
    if not ok: FALLOS.append(name)


async def page(browser, data, W=1000, H=560, sys_hc=False, name=None, locale="en-US", allow=True):
    drop = os.path.join(ROOT, ".tmp", "sim")
    guid = json.load(io.open(os.path.join(drop, "pbiviz.json"), encoding="utf-8"))["visual"]["guid"]
    pg = await browser.new_page(viewport={"width": W, "height": H}, device_scale_factor=2)
    errs = []
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.set_content(f"<html><body style='margin:0;background:#FFFFFF'><div id='host' style='position:relative;width:{W}px;height:{H}px;overflow:hidden'></div></body></html>")
    if os.path.exists(os.path.join(drop, "visual.css")):
        await pg.add_style_tag(path=os.path.join(drop, "visual.css"))
    await pg.add_script_tag(content=f"window.__sysHC = {json.dumps(sys_hc)}; window.__locale = {json.dumps(locale)}; window.__allow = {json.dumps(allow)};")
    await pg.add_script_tag(content=STUB)
    await pg.add_script_tag(path=os.path.join(drop, "visual.js"))
    await pg.evaluate("(g) => { window.__v = powerbi.visuals.plugins[g].create({ element: document.getElementById('host'), host: __host }); }", guid)
    await pg.evaluate("([dv, W, H]) => __v.update({ dataViews: dv ? [dv] : [], viewport: {width: W, height: H}, type: 2, operationKind: 0, viewMode: 1 })", [data, W, H])
    await pg.wait_for_timeout(400)
    if name:
        await pg.screenshot(path=os.path.join(OUT, name + ".png"))
    ev = await pg.evaluate("() => __ev.join('')")
    check(f"{name or 'página'}: sin errores y eventos de render 1:1", not errs and ev.count("S") == ev.count("F") and "X" not in ev, f"eventos {ev} {errs[:2]}")
    return pg


CARD_TEXT = """(id) => { const g = document.querySelector(`g.card[data-id="${id}"]`); return g ? Array.from(g.querySelectorAll('text')).map(t => t.textContent).join(' | ') : null; }"""
OPEN_ALL = {"layout": {"autoDepth": False, "initialDepth": 4}}


async def ficha(b):
    """Capturas para la ficha: tema del informe, estilos, tamaños."""
    async def shot(name, objects, W, H):
        o = json.loads(json.dumps(OPEN_ALL)); o.update(objects)
        pg = await page(b, dv(o), W, H, name=name)
        await pg.close()
    await shot("60_central", {"cards": {"count": "total"}}, 1200, 520)
    await shot("60_hero", {"cards": {"count": "total"}, "layout": {"autoDepth": False, "initialDepth": 4, "clusters": True}}, 1300, 640)
    await shot("60_lr", {"layout": {"autoDepth": False, "initialDepth": 4, "orientation": "lr"}, "cards": {"count": "total"}}, 1000, 760)
    for k, (w, hh) in {"l": (1000, 560), "m": (620, 380), "s": (380, 240)}.items():
        pg = await page(b, dv({}), w, hh, name="61_size_" + k)
        await pg.close()
    for k in ("boardroom", "ledger", "editorial", "signal", "aurora", "terrace"):
        await shot("62_style_" + k, {"style": {"template": k}}, 1200, 520)


async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        if "ficha" in sys.argv:
            await ficha(b); await b.close(); print(f"{len(FALLOS)} fallos"); return

        print("Valor del equipo en la tarjeta del jefe")
        pg = await page(b, dv(OPEN_ALL), name="01_equipo")
        t = await pg.evaluate(CARD_TEXT, "E05")
        check("jefe de área sin ventas propias: su tarjeta suma el equipo (805.9)", t is not None and "805.9" in t, str(t))
        t = await pg.evaluate(CARD_TEXT, "E02")
        check("director comercial: equipo completo (1,646.2)", t is not None and "1,646.2" in t, str(t))
        t = await pg.evaluate(CARD_TEXT, "E08")
        check("comercial: su valor propio (320.5)", t is not None and "320.5" in t, str(t))
        await pg.close()

        print("Formato dinámico")
        pg = await page(b, dv(OPEN_ALL, dyn=True), name="02_formato_dinamico")
        t = await pg.evaluate(CARD_TEXT, "E08")
        check("cadena dinámica común de las filas en la tarjeta", t is not None and "k€" in t, str(t))
        await pg.close()

        print("Accesibilidad")
        o = json.loads(json.dumps(OPEN_ALL)); o["accessibility"] = {"highContrast": "on", "minTextSize": 14, "focusColor": {"solid": {"color": "#D00000"}}, "focusWidth": 5}
        pg = await page(b, dv(o), name="03_accesibilidad")
        st = await pg.evaluate("""() => { const r = document.querySelector('.tcoc'); const box = document.querySelector('g.card rect.box');
            const sizes = Array.from(document.querySelectorAll('g.card text')).filter(t => t.textContent).map(t => parseFloat(t.getAttribute('font-size')));
            return { f: r.style.getPropertyValue('--tcoc-focus') + ' ' + r.style.getPropertyValue('--tcoc-focus-w'), fill: box.getAttribute('fill'), stroke: box.getAttribute('stroke'), min: Math.min(...sizes) }; }""")
        check("alto contraste 'On': tarjeta blanca con borde negro", st["fill"].upper() == "#FFFFFF" and st["stroke"].upper() == "#000000", str(st))
        check("foco en alto contraste: negro y el grosor de la tarjeta (5 px)", st["f"].strip() == "#000000 5px", st["f"])
        check("tamaño mínimo 14 en todo el texto de las tarjetas", st["min"] >= 14, str(st["min"]))
        fm = await pg.evaluate("() => __v.getFormattingModel().cards.map(c => c.uid)")
        check("tarjeta Accessibility en el panel", "accessibility_card" in fm, str(fm))
        await pg.close()
        o = json.loads(json.dumps(OPEN_ALL)); o["accessibility"] = {"focusColor": {"solid": {"color": "#D00000"}}, "focusWidth": 4}
        pg = await page(b, dv(o))
        f = await pg.evaluate("() => { const r = document.querySelector('.tcoc'); return r.style.getPropertyValue('--tcoc-focus') + ' ' + r.style.getPropertyValue('--tcoc-focus-w'); }")
        check("foco sin alto contraste: color y grosor de la tarjeta", f.strip().upper() == "#D00000 4PX", f)
        await pg.close()
        pg = await page(b, dv(OPEN_ALL), sys_hc=True, name="03b_hc_windows")
        st = await pg.evaluate("() => { const box = document.querySelector('g.card rect.box'); return box.getAttribute('stroke'); }")
        check("alto contraste de Windows: borde con el primer plano del sistema", st.upper() == "#FFFF00", st)
        await pg.close()

        print("Tema del informe y estilos")
        pg = await page(b, dv(OPEN_ALL), name="04_tema_informe")
        st = await pg.evaluate("""() => { const n = document.querySelectorAll('g.card text')[1]; const bands = Array.from(document.querySelectorAll('g.card > rect[clip-path]')).map(r => r.getAttribute('fill'));
            return { name: n.getAttribute('fill'), bands: Array.from(new Set(bands)) }; }""")
        check("tema del informe: nombre con la tinta del tema (#252423)", st["name"].upper() == "#252423", str(st))
        theme = {"#118DFF", "#12239E", "#E66C37", "#6B007B", "#E044A7", "#744EC2"}
        check("tema del informe: departamentos con colores del tema", bool(st["bands"]) and all(c.upper() in theme for c in st["bands"]), str(st["bands"]))
        dd = await pg.evaluate("() => { const c = __v.getFormattingModel().cards.find(c => c.uid === 'style_card'); return c.groups[0].slices[0].control.properties.items.map(i => i.value); }")
        check("desplegable de estilo: tema + 6 estilos", dd == ["clean", "boardroom", "ledger", "editorial", "signal", "aurora", "terrace"], str(dd))
        await pg.close()
        for k, bg, ink in (("boardroom", "rgb(22, 38, 61)", "#F2F0E8"), ("aurora", "gradient", "#FFFFFF"), ("ledger", "rgb(251, 248, 239)", "#231F16")):
            o = json.loads(json.dumps(OPEN_ALL)); o["style"] = {"template": k}
            pg = await page(b, dv(o), name=f"05_estilo_{k}")
            st = await pg.evaluate("() => ({ bg: document.querySelector('.tcoc').style.background, name: document.querySelectorAll('g.card text')[1].getAttribute('fill') })")
            check(f"estilo {k}: fondo y tinta del estilo", bg in st["bg"] and st["name"].upper() == ink, str(st))
            await pg.close()
        o = json.loads(json.dumps(OPEN_ALL)); o["style"] = {"template": "corporate"}
        pg = await page(b, dv(o), name="06_plantilla_antigua")
        w = await pg.evaluate("() => { const r = document.querySelector('g.card > rect[clip-path]'); return r ? r.getAttribute('width') : null; }")
        check("plantilla 1.0 'corporate' sigue funcionando (banda a la izquierda, 6 px)", w == "6", str(w))
        await pg.close()

        print("Contraste del texto en cualquier combinación")
        CONTRASTE = """() => { const L = h => { const n = parseInt(h.replace('#','').slice(0,6),16); return [(n>>16)&255,(n>>8)&255,n&255].map(v => { const x=v/255; return x<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4); }).reduce((a,c,i)=>a+c*[0.2126,0.7152,0.0722][i],0); };
            const cr = (a,b) => { const x=L(a), y=L(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); };
            let min = 99, peor = '';
            document.querySelectorAll('g.card').forEach(g => { const f = g.querySelector('rect.box').getAttribute('fill');
              if (!/^#[0-9a-f]{6}$/i.test(f)) return;
              Array.from(g.querySelectorAll('text')).slice(1).forEach(t => { const c = t.getAttribute('fill'); if (!t.textContent || !/^#[0-9a-f]{6}$/i.test(c) || t.closest('g.tog')) return;
                const r = cr(c, f); if (r < min) { min = r; peor = t.textContent + ' ' + c + ' sobre ' + f; } }); });
            return { min, peor }; }"""
        for k in ("clean", "boardroom", "aurora", "ledger", "signal"):
            for pal in ("neon", "okabe"):
                o = json.loads(json.dumps(OPEN_ALL)); o["style"] = {"template": k}; o["colors"] = {"tint": True, "tintStrength": 31, "palette": pal}
                pg = await page(b, dv(o), name=f"10_tinte_{k}_{pal}" if pal == "neon" else None)
                r = await pg.evaluate(CONTRASTE)
                check(f"{k} + tinte {pal}: todo el texto con contraste >= 4,5", r["min"] >= 4.5, f"{r['min']:.2f} {r['peor']}")
                await pg.close()

        print("Jefes que faltan")
        sin_jefes = [x for x in GENTE if x[0] not in ("E05", "E06")]
        pg = await page(b, dv(OPEN_ALL, gente=sin_jefes), name="07_jefes_que_faltan")
        warn = await pg.evaluate("() => __warn.join(' ')")
        check("aviso con los Manager ID que faltan y la causa probable", "E05" in warn and "never blank" in warn, warn[:220])
        await pg.close()

        print("Interacción y textos")
        pg = await page(b, dv(OPEN_ALL), allow=False)
        await pg.click('g.card[data-id="E08"] rect.box', force=True)
        n = await pg.evaluate("() => __sel.length")
        check("allowInteractions = false (hostCapabilities): el clic no selecciona", n == 0, str(n))
        await pg.close()
        pg = await page(b, dv(OPEN_ALL))
        await pg.click('g.card[data-id="E08"] rect.box', force=True)
        n = await pg.evaluate("() => __sel.length")
        check("con interacciones: el clic selecciona", n == 1, str(n))
        await pg.close()
        pg = await page(b, dv(OPEN_ALL), locale="es-ES", name="08_es")
        tt = await pg.evaluate("() => Array.from(document.querySelectorAll('.tcoc-tools button')).map(b => b.title)")
        foot = await pg.evaluate(CARD_TEXT, "E05")
        check("Desktop en español: la barra sale traducida desde el bundle", "Acercar" in tt and "Ajustar a la vista" in tt, str(tt))
        check("Desktop en español: el pie de la tarjeta traducido", foot is not None and "directos" in foot, str(foot))
        await pg.close()
        pg = await page(b, None, 640, 400, name="09_inicio")
        await pg.close()
        await b.close()
    print(f"\n{len(FALLOS)} fallos" + (": " + ", ".join(FALLOS) if FALLOS else ""))
    sys.exit(1 if FALLOS else 0)


if __name__ == "__main__":
    asyncio.run(main())
