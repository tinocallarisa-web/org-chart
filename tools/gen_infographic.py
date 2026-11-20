# -*- coding: utf-8 -*-
"""Infografía y capturas de la ficha de Org Chart 1.1 (1366x768, assets/) con la plantilla común de la web.

Plantilla: C:/tcviz/datos/demo_rtm/infografias.py (la misma de Dynamic Matrix, Box & Whisker, Radar, Treemap y
Marimekko). La ficha web (C:/tcviz/web/src/data.jsx) sigue en 1.0: aquí se actualizan las funciones de la 1.1.
Las imágenes son del simulador (tools/simulador/capturas/60_* a 62_*), que carga el visual real con datos de
Begudes Nord (ficticios). Org Chart es gratuito: no hay Pro ni marca de agua. Cinco imágenes: lo que admite la ficha.

    node build-test.js && rm -rf .tmp/sim && cp -r .tmp/drop .tmp/sim && python tools/simulador/harness.py ficha && python tools/gen_infographic.py
Salida: assets/infographic.png y Screenshot_1..4.png; docs/infographic.html.
"""
import base64, html, mimetypes, os, re, shutil, subprocess, sys, tempfile, urllib.parse
sys.path.insert(0, r"C:\tcviz\datos\demo_rtm")
import infografias as I
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAP = os.path.join(ROOT, "tools", "simulador", "capturas")
ASSETS = os.path.join(ROOT, "assets")
OUT = os.path.join(ROOT, ".tmp", "ficha")
os.makedirs(OUT, exist_ok=True)
e = html.escape
CSS = I.CSS % {"pop": I.uri(os.path.join(I.BASE, "tema", "Poppins"))}
LOGO = I.uri(os.path.join(I.WEB, "logos", "tcviz-logo-light.svg"))
def recorta(n, margen=24):
    """Quita el blanco que deja el visual alrededor del organigrama (encaje con la barra arriba) y guarda <n>_r.png."""
    from PIL import ImageChops
    im = Image.open(os.path.join(CAP, n + ".png")).convert("RGB")
    caja = ImageChops.difference(im, Image.new("RGB", im.size, im.getpixel((2, im.height - 3)))).getbbox()
    if caja:
        x0, y0, x1, y1 = caja
        im = im.crop((max(0, x0 - margen), max(0, y0 - margen), min(im.width, x1 + margen), min(im.height, y1 + margen)))
    im.save(os.path.join(CAP, n + "_r.png"))
    return n + "_r"


cap = lambda n: I.uri(os.path.join(CAP, n + ".png")).replace(" ", "%20")

P = {p["id"]: p for p in I.productos()}["org-chart"]
# 1.1: funciones nuevas sobre la ficha web de la 1.0.
P["features"] = [
    "Two columns draw it: employee ID and manager ID, at any depth",
    "Each manager's card shows the total for their whole team",
    "Opens as many levels as fit with readable names; folded cards show their team size",
    "Search by name, job title, department or ID; show one team with a breadcrumb",
    "Report theme and six TCViz collection styles",
    "Department colors: pick the colour of each department",
    "Accessibility card: forced high contrast, focus colour and width, minimum text size",
    "Card text kept at 4.5:1 contrast on any fill; dynamic format strings",
    "Dotted-line managers, vacancies, photos or initials",
    "Cross-filtering, bookmarks, keyboard navigation, 12 languages; no network calls",
    "100% free: no licence, no limit on people, no watermark",
]
P["quickStart"] = [
    "Install Org Chart by TCViz from Microsoft AppSource",
    "Drag the employee ID into Employee ID and the manager ID into Manager ID",
    "Add Name, Job title, Department, Photo and a measure in Value",
    "Pick a style, set each department's colour, and click a card to filter the report",
]
DATOS = "Sample data: Begudes Nord, a fictitious drinks company"


