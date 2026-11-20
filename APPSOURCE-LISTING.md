# AppSource Listing — Org Chart by TCViz v1.1.0.0

Texto listo para pegar en Partner Center. **Editar este fichero no cambia la oferta**: cada campo hay
que pegarlo a mano en la consola.

Reglas de esta ficha: sin comparaciones con otros visuales, ni siquiera implícitas; sin superlativos
que no se puedan probar; "Power BI" siempre con esa capitalización (rechazo 100.7.1).

**1.1.0.0 cambia la descripción**, porque cambia lo que recibe el usuario: la tarjeta del responsable
muestra el total de su equipo, el aviso de jefes que faltan da la causa y la solución, Report theme y
seis estilos de la colección TCViz (salen las plantillas 1.0), tarjeta Department colors, tarjeta
Accessibility, formato dinámico y textos del visual traducidos en Desktop. La descripción se pega en
**HTML**: `python C:\tcviz\utillaje\ficha_html.py "C:\tcviz\dev\OrgChart"` escribe
`docs/APPSOURCE-DESCRIPTION.html` (se pega el código, con las etiquetas a la vista). Medido: ver
"Recuento" abajo.

---

## Offer ID / alias

```
org-chart-tcviz
```
Alias: `Org Chart by TCViz`. Oferta **gratuita**: "Mi oferta no requiere la compra de un servicio y no
ofrece compras desde la aplicación".

## Offer name

```
Org Chart by TCViz
```

## Search results summary (max 100 characters)

```
Free org chart for Power BI: employee and manager IDs, photos, search, breadcrumb. No licence.
```

Sin cambios en 1.1.0.0 (94 caracteres).

## Keywords (3)

```
organization chart
employee hierarchy
hr analytics
```

- `organization chart` — el término largo; "org chart" ya está en el nombre de la oferta.
- `employee hierarchy` — quien ya tiene la tabla empleado/responsable y busca cómo dibujarla.
- `hr analytics` — el público que construye estos informes.

Sin cambios en 1.1.0.0.

**Al publicarse:** Flow Chart lleva la keyword "Organization Chart" (apuesta de septiembre). Cambiarla
en Flow Chart para no competir con nosotros mismos.

## Categorías y sector

- Categorías: **Infográficos** y **Flujo** (jerarquía).
- Sector: **Servicios profesionales**.
- Contrato: propio, `https://tinocallarisa-web.github.io/org-chart/terms.html`.

## Video

```
https://www.youtube.com/watch?v=l4t8RYL8Lgw
```

Sin cambios en 1.1.0.0 (el vídeo es el de la 1.0). Solo la URL canónica (política 100.3.3.3).

---

## Description

```
An org chart should answer two questions in a second: who reports to whom, and how big each team is. With a large organisation, most charts either shrink to text nobody can read or need a separate column for every level. And a sales manager who sells nothing shows an empty card, when what you wanted to see was the whole team's number.

Org Chart by TCViz is a free Power BI visual — every feature, no licence, no limit on people, no watermark. Two columns of your model draw it: the employee ID and the manager ID, at any depth. Add names, job titles, departments, photos and a measure: it opens as many levels as fit with every name readable, and each manager's card shows the total of their whole team.

BEST FOR

• HR reviews: headcount, cost or FTE by team, from the CEO down
• Sales organisations: each manager's card with the team's sales
• Any parent–child table: cost centres, legal entities, a chart of accounts

WHAT'S NEW IN 1.1.0.0

• Manager cards show the team total (the manager plus everyone below); the tooltip keeps the person's own value
• Missing managers explained: the warning gives the likely cause (a blank Value) and the fix
• Report theme plus six TCViz collection styles: Boardroom, Ledger, Editorial, Signal, Aurora, Terrace
• Department colors: pick the colour of each department
• An Accessibility card, dynamic format strings, and the visual's own texts translated in Power BI Desktop

FIND ANYONE IN A LARGE ORGANISATION

• Opens as many levels as fit with readable names; each folded card shows how many people report to it
• Open or close one level at a time, one branch, or everything
• Show only one team, with a breadcrumb (Everyone › CEO › CFO) to go back up
• Search by name, job title, department or ID: the branch opens and the person is marked
• Zoom, pan, fit to view, a minimap, and a compact layout so wide teams fit

THE CARDS

• Photo or initials, name, job title, department, team size
• A measure on each card (cost, FTE, sales), with the team total on managers' cards
• Vacancies from rows without a name; dotted-line managers for matrix teams

LOOK

• Report theme, or one of six styles shared with the other TCViz visuals
• Colour by department, level, value or a single colour; a colour picker per department
• Tinted cards, department groups, elbow, straight or curved lines with labels
• Conditional formatting (fx): rules that colour each card by its result

WORKS LIKE A NATIVE VISUAL

• Click a manager to filter the page by their whole team, or just by them; Ctrl+click for more
• Highlighting, bookmarks that restore the selection, context menu; "Edit interactions" is respected
• Tooltips and report page tooltips; dynamic format strings, so labels match the rest of your report
• Format on the canvas; 12 languages; more than 30,000 rows in the Power BI service

ACCESSIBILITY

• Keyboard navigation through the tree, with screen reader labels
• High contrast follows Windows, or can be turned on for the visual alone
• Focus colour and width, and a minimum text size: cards grow taller to fit
• 4.5:1 contrast for card text on any fill; 4 colour-blind safe palettes

REAL DATA

Several people at the top, reporting loops, repeated IDs and managers missing from the data do not break the chart: it draws what it can and the warning icon says what it found and how to fix it.

PRIVACY

The visual has no network permission, so Power BI does not let it send or load anything. That is why photos have to be stored in the model as Base64: a link to a photo on a web server is not loaded, on purpose.

GETTING STARTED

You need a table with an employee ID and a manager ID column.
1. Drag the person's ID to Employee ID and their manager's ID to Manager ID.
2. Optional: Name, Job title, Department, Photo, and a measure in Value.
3. Format → Style template.

Documentation, FAQ and examples: https://tinocallarisa-web.github.io/org-chart/support.html
Questions: https://github.com/tinocallarisa-web/org-chart/discussions
Support: support@tcviz.com
```