def autocontenido(h_html, destino):
    """Copia el HTML con cada file:/// incrustado como data URI, para que docs/ no apunte a C:/."""
    t = open(h_html, encoding="utf-8").read()

    def incrusta(m):
        ruta = urllib.parse.unquote(m.group(1).replace("file:///", "")).replace("/", os.sep)
        tipo = mimetypes.guess_type(ruta)[0] or ("font/ttf" if ruta.endswith(".ttf") else "application/octet-stream")
        return "data:%s;base64,%s" % (tipo, base64.b64encode(open(ruta, "rb").read()).decode())
    t = re.sub(r"(file:///[^'\")\s]+)", incrusta, t)
    open(destino, "w", encoding="utf-8", newline="\n").write(t)


def render(h_html, nombre):
    png2x = os.path.join(OUT, nombre + "@2x.png")
    png1x = os.path.join(ASSETS, nombre + ".png")
    subprocess.run([I.EDGE, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=2",
                    "--allow-file-access-from-files", f"--screenshot={png2x}", "--window-size=1366,768", I.uri(h_html).replace(" ", "%20")],
                   capture_output=True, timeout=90)
    Image.open(png2x).convert("RGB").resize((1366, 768), Image.LANCZOS).save(png1x, optimize=True)
    print("  ", os.path.relpath(png1x, ROOT))


TIER = '<span class="pill free">Free · every feature</span>'


def cabecera(titulo, sub):
    return (f'<div class="cab"><img class="logo" src="{LOGO}"><div class="sep"></div>'
            f'<div><h1>{e(titulo)}</h1><p>{e(sub)}</p></div><div class="tier">{TIER}</div></div><div class="raya"></div>')


PIE = (f'<div class="fin"><span>tcviz.com · Power BI custom visual · {e(P["name"])}</span>'
       f'<span>{e(DATOS)} · drawn by the visual</span></div>')


def pagina(nombre, cuerpo, extra_css=""):
    h = os.path.join(OUT, nombre + ".html")
    open(h, "w", encoding="utf-8").write(f'<!doctype html><html><head><meta charset="utf-8"><style>{CSS}{extra_css}</style></head><body>{cuerpo}</body></html>')
    return h


# 1. Infografía general
tmp = tempfile.mkdtemp()
try:
    shutil.copy(os.path.join(CAP, recorta("60_central") + ".png"), os.path.join(tmp, "central_99.png"))
    exp, I.EXP = I.EXP, tmp
    ficha = I.ficha(P, 99, "Who reports to whom, and how big is each team?")
    I.EXP = exp
    viejo = "Sample report on Begudes Nord, a fictitious drinks company — Power BI Desktop, TCViz theme"
    assert viejo in ficha
    ficha = ficha.replace(viejo, DATOS + " — drawn by the visual, Report theme")
    h1 = os.path.join(OUT, "infographic.html")
    open(h1, "w", encoding="utf-8").write(ficha)
    render(h1, "infographic")
    autocontenido(h1, os.path.join(ROOT, "docs", "infographic.html"))
finally:
    shutil.rmtree(tmp, ignore_errors=True)

UNA = """.una{position:absolute;left:24px;right:24px;top:112px;bottom:40px;display:flex;gap:16px}
.una .card{padding:14px;display:flex;align-items:center;justify-content:center;flex:1;min-width:0}
.una img{max-width:100%;max-height:100%;display:block}
.una .lado{flex:0 0 330px;flex-direction:column;align-items:flex-start;justify-content:flex-start}
.una .lado h2{font-size:17px;margin-bottom:8px} .una .lado p{font-size:13.5px;line-height:1.45;color:#444;margin-bottom:10px}
.tres{position:absolute;left:24px;right:24px;top:112px;bottom:40px;display:grid;grid-template-columns:1.55fr 1fr;grid-template-rows:322px 1fr;gap:14px}
.tres .card{padding:10px;display:flex;flex-direction:column;align-items:flex-start;min-height:0;overflow:hidden}
.tres .l{grid-row:1 / span 2}
.tres img{display:block;border:1px solid #EEE}
.tres b{font-size:12.5px;margin-bottom:6px;color:#555}
.est{position:absolute;left:24px;right:24px;top:112px;bottom:40px;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:1fr 1fr;gap:12px}
.est .card{padding:8px;display:flex;flex-direction:column;min-height:0;overflow:hidden}
.est img{flex:1 1 auto;min-height:0;width:100%;object-fit:contain;display:block;border-radius:3px} .est b{font-size:12.5px;margin-top:5px;color:#555}
.dos{position:absolute;left:24px;right:24px;top:112px;bottom:40px;display:grid;grid-template-columns:1fr 1fr;gap:16px}
.dos .card{padding:12px 14px;display:flex;flex-direction:column;min-height:0;overflow:hidden}
.dos .im{flex:1 1 auto;min-height:0;display:flex;align-items:center;justify-content:center}
.dos img{max-width:100%;max-height:100%;display:block;border:1px solid #EEE;border-radius:4px}
.dos h2{font-size:16px;margin-bottom:4px} .dos p{font-size:12.5px;color:#555;margin-bottom:8px;line-height:1.4}"""


def una(n, titulo, sub, img, lado_h, lado_p):
    ps = "".join(f"<p>{e(x)}</p>" for x in lado_p)
    h = pagina(f"Screenshot_{n}", cabecera(titulo, sub) + f"""<div class="una"><div class="card"><img src="{cap(img)}"></div>
<div class="card lado"><h2>{e(lado_h)}</h2>{ps}</div></div>""" + PIE, UNA)
    render(h, f"Screenshot_{n}")


una(1, "What each team adds up to", "Every manager's card shows the total for their whole team; departments grouped and coloured.",
    recorta("60_hero"), "Read the structure and the numbers",
    ["A manager who sells nothing used to show a blank or a zero. Now the card adds up the person and everyone below them.",
     "The tooltip still gives the person's own figure next to the team total.",
     "If a manager's row is missing because their value is blank, the visual says which IDs and how to fix it.",
     "Set the colour of each department yourself in Format → Department colors."])
w = lambda px: f"{px * 0.76:.0f}px"   # las tres a la misma escala
h3 = pagina("Screenshot_2", cabecera("Readable at any size", "The same visual and settings in a large, medium and small slot, at the same scale: it opens as many levels as fit with readable names.") + f"""
<div class="tres"><div class="card l"><b>Large · 1000 × 560</b><img src="{cap('61_size_l')}" style="width:{w(1000)}"></div>
<div class="card"><b>Medium · 620 × 380</b><img src="{cap('61_size_m')}" style="width:{w(620)}"></div>
<div class="card"><b>Small · 380 × 240</b><img src="{cap('61_size_s')}" style="width:{w(380)}"></div></div>""" + PIE, UNA)
render(h3, "Screenshot_2")
est = "".join(f'<div class="card"><img src="{cap(recorta("62_style_" + s, 30))}"><b>{s.title()}</b></div>'
              for s in ("boardroom", "ledger", "editorial", "signal", "aurora", "terrace"))
h4 = pagina("Screenshot_3", cabecera("Six collection styles", "The same looks as the rest of TCViz, so a page with other TCViz visuals reads as one report. Or keep the Report theme.") +
            f'<div class="est">{est}</div>' + PIE, UNA)
render(h4, "Screenshot_3")
h5 = pagina("Screenshot_4", cabecera("Accessible and flexible", "High contrast and larger text from the Format pane, and the same chart from left to right.") + f"""
<div class="dos">
<div class="card"><h2>Accessibility card</h2><p>High contrast forced On (black on white), minimum text size 14: the cards grow to fit. Keyboard focus colour and width.</p><div class="im"><img src="{cap(recorta('60_a11y'))}"></div></div>
<div class="card"><h2>Left to right, Signal style</h2><p>Orientation, compact layout, lines and colours from the Format pane; card text always keeps 4.5:1 contrast.</p><div class="im"><img src="{cap(recorta('60_lr'))}"></div></div>
</div>""" + PIE, UNA)
render(h5, "Screenshot_4")
print("ok")