**Recuento** (`ficha_html.py`, 20-11-2026): 4.595 caracteres, **4.657 contando saltos como CRLF** / 5.000. El script escribe el HTML junto a este `.md` (raíz); se ha movido a `docs/APPSOURCE-DESCRIPTION.html` (y su `.preview.html`). Si se regenera, moverlo otra vez.

---

## URLs

| Campo | URL |
|---|---|
| Soporte / documentación | https://tinocallarisa-web.github.io/org-chart/support.html |
| Privacidad | https://tinocallarisa-web.github.io/org-chart/privacy.html |
| Términos | https://tinocallarisa-web.github.io/org-chart/terms.html |
| Vídeo | https://www.youtube.com/watch?v=l4t8RYL8Lgw |

## Imágenes de la oferta — 1.1.0.0

5 imágenes, **en este orden**, 1366x768:

1. `assets/infographic.png` — infografía general.
2. `assets/Screenshot_1.png` — tarjetas de responsable con el total del equipo (vista principal).
3. `assets/Screenshot_2.png` — tres tamaños.
4. `assets/Screenshot_3.png` — los seis estilos de la colección.
5. `assets/Screenshot_4.png` — Accessibility: alto contraste y texto mínimo grande, de izquierda a derecha.

**Quitar en Partner Center** las antiguas: `Infograma.png`, `Infograma-estilos.png` y el
`Screenshot_1` antiguo. En la 1.1.0.0 no hay `infographic-styles.png`.

---

## Qué hay que pegar a mano en Partner Center — 1.1.0.0

1. **Paquete** `_releases/orgChartTCVizB36215279C0F4E9B93D25094C04F6842.1.1.0.0.pbiviz` (build de
   producción, solo tras confirmación).
2. **.pbix de ejemplo** guardado con el paquete 1.1.0.0 y sin visual `_test`, con un jefe sin valor en
   Value para que el revisor vea el aviso (y la solución con un recuento de filas en Tooltips).
3. **Descripción** — el **código HTML** de `docs/APPSOURCE-DESCRIPTION.html` (no el texto de arriba
   ni lo copiado de la vista previa). Cambia en esta versión.
4. **Imágenes** — las 5 de arriba en ese orden; quitar `Infograma.png`, `Infograma-estilos.png` y el
   `Screenshot_1` antiguo.
5. **Notas de certificación** — `docs/CERTIFICATION-NOTES-SHORT.txt`. El campo se vacía en cada
   reenvío.

Resumen de búsqueda, palabras clave, categorías y vídeo se quedan como en la 1.0.0.0. Vídeo solo como
`https://www.youtube.com/watch?v=l4t8RYL8Lgw`.

## Checklist de envío

- [ ] Rama `certification` = lo que se envía (Etapa 7 de la skill `pbiviz-appsource`)
- [ ] `python C:/tcviz/utillaje/auditar-envio.py "C:/tcviz/dev/OrgChart"` en verde
- [ ] Paquete de producción 1.1.0.0 en `_releases/`
- [ ] `.pbix` 1.1.0.0 sin `_test`
- [ ] Descripción en HTML ≤ 5.000, notas ≤ 2.500 contando CRLF
- [ ] 5 imágenes en orden; antiguas quitadas
- [ ] Notas de certificación pegadas
