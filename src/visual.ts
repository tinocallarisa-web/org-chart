"use strict";

import powerbi from "powerbi-visuals-api";
import { valueFormatter } from "powerbi-visuals-utils-formattingutils";
import { dataViewWildcard } from "powerbi-visuals-utils-dataviewutils";
import {
    HtmlSubSelectableClass, HtmlSubSelectionHelper, SubSelectableDisplayNameAttribute,
    SubSelectableObjectNameAttribute, SubSelectableTypeAttribute,
} from "powerbi-visuals-utils-onobjectutils";
import { buildForest, layoutForest, pathTo, Forest, OrgNode, Layout, Placed } from "./tree";
import { PALETTES, paletteById, ramp, mix } from "./palettes";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import ISelectionId = powerbi.visuals.ISelectionId;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import DataView = powerbi.DataView;

const SVG = "http://www.w3.org/2000/svg";
const GUIDE = "https://tinocallarisa-web.github.io/org-chart/support.html";

// ─── Ajustes ──────────────────────────────────────────────────────────────────

interface Settings {
    template: string;
    width: number; height: number; showPhoto: boolean; photoShape: string; photoRing: boolean; tintStrength: number; showTitle: boolean; showDepartment: boolean;
    count: string; showValue: boolean; fontFamily: string; nameSize: number; nameColor: string; textColor: string;
    fill: string; borderColor: string; borderWidth: number; radius: number; accent: string; shadow: boolean;
    orientation: string; compact: boolean; gapSibling: number; gapLevel: number; autoDepth: boolean; initialDepth: number; clusters: boolean; selectTeam: boolean;
    linkShape: string; linkColor: string; linkWidth: number; dashed: boolean; dotted: boolean; linkByDept: boolean; linkLabel: string;
    colorMode: string; palette: string; lowColor: string; highColor: string; background: string;
    toolbar: boolean; search: boolean; minimap: boolean; breadcrumb: boolean;
    /** Tarjeta teñida con el color del departamento. */
    tint: boolean;
}

const DEFAULTS: Settings = {
    template: "clean",
    width: 200, height: 64, showPhoto: true, photoShape: "circle", photoRing: true, tintStrength: 22, showTitle: true, showDepartment: false,
    count: "direct", showValue: true, fontFamily: "'Segoe UI', wf_segoe-ui_normal, helvetica, arial, sans-serif", nameSize: 12,
    nameColor: "#3D3929", textColor: "#83827D",
    fill: "#FFFFFF", borderColor: "#DAD9D4", borderWidth: 1, radius: 8, accent: "top", shadow: false,
    orientation: "td", compact: true, gapSibling: 16, gapLevel: 40, autoDepth: true, initialDepth: 3, clusters: false, selectTeam: true,
    linkShape: "elbow", linkColor: "#B5B3AA", linkWidth: 1.5, dashed: false, dotted: true, linkByDept: false, linkLabel: "none",
    colorMode: "department", palette: "tcviz", lowColor: "#D6E4F2", highColor: "#1F4E80", background: "",
    toolbar: true, search: true, minimap: true, breadcrumb: true,
    tint: false,
};

/** Plantillas: solo rellenan lo que el usuario no ha tocado. */
const TEMPLATES: Record<string, Partial<Settings>> = {
    none: {},
    clean: {},
    corporate: { accent: "left", radius: 3, shadow: true, borderWidth: 0, photoShape: "square", fontFamily: "'Segoe UI Semibold', 'Segoe UI', sans-serif", linkShape: "elbow" },
    colorful: { tint: true, tintStrength: 30, accent: "none", borderWidth: 0, radius: 12, palette: "vivid", linkByDept: true },
    minimal: { fill: "", borderWidth: 0, accent: "none", linkShape: "curved", showValue: false, count: "none" },
    compact: { width: 160, height: 40, showPhoto: false, showTitle: false, nameSize: 11, gapLevel: 28, gapSibling: 10, radius: 4 },
};

type Objects = powerbi.DataViewObjects | undefined;

function readSettings(objects: Objects): Settings {
    const tplName = (objects?.["style"]?.["template"] as string) || DEFAULTS.template;
    const tpl = TEMPLATES[tplName] || {};
    const pick = <K extends keyof Settings>(obj: string, prop: string, key: K): Settings[K] => {
        const raw = objects?.[obj]?.[prop];
        if (raw !== undefined && raw !== null) {
            if (typeof raw === "object" && (raw as any).solid) return (raw as any).solid.color as Settings[K];
            return raw as Settings[K];
        }
        return (tpl[key] !== undefined ? tpl[key] : DEFAULTS[key]) as Settings[K];
    };
    return {
        template: tplName,
        width: pick("cards", "width", "width"), height: pick("cards", "height", "height"), showPhoto: pick("cards", "showPhoto", "showPhoto"),
        photoShape: pick("cards", "photoShape", "photoShape"), photoRing: pick("cards", "photoRing", "photoRing"), tintStrength: pick("colors", "tintStrength", "tintStrength"), showTitle: pick("cards", "showTitle", "showTitle"),
        showDepartment: pick("cards", "showDepartment", "showDepartment"), count: pick("cards", "count", "count"), showValue: pick("cards", "showValue", "showValue"),
        fontFamily: pick("cards", "fontFamily", "fontFamily"), nameSize: pick("cards", "nameSize", "nameSize"),
        nameColor: pick("cards", "nameColor", "nameColor"), textColor: pick("cards", "textColor", "textColor"),
        fill: pick("cards", "fill", "fill"), borderColor: pick("cards", "borderColor", "borderColor"), borderWidth: pick("cards", "borderWidth", "borderWidth"),
        radius: pick("cards", "radius", "radius"), accent: pick("cards", "accent", "accent"), shadow: pick("cards", "shadow", "shadow"),
        orientation: pick("layout", "orientation", "orientation"), compact: pick("layout", "compact", "compact"),
        gapSibling: pick("layout", "gapSibling", "gapSibling"), gapLevel: pick("layout", "gapLevel", "gapLevel"),
        autoDepth: pick("layout", "autoDepth", "autoDepth"), initialDepth: pick("layout", "initialDepth", "initialDepth"), clusters: pick("layout", "clusters", "clusters"), selectTeam: pick("layout", "selectTeam", "selectTeam"),
        linkShape: pick("links", "shape", "linkShape"), linkColor: pick("links", "color", "linkColor"), linkWidth: pick("links", "width", "linkWidth"),
        dashed: pick("links", "dashed", "dashed"), dotted: pick("links", "dotted", "dotted"), linkByDept: pick("links", "byDepartment", "linkByDept"), linkLabel: pick("links", "label", "linkLabel"),
        colorMode: pick("colors", "mode", "colorMode"), palette: pick("colors", "palette", "palette"),
        lowColor: pick("colors", "lowColor", "lowColor"), highColor: pick("colors", "highColor", "highColor"), background: pick("colors", "background", "background"),
        toolbar: pick("toolbar", "show", "toolbar"), search: pick("toolbar", "search", "search"), minimap: pick("toolbar", "minimap", "minimap"),
        breadcrumb: pick("toolbar", "breadcrumb", "breadcrumb"),
        tint: pick("colors", "tint", "tint"),
    };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo));

interface Person {
    node: OrgNode;
    name: string;
    title: string;
    dept: string;
    photo: string | null;
    value: number | null;
    colorValue: number | null;
    ruleFill: string | null;
    highlighted: boolean;
    id: ISelectionId;
    tooltipExtras: { name: string; value: string }[];
    vacant: boolean;
    /** Responsable funcional (línea discontinua). */
    dotted: string | null;
}

// ─── Visual ───────────────────────────────────────────────────────────────────

export class Visual implements IVisual {
    private host: IVisualHost;
    private root: HTMLDivElement;
    private viewport: HTMLDivElement;
    private svg: SVGSVGElement;
    private content: SVGGElement;
    private toolbarEl: HTMLDivElement;
    private crumbEl: HTMLDivElement;
    private miniEl: HTMLCanvasElement;
    private selectionManager: ISelectionManager;
    private events: powerbi.extensibility.IVisualEventService;
    private loc: powerbi.extensibility.ILocalizationManager;
    private settings: Settings = DEFAULTS;

    private forest: Forest | null = null;
    private people = new Map<string, Person>();
    private layout: Layout | null = null;
    /** Ramas contraídas en este dibujo: se calcula desde el estado de la vista. */
    private collapsed = new Set<string>();
    private focusId: string | null = null;
    /**
     * Estado de la vista que se guarda en el informe (persistProperties): sobrevive a refrescos, filtros y
     * marcadores. No se guarda la lista de lo contraído, sino las excepciones a la regla de profundidad:
     * es pequeño aunque haya miles de personas, y una persona nueva sigue la regla.
     */
    private viewMode: "depth" | "all" | "none" = "depth";
    private opened = new Set<string>();
    private closed = new Set<string>();
    private lastState = "";
    private persistTimer: any = null;
    private autoDepthCache = { key: "", depth: 0 };
    private dataKey = "";
    private layoutKey = "";
    private deptColors = new Map<string, string>();
    private hasHighlights = false;
    private fmtValue: (v: any) => string = (v) => String(v ?? "");
    private valueName = "";

    // Vista: desplazamiento y zoom
    private tx = 0; private ty = 0; private k = 1;
    private W = 0; private H = 0;
    private needsFit = true;
    private searchHits: string[] = [];
    private searchIndex = 0;
    private searchMark: string | null = null;
    private focusIndex: string | null = null;

    public visualOnObjectFormatting: powerbi.extensibility.visual.VisualOnObjectFormatting;
    private subSelectionHelper: HtmlSubSelectionHelper;
    private formatMode = false;

    private lastFetchCount = 0;
    private fetchRounds = 0;
    private truncatedAt = 0;
    private readonly MAX_FETCH_ROUNDS = 60;
    private lastOptions: VisualUpdateOptions | null = null;
    private measureCtx: CanvasRenderingContext2D | null = null;

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.events = options.host.eventService;
        this.loc = options.host.createLocalizationManager();
        this.selectionManager = options.host.createSelectionManager();
        this.injectStyles();

        this.root = document.createElement("div");
        this.root.className = "tcoc";
        options.element.appendChild(this.root);

        this.viewport = document.createElement("div");
        this.viewport.className = "tcoc-vp";
        this.root.appendChild(this.viewport);
        this.svg = document.createElementNS(SVG, "svg") as SVGSVGElement;
        this.svg.setAttribute("role", "tree");
        this.svg.setAttribute("aria-multiselectable", "true");
        this.viewport.appendChild(this.svg);
        const defs = document.createElementNS(SVG, "defs");
        // Recortes reutilizables (en unidades del propio elemento): uno por forma de foto.
        for (const [id, el] of [["tcoc-clip-circle", "<circle cx='.5' cy='.5' r='.5'/>"], ["tcoc-clip-rounded", "<rect width='1' height='1' rx='.22'/>"], ["tcoc-clip-square", "<rect width='1' height='1'/>"]]) {
            const cp = document.createElementNS(SVG, "clipPath");
            cp.setAttribute("id", id); cp.setAttribute("clipPathUnits", "objectBoundingBox");
            const shape = document.createElementNS(SVG, el.indexOf("circle") >= 0 ? "circle" : "rect");
            if (el.indexOf("circle") >= 0) { shape.setAttribute("cx", ".5"); shape.setAttribute("cy", ".5"); shape.setAttribute("r", ".5"); }
            else { shape.setAttribute("width", "1"); shape.setAttribute("height", "1"); if (id.indexOf("rounded") >= 0) shape.setAttribute("rx", ".22"); }
            cp.appendChild(shape); defs.appendChild(cp);
        }
        const flt = document.createElementNS(SVG, "filter");
        flt.setAttribute("id", "tcoc-shadow"); flt.setAttribute("x", "-10%"); flt.setAttribute("y", "-10%"); flt.setAttribute("width", "130%"); flt.setAttribute("height", "150%");
        const ds = document.createElementNS(SVG, "feDropShadow");
        ds.setAttribute("dx", "0"); ds.setAttribute("dy", "1.5"); ds.setAttribute("stdDeviation", "2"); ds.setAttribute("flood-opacity", ".18");
        flt.appendChild(ds); defs.appendChild(flt);
        this.svg.appendChild(defs);
        this.content = document.createElementNS(SVG, "g") as SVGGElement;
        this.svg.appendChild(this.content);

        this.crumbEl = document.createElement("div");
        this.crumbEl.className = "tcoc-crumb";
        this.crumbEl.setAttribute("role", "navigation");
        this.root.appendChild(this.crumbEl);
        this.toolbarEl = document.createElement("div");
        this.toolbarEl.className = "tcoc-tools";
        this.root.appendChild(this.toolbarEl);
        this.miniEl = document.createElement("canvas");
        this.miniEl.className = "tcoc-mini";
        this.root.appendChild(this.miniEl);
        this.buildToolbar();
        this.wireViewport();

        this.subSelectionHelper = HtmlSubSelectionHelper.createHtmlSubselectionHelper({
            hostElement: options.element,
            subSelectionService: options.host.subSelectionService,
            selectionIdCallback: () => undefined,
        });
        this.visualOnObjectFormatting = {
            getSubSelectionStyles: (subs) => this.getSubSelectionStyles(subs),
            getSubSelectionShortcuts: (subs) => this.getSubSelectionShortcuts(subs),
            getSubSelectables: (filter) => this.subSelectionHelper.getAllSubSelectables(filter),
        };
        // Marcadores: Power BI solo devuelve la selección (no el estado interno del visual). Con ella se
        // abren las ramas de las personas seleccionadas y se centra la vista: el marcador enseña a quien guarda.
        this.selectionManager.registerOnSelectCallback((ids) => this.revealSelection(ids as ISelectionId[]));
    }

    private get canInteract(): boolean {
        return (this.host as any).allowInteractions !== false;
    }

    private t(key: string, fallback: string): string {
        try { const v = this.loc.getDisplayName(key); return v && v !== key ? v : fallback; } catch { return fallback; }
    }

    private injectStyles(): void {
        const ID = "tcoc-styles";
        if (document.getElementById(ID)) return;
        const st = document.createElement("style");
        st.id = ID;
        st.textContent = [
            ".tcoc{position:absolute;inset:0;overflow:hidden;font-family:'Segoe UI',sans-serif}",
            ".tcoc-vp{position:absolute;inset:0;overflow:hidden;cursor:grab;touch-action:none}",
            ".tcoc-vp.drag{cursor:grabbing}",
            ".tcoc-vp svg{display:block;width:100%;height:100%}",
            ".tcoc g.card{cursor:pointer;outline:none}",
            ".tcoc g.card:focus-visible rect.box{stroke:#1F4E80!important;stroke-width:2.5px!important}",
            ".tcoc g.card .fbtn{opacity:0;transition:opacity .15s}",
            ".tcoc g.card:hover .fbtn,.tcoc g.card:focus .fbtn{opacity:1}",
            ".tcoc g.tog{cursor:pointer}",
            ".tcoc-tools{position:absolute;top:6px;right:6px;display:flex;gap:4px;align-items:center;background:rgba(255,255,255,.92);border:1px solid #DAD9D4;border-radius:6px;padding:3px}",
            ".tcoc-tools button{border:none;background:transparent;width:24px;height:24px;border-radius:4px;cursor:pointer;color:#535146;display:flex;align-items:center;justify-content:center;padding:0}",
            ".tcoc-tools button:hover{background:#EDE9DE}",
            ".tcoc-tools button:focus-visible,.tcoc-crumb button:focus-visible,.tcwl-link:focus-visible{outline:2px solid #1F4E80;outline-offset:1px}",
            ".tcoc-tools input{border:1px solid #DAD9D4;border-radius:4px;height:22px;width:120px;font:12px 'Segoe UI',sans-serif;padding:0 6px;color:#3D3929}",
            ".tcoc-crumb{position:absolute;top:6px;left:6px;display:flex;flex-wrap:wrap;gap:2px;align-items:center;max-width:60%;font-size:12px;color:#83827D}",
            ".tcoc-crumb button{border:none;background:rgba(255,255,255,.92);border-radius:4px;padding:2px 6px;font:12px 'Segoe UI',sans-serif;color:#2B6CB0;cursor:pointer}",
            ".tcoc-crumb button[aria-current]{color:#3D3929;font-weight:600;cursor:default}",
            ".tcoc-mini{position:absolute;right:6px;bottom:6px;width:140px;height:90px;background:rgba(255,255,255,.92);border:1px solid #DAD9D4;border-radius:6px;cursor:pointer}",
            ".tcwl{font-family:'Segoe UI',sans-serif;color:#3D3929;padding:16px;box-sizing:border-box;height:100%;display:flex;flex-direction:column;justify-content:center;gap:8px;position:absolute;inset:0;background:#fff}",
            ".tcwl h2{font-size:16px;margin:0 0 4px;color:#1F4E80}",
            ".tcwl ol{margin:0;padding-left:20px;font-size:12px;line-height:1.6}",
            ".tcwl p{margin:0;font-size:11px;color:#83827D}",
            ".tcwl-link{border:1px solid #2B6CB0;background:transparent;color:#2B6CB0;border-radius:4px;padding:2px 8px;font:11px 'Segoe UI',sans-serif;cursor:pointer;margin-left:4px}",
            "@media (prefers-reduced-motion: reduce){.tcoc *{transition:none!important}}",
        ].join("\n");
        (document.head || document.body).appendChild(st);
    }

    // ── Update ────────────────────────────────────────────────────────────────

    public update(options: VisualUpdateOptions): void {
        this.events.renderingStarted(options);
        this.lastOptions = options;
        try {
            const dv = options.dataViews?.[0];
            this.settings = readSettings(dv?.metadata?.objects);
            this.formatMode = !!(options as any).formatMode;
            this.subSelectionHelper.setFormatMode(this.formatMode);
            if (dv && this.streamSegments(options, dv)) {
                // Llega otro bloque de filas: dibujar ahora sería un organigrama a medias.
                this.events.renderingFinished(options);
                return;
            }
            this.W = options.viewport.width; this.H = options.viewport.height;
            if (!this.readData(dv)) {
                this.landing();
                this.events.renderingFinished(options);
                return;
            }
            this.root.querySelector(".tcwl")?.remove();
            this.render();
            this.warnings();
            this.updateOutlines(options);
            this.events.renderingFinished(options);
        } catch (e) {
            this.events.renderingFailed(options, String(e));
            console.error("[OrgChart]", e);
        }
    }

    private get isDesktop(): boolean {
        const env = Number((this.host as any)?.hostEnv);
        return isFinite(env) && env > 0 ? (env & 4) !== 0 : false;
    }

    /** Pide los bloques de filas que faltan (más de 30.000). Desktop no los entrega: aviso. */
    private streamSegments(options: VisualUpdateOptions, dv: DataView): boolean {
        if ((options as any).operationKind !== 1) { this.lastFetchCount = 0; this.fetchRounds = 0; }
        this.truncatedAt = 0;
        if (!dv.metadata?.segment) return false;
        const loaded = dv.categorical?.categories?.[0]?.values?.length ?? 0;
        if (!this.isDesktop && loaded > this.lastFetchCount && this.fetchRounds < this.MAX_FETCH_ROUNDS) {
            this.lastFetchCount = loaded;
            this.fetchRounds++;
            if (this.host.fetchMoreData(true)) return true;
        }
        this.truncatedAt = loaded;
        return false;
    }

    private warnings(): void {
        const f = this.forest;
        const msgs: string[] = [];
        const list = (a: string[]) => a.slice(0, 5).join(", ") + (a.length > 5 ? "…" : "");
        if (f?.cycles.length) msgs.push(this.t("UI_WarnCycles", "Reporting loops broken at:") + " " + list(f.cycles) + ".");
        if (f?.duplicates.length) msgs.push(this.t("UI_WarnDuplicates", "Repeated Employee IDs (the first row is used):") + " " + list(f.duplicates) + ".");
        if (f?.missingManagers.length) msgs.push(this.t("UI_WarnMissing", "Manager IDs that are not employees (their people are shown at the top):") + " " + list(f.missingManagers) + ".");
        if (this.truncatedAt) msgs.push((this.isDesktop
            ? this.t("UI_WarnRowsDesktop", "Power BI Desktop sends a visual only the first rows: publish to the Service to see everyone.")
            : this.t("UI_WarnRows", "Power BI sent only part of the rows: the chart shows the rows received.")) + " (" + this.truncatedAt + ")");
        const host: any = this.host;
        if (typeof host.displayWarningIcon === "function") {
            if (msgs.length) host.displayWarningIcon(this.t("UI_WarnTitle", "Org Chart"), msgs.join(" "));
            else if (typeof host.hideWarningIcon === "function") host.hideWarningIcon();
        }
    }

    // ── Datos ─────────────────────────────────────────────────────────────────

    private formatter(format: string | undefined, col?: powerbi.DataViewValueColumn): (v: any) => string {
        const values = (col?.values || []).filter(v => typeof v === "number") as number[];
        const max = values.length ? Math.max(...values.map(Math.abs)) : 0;
        try {
            const f = valueFormatter.create({ format: format || "", value: max >= 1000 ? max : 0, cultureSelector: this.host.locale, displayUnitSystemType: 2 } as any);
            return (v: any) => (v === null || v === undefined ? "" : typeof v === "number" ? f.format(v) : String(v));
        } catch {
            return (v: any) => (v === null || v === undefined ? "" : String(v));
        }
    }

    private readData(dv: DataView | undefined): boolean {
        const cats = dv?.categorical?.categories || [];
        const byRole = (r: string) => cats.find(c => c.source.roles?.[r]);
        const emp = byRole("employee"), mgr = byRole("manager");
        if (!emp || !mgr || !emp.values?.length) { this.forest = null; return false; }
        const dottedC = byRole("dotted");
        const nameC = byRole("name"), titleC = byRole("title"), deptC = byRole("department"), photoC = byRole("photo");
        const vals = dv.categorical.values || ([] as any);
        const valueCol = vals.find?.(v => v.source.roles?.["value"]);
        const colorCol = vals.find?.(v => v.source.roles?.["colorBy"]);
        const tipCols = (vals.filter?.(v => v.source.roles?.["tooltips"]) || []) as powerbi.DataViewValueColumn[];
        this.hasHighlights = !!valueCol?.highlights;
        this.fmtValue = this.formatter(valueCol?.source?.format, valueCol);
        this.valueName = valueCol?.source?.displayName ?? "";
        const num = (x: any) => (typeof x === "number" && Number.isFinite(x) ? x : null);
        const str = (x: any) => (x === null || x === undefined ? "" : String(x).trim());

        const rows = emp.values.map((v, i) => ({ id: str(v), parentId: str(mgr.values[i]) || null, row: i }));
        this.forest = buildForest(rows);
        this.people.clear();
        const tipFmt = tipCols.map(c => this.formatter(c.source.format, c));
        for (const n of this.forest.nodes.values()) {
            const i = n.row;
            const name = str(nameC?.values[i]);
            const ph = str(photoC?.values[i]);
            const fillObj = emp.objects?.[i]?.["cards"]?.["fill"] as any;
            this.people.set(n.id, {
                node: n,
                name: name || (nameC ? "" : n.id),
                title: str(titleC?.values[i]),
                dept: str(deptC?.values[i]),
                photo: /^data:image\/(png|jpe?g|gif|svg\+xml|webp);base64,/i.test(ph) ? ph : null,
                value: valueCol ? num(valueCol.values[i]) : null,
                colorValue: colorCol ? num(colorCol.values[i]) : null,
                ruleFill: fillObj?.solid?.color ?? null,
                highlighted: !this.hasHighlights || num(valueCol?.highlights?.[i]) !== null,
                id: this.host.createSelectionIdBuilder().withCategory(emp, i).createSelectionId(),
                tooltipExtras: tipCols.map((c, k) => ({ name: c.source.displayName, value: tipFmt[k](c.values[i]) })),
                vacant: !!nameC && !name,
                dotted: str(dottedC?.values[i]) || null,
            });
        }
        // Colores por departamento, en orden de aparición
        const pal = paletteById(this.settings.palette);
        const colors = pal.colors.length ? pal.colors : paletteById("tcviz").colors;
        const depts: string[] = [];
        for (const p of this.people.values()) if (p.dept && depts.indexOf(p.dept) < 0) depts.push(p.dept);
        this.deptColors = new Map(depts.map((d, i) => [d, colors[i % colors.length]]));

        // Estado guardado: al abrir el informe o al aplicar un marcador llega distinto del último escrito.
        const raw = dv.metadata?.objects?.["state"]?.["view"] as string | undefined;
        if (raw && raw !== this.lastState) { this.applyState(raw); this.needsFit = true; }
        if (this.focusId && !this.forest.nodes.has(this.focusId)) this.focusId = null;
        const key = String(emp.values.length);
        if (key !== this.dataKey) { this.dataKey = key; this.needsFit = true; }
        return true;
    }

    // ── Colores y texto ───────────────────────────────────────────────────────

    /** Color de grupo de la tarjeta: su departamento o su nivel, según Color by. */
    private deptColor(p: Person): string {
        if (this.settings.colorMode === "level") {
            const pal = paletteById(this.settings.palette);
            const colors = pal.colors.length ? pal.colors : paletteById("tcviz").colors;
            return colors[p.node.depth % colors.length];
        }
        return this.deptColors.get(p.dept) || "#2B6CB0";
    }

    private get groupMode(): boolean {
        return this.settings.colorMode === "department" || this.settings.colorMode === "level";
    }

    // ── Estado de la vista ────────────────────────────────────────────────────

    private applyState(raw: string): void {
        try {
            const o = JSON.parse(raw);
            this.viewMode = o.m === "all" || o.m === "none" ? o.m : "depth";
            this.opened = new Set(Array.isArray(o.o) ? o.o.map(String) : []);
            this.closed = new Set(Array.isArray(o.c) ? o.c.map(String) : []);
            this.focusId = o.f ? String(o.f) : null;
            this.lastState = raw;
        } catch { /* estado ilegible: se ignora */ }
    }

    private persistState(): void {
        const raw = JSON.stringify({ m: this.viewMode, o: Array.from(this.opened), c: Array.from(this.closed), f: this.focusId });
        if (raw === this.lastState) return;
        this.lastState = raw;
        clearTimeout(this.persistTimer);
        // Agrupado: varios clics seguidos se guardan una vez.
        this.persistTimer = setTimeout(() => {
            this.host.persistProperties({ merge: [{ objectName: "state", selector: null as any, properties: { view: raw } }] });
        }, 500);
    }

    /** Ramas contraídas: excepciones del usuario, y si no, la regla (todo, nada o hasta un nivel). */
    private computeCollapsed(depth: number): Set<string> {
        const out = new Set<string>();
        const f = this.forest; if (!f) return out;
        const base = this.focusId ? (f.nodes.get(this.focusId)?.depth ?? 0) : 0;
        for (const n of f.nodes.values()) {
            if (!n.children.length) continue;
            if (this.closed.has(n.id)) { out.add(n.id); continue; }
            if (this.opened.has(n.id)) continue;
            if (this.viewMode === "all") continue;
            if (this.viewMode === "none") { if (n.parent && n.id !== this.focusId) out.add(n.id); continue; }
            if (depth > 0 && n.depth - base >= depth - 1) out.add(n.id);
        }
        return out;
    }

    /**
     * Cuántos niveles abrir para que los nombres se lean (al menos 9 px en pantalla). Se prueba de más
     * a menos niveles con la regla pura; mínimo 2.
     */
    private effectiveDepth(cw: number, ch: number, lr: boolean): number {
        const s = this.settings;
        if (!s.autoDepth) return Math.max(0, Math.round(s.initialDepth));
        const f = this.forest as Forest;
        const key = [this.dataKey, f.nodes.size, this.focusId, Math.round(this.W / 40), Math.round(this.H / 40), cw, ch, s.gapSibling, s.gapLevel, s.compact, lr, s.nameSize].join("|");
        if (key === this.autoDepthCache.key) return this.autoDepthCache.depth;
        let maxD = 1;
        for (const n of f.nodes.values()) maxD = Math.max(maxD, n.depth + 1);
        const aw = Math.max(40, this.W - 32), ah = Math.max(40, this.H - 56);
        const nameSize = clamp(s.nameSize, 8, 28);
        let pick = 2;
        const saveMode = this.viewMode, saveO = this.opened, saveC = this.closed;
        this.viewMode = "depth"; this.opened = new Set(); this.closed = new Set();
        for (let d = Math.min(maxD, 8); d >= 2; d--) {
            const L = layoutForest(this.visibleRoots(), { nodeW: cw, nodeH: ch, gapSibling: clamp(s.gapSibling, 0, 200), gapLevel: clamp(s.gapLevel, 12, 300),
                compact: !!s.compact && !lr, orientation: lr ? "lr" : "td", collapsed: this.computeCollapsed(d) });
            const k = Math.min(aw / Math.max(1, L.width), ah / Math.max(1, L.height), 1);
            if (nameSize * k >= 9) { pick = d; break; }
        }
        this.viewMode = saveMode; this.opened = saveO; this.closed = saveC;
        this.autoDepthCache = { key, depth: pick };
        return pick;
    }

    private cardFill(p: Person, hc: boolean, pal: any): string {
        if (hc) return pal.background?.value ?? "#fff";
        if (p.ruleFill) return p.ruleFill;
        const s = this.settings;
        if (s.colorMode === "value") {
            const all = Array.from(this.people.values()).map(x => x.colorValue ?? x.value).filter(v => v !== null) as number[];
            const v = p.colorValue ?? p.value;
            if (v !== null && all.length) {
                const lo = Math.min(...all), hi = Math.max(...all);
                return ramp([s.lowColor, s.highColor], hi > lo ? (v - lo) / (hi - lo) : 1);
            }
        }
        if (this.groupMode && s.tint && (p.dept || s.colorMode === "level")) return mix(this.deptColor(p), "#FFFFFF", 1 - clamp(s.tintStrength, 0, 100) / 100);
        return s.fill || "transparent";
    }

    private measure(text: string, font: string): number {
        if (!this.measureCtx) this.measureCtx = document.createElement("canvas").getContext("2d");
        if (!this.measureCtx) return text.length * 7;
        this.measureCtx.font = font;
        return this.measureCtx.measureText(text).width;
    }

    private fit(text: string, font: string, max: number): string {
        if (max <= 8) return "";
        if (this.measure(text, font) <= max) return text;
        let lo = 0, hi = text.length;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (this.measure(text.slice(0, mid) + "…", font) <= max) lo = mid; else hi = mid - 1;
        }
        return lo > 0 ? text.slice(0, lo) + "…" : "";
    }

    private initials(name: string): string {
        const parts = name.split(/\s+/).filter(Boolean);
        return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
    }

    // ── Render ────────────────────────────────────────────────────────────────

    private visibleRoots(): OrgNode[] {
        const f = this.forest as Forest;
        if (this.focusId) { const n = f.nodes.get(this.focusId); if (n) return [n]; }
        return f.roots;
    }

    private render(): void {
        const s = this.settings;
        const pal: any = this.host.colorPalette;
        const hc = !!pal.isHighContrast;
        const fg = pal.foreground?.value ?? "#000";
        this.root.style.background = hc ? (pal.background?.value ?? "#fff") : (s.background || "transparent");
        while (this.content.firstChild) this.content.removeChild(this.content.firstChild);

        const cw = clamp(s.width, 80, 600), ch = clamp(s.height, 28, 300);
        const lr = s.orientation === "lr";
        this.collapsed = this.computeCollapsed(this.viewMode === "depth" ? this.effectiveDepth(cw, ch, lr) : 0);
        this.layout = layoutForest(this.visibleRoots(), {
            nodeW: cw, nodeH: ch, gapSibling: clamp(s.gapSibling, 0, 200), gapLevel: clamp(s.gapLevel, 12, 300),
            // Compacto solo de arriba abajo: de izquierda a derecha los equipos ya van en columna.
            compact: !!s.compact && !lr, orientation: lr ? "lr" : "td", collapsed: this.collapsed,
        });
        const L = this.layout;
        this.cardClip(cw, ch, clamp(s.radius, 0, 30));

        // Grupos por departamento, detrás de todo
        if (s.clusters && !hc) {
            for (const pl of L.placed) {
                const p = this.people.get(pl.node.id);
                if (!p?.dept) continue;
                const parent = pl.node.parent ? this.people.get(pl.node.parent.id) : null;
                if (parent && parent.dept === p.dept && L.byId.has(parent.node.id)) continue;
                // Rama visible de este departamento
                let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
                const stack = [pl.node];
                while (stack.length) {
                    const n = stack.pop() as OrgNode;
                    const q = L.byId.get(n.id); const pn = this.people.get(n.id);
                    if (!q || !pn || pn.dept !== p.dept) continue;
                    x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x + cw); y1 = Math.max(y1, q.y + ch);
                    for (const c of n.children) stack.push(c);
                }
                const pad = 10, col = this.deptColors.get(p.dept) || "#2B6CB0";
                const r = this.el("rect", { x: x0 - pad, y: y0 - pad - 14, width: x1 - x0 + pad * 2, height: y1 - y0 + pad * 2 + 14, rx: 10,
                    fill: mix(col, "#FFFFFF", 0.92), stroke: mix(col, "#FFFFFF", 0.6), "stroke-width": 1 });
                this.content.appendChild(r);
                const tl = this.el("text", { x: x0 - pad + 8, y: y0 - pad - 2, "font-size": 10, "font-weight": 600, fill: col, "font-family": s.fontFamily });
                tl.textContent = p.dept;
                this.content.appendChild(tl);
            }
        }

        // Líneas
        const linkG = this.el("g", {});
        this.subSelectable(linkG, "links", this.t("Obj_links", "Lines"), powerbi.visuals.SubSelectionStylesType.Shape);
        this.content.appendChild(linkG);
        for (const e of L.edges) {
            const child = this.people.get(e.to.node.id);
            const color = hc ? fg : (s.linkByDept && child && (child.dept || s.colorMode === "level") ? this.deptColor(child) : s.linkColor);
            const d = this.linkPath(e.from, e.to, e.stacked, cw, ch, lr);
            const path = this.el("path", { d, fill: "none", stroke: color, "stroke-width": clamp(s.linkWidth, 0.5, 8) });
            if (s.dashed) path.setAttribute("stroke-dasharray", "5 4");
            linkG.appendChild(path);
            if (s.linkLabel !== "none" && !e.stacked && child) {
                const txt = s.linkLabel === "team" ? String(1 + e.to.node.total) : this.fmtValue(this.teamValue(e.to.node));
                if (txt) {
                    const [mx, my] = lr ? [e.to.x - clamp(s.gapLevel, 12, 300) / 2, e.to.y + ch / 2] : [e.to.x + cw / 2, e.to.y - clamp(s.gapLevel, 12, 300) / 2 + 4];
                    const lab = this.el("text", { x: mx, y: my, "text-anchor": "middle", "font-size": 10, fill: hc ? fg : s.textColor, "font-family": s.fontFamily,
                        "paint-order": "stroke", stroke: hc ? (pal.background?.value ?? "#fff") : "#FFFFFF", "stroke-width": 3 });
                    lab.textContent = txt;
                    linkG.appendChild(lab);
                }
            }
        }

        // Responsable funcional: línea discontinua curva entre tarjetas visibles
        if (s.dotted) {
            for (const pl of L.placed) {
                const p = this.people.get(pl.node.id);
                const m = p?.dotted ? L.byId.get(p.dotted) : null;
                if (!p || !m || m === pl) continue;
                const [x0, y0] = [m.x + cw / 2, m.y + ch / 2], [x1, y1] = [pl.x + cw / 2, pl.y + ch / 2];
                const dx = x1 - x0, dy = y1 - y0, len = Math.max(1, Math.hypot(dx, dy));
                // Curva hacia un lado para no taparse con la línea recta de mando
                const bend = Math.min(80, len * 0.25), cx = (x0 + x1) / 2 - dy / len * bend, cy = (y0 + y1) / 2 + dx / len * bend;
                const path = this.el("path", { d: `M${x0},${y0} Q${cx},${cy} ${x1},${y1}`, fill: "none", stroke: hc ? fg : "#8E5FC4",
                    "stroke-width": clamp(s.linkWidth, 0.5, 8), "stroke-dasharray": "2 4", "stroke-linecap": "round", opacity: 0.85 });
                linkG.appendChild(path);
            }
        }

        // Tarjetas
        L.placed.forEach((pl, i) => this.drawCard(pl, i, cw, ch, lr, hc, pal));

        this.renderCrumb();
        this.renderToolbarState();
        if (this.needsFit) { this.fitView(); this.needsFit = false; }
        this.applyTransform();
        this.paintSelection();
    }

    /** Un único recorte con la forma de la tarjeta (todas miden lo mismo). */
    private cardClip(cw: number, ch: number, r: number): void {
        const defs = this.svg.querySelector("defs") as SVGDefsElement;
        let cp = defs.querySelector("#tcoc-cardclip");
        if (!cp) { cp = document.createElementNS(SVG, "clipPath"); cp.setAttribute("id", "tcoc-cardclip"); defs.appendChild(cp); }
        while (cp.firstChild) cp.removeChild(cp.firstChild);
        cp.appendChild(this.el("rect", { width: cw, height: ch, rx: r }));
    }

    private teamValue(n: OrgNode): number | null {
        let sum = 0, any = false;
        const stack = [n];
        while (stack.length) {
            const c = stack.pop() as OrgNode;
            const v = this.people.get(c.id)?.value;
            if (v !== null && v !== undefined) { sum += v; any = true; }
            for (const k of c.children) stack.push(k);
        }
        return any ? sum : null;
    }

    private linkPath(a: Placed, b: Placed, stacked: boolean, cw: number, ch: number, lr: boolean): string {
        const shape = this.settings.linkShape;
        if (stacked) {
            // Línea de la columna: baja desde el responsable y entra por el lado de cada tarjeta.
            if (lr) {
                const x0 = a.x + cw * 0.18 / 2 + 4, y0 = a.y + ch;
                const yb = b.y + ch / 2;
                return `M${x0},${y0} V${yb} H${b.x}`;
            }
            const x0 = a.x + Math.round(cw * 0.18) / 2, y0 = a.y + ch;
            return `M${x0},${y0} V${b.y + ch / 2} H${b.x}`;
        }
        let x0: number, y0: number, x1: number, y1: number;
        if (lr) { x0 = a.x + cw; y0 = a.y + ch / 2; x1 = b.x; y1 = b.y + ch / 2; }
        else { x0 = a.x + cw / 2; y0 = a.y + ch; x1 = b.x + cw / 2; y1 = b.y; }
        if (shape === "straight") return `M${x0},${y0} L${x1},${y1}`;
        if (shape === "curved") {
            return lr ? `M${x0},${y0} C${(x0 + x1) / 2},${y0} ${(x0 + x1) / 2},${y1} ${x1},${y1}`
                : `M${x0},${y0} C${x0},${(y0 + y1) / 2} ${x1},${(y0 + y1) / 2} ${x1},${y1}`;
        }
        return lr ? `M${x0},${y0} H${(x0 + x1) / 2} V${y1} H${x1}` : `M${x0},${y0} V${(y0 + y1) / 2} H${x1} V${y1}`;
    }

    private el(tag: string, attrs: Record<string, any>): SVGElement {
        const e = document.createElementNS(SVG, tag) as SVGElement;
        for (const k in attrs) e.setAttribute(k, String(attrs[k]));
        return e;
    }

    private drawCard(pl: Placed, index: number, cw: number, ch: number, lr: boolean, hc: boolean, pal: any): void {
        const s = this.settings;
        const p = this.people.get(pl.node.id);
        if (!p) return;
        const fg = pal.foreground?.value ?? "#000";
        const g = this.el("g", { class: "card", transform: `translate(${pl.x},${pl.y})`, "data-id": p.node.id, role: "treeitem",
            "aria-level": pl.node.depth + 1, tabindex: -1 }) as SVGGElement;
        const label = [p.vacant ? this.t("UI_Vacant", "Vacant") : p.name, p.title, p.dept].filter(Boolean).join(", ")
            + (p.node.direct ? ", " + p.node.direct + " " + this.t("UI_Direct", "direct reports") : "");
        g.setAttribute("aria-label", label);
        if (p.node.children.length) g.setAttribute("aria-expanded", String(!this.collapsed.has(p.node.id)));

        const dept = this.deptColor(p);
        const fill = this.cardFill(p, hc, pal);
        const box = this.el("rect", { class: "box", width: cw, height: ch, rx: clamp(s.radius, 0, 30), fill,
            stroke: hc ? fg : (s.borderWidth > 0 ? s.borderColor : "none"), "stroke-width": hc ? 1.5 : clamp(s.borderWidth, 0, 6) });
        if (p.vacant) box.setAttribute("stroke-dasharray", "4 3");
        if (s.shadow && !hc) box.setAttribute("filter", "url(#tcoc-shadow)");
        g.appendChild(box);
        this.subSelectable(box, "cardBox", this.t("Obj_cards", "Cards"), powerbi.visuals.SubSelectionStylesType.Shape);
        if (!hc && s.accent !== "none" && (s.colorMode === "department" ? !!p.dept : true)) {
            const ac = this.groupMode ? dept : s.borderColor;
            // La banda se recorta con la forma de la tarjeta: sigue sus esquinas redondeadas.
            const band = s.accent === "top" ? { x: 0, y: 0, width: cw, height: 6 } : { x: 0, y: 0, width: 6, height: ch };
            g.appendChild(this.el("rect", { ...band, fill: ac, "clip-path": "url(#tcoc-cardclip)" }));
        }

        // Foto o iniciales
        let tx = 10;
        const showPhoto = s.showPhoto && ch >= 34;
        if (showPhoto) {
            const sz = Math.min(ch - 16, 48), py = (ch - sz) / 2, px = s.accent === "left" ? 14 : 10;
            if (p.photo) {
                const im = this.el("image", { x: px, y: py, width: sz, height: sz, preserveAspectRatio: "xMidYMid slice", "clip-path": `url(#tcoc-clip-${s.photoShape === "square" ? "square" : s.photoShape === "rounded" ? "rounded" : "circle"})` });
                im.setAttribute("href", p.photo);
                g.appendChild(im);
                // Aro con el color del grupo: la paleta se ve también en las tarjetas con foto.
                if (s.photoRing && !hc && this.groupMode && (p.dept || s.colorMode === "level")) {
                    const ring = s.photoShape === "circle"
                        ? this.el("circle", { cx: px + sz / 2, cy: py + sz / 2, r: sz / 2 + 1.5 })
                        : this.el("rect", { x: px - 1.5, y: py - 1.5, width: sz + 3, height: sz + 3, rx: s.photoShape === "rounded" ? sz * 0.22 + 1.5 : 1 });
                    ring.setAttribute("fill", "none"); ring.setAttribute("stroke", dept); ring.setAttribute("stroke-width", "2.5");
                    g.appendChild(ring);
                }
            } else {
                const shapeEl = s.photoShape === "circle"
                    ? this.el("circle", { cx: px + sz / 2, cy: py + sz / 2, r: sz / 2 })
                    : this.el("rect", { x: px, y: py, width: sz, height: sz, rx: s.photoShape === "rounded" ? sz * 0.22 : 0 });
                shapeEl.setAttribute("fill", hc ? fg : (p.vacant ? "#DAD9D4" : (this.groupMode && (p.dept || s.colorMode === "level") ? dept : "#2B6CB0")));
                g.appendChild(shapeEl);
                const it = this.el("text", { x: px + sz / 2, y: py + sz / 2 + sz * 0.13, "text-anchor": "middle", "font-size": Math.round(sz * 0.38), "font-weight": 600,
                    fill: hc ? (pal.background?.value ?? "#fff") : "#FFFFFF", "font-family": s.fontFamily });
                it.textContent = p.vacant ? "?" : this.initials(p.name || p.node.id);
                g.appendChild(it);
            }
            tx = px + sz + 10;
        } else if (s.accent === "left") tx = 12;

        // Textos
        const nameSize = clamp(s.nameSize, 8, 28);
        const smallSize = Math.max(8, Math.round(nameSize * 0.85));
        const right = cw - 8;
        const lines: { text: string; size: number; weight: number; color: string; italic?: boolean }[] = [];
        lines.push({ text: p.vacant ? this.t("UI_Vacant", "Vacant") : p.name, size: nameSize, weight: 600, color: hc ? fg : s.nameColor, italic: p.vacant });
        if (s.showTitle && p.title) lines.push({ text: p.title, size: smallSize, weight: 400, color: hc ? fg : s.textColor });
        if (s.showDepartment && p.dept) lines.push({ text: p.dept, size: smallSize, weight: 400, color: hc ? fg : s.textColor });
        // Pie: recuento y valor
        const foot: string[] = [];
        if (p.node.children.length && s.count !== "none") {
            if (s.count === "direct") foot.push(p.node.direct + " " + this.t("UI_DirectShort", "direct"));
            else if (s.count === "total") foot.push(p.node.total + " " + this.t("UI_TeamShort", "in team"));
            else foot.push(p.node.direct + " / " + p.node.total);
        }
        if (s.showValue && p.value !== null) foot.push(this.fmtValue(p.value));
        if (foot.length) lines.push({ text: foot.join(" · "), size: smallSize, weight: 400, color: hc ? fg : s.textColor });
        const totalH = lines.reduce((a, l) => a + l.size * 1.25, 0);
        const fitLines = totalH > ch - 8 ? lines.slice(0, Math.max(1, Math.floor((ch - 8) / (nameSize * 1.25)))) : lines;
        let y = (ch - fitLines.reduce((a, l) => a + l.size * 1.25, 0)) / 2;
        const textG = this.el("g", {});
        this.subSelectable(textG, "cardText", this.t("UI_CardText", "Card text"), powerbi.visuals.SubSelectionStylesType.Text);
        for (const l of fitLines) {
            y += l.size * 1.02;
            const font = `${l.italic ? "italic " : ""}${l.weight} ${l.size}px ${s.fontFamily}`;
            const te = this.el("text", { x: tx, y, "font-size": l.size, "font-weight": l.weight, fill: l.color, "font-family": s.fontFamily });
            if (l.italic) te.setAttribute("font-style", "italic");
            te.textContent = this.fit(l.text, font, right - tx);
            textG.appendChild(te);
            y += l.size * 0.23;
        }
        g.appendChild(textG);

        // Enfocar esta rama (miga de pan)
        if (p.node.children.length && this.focusId !== p.node.id) {
            const fb = this.el("g", { class: "fbtn", transform: `translate(${cw - 16},${4})`, role: "button", "aria-label": this.t("UI_Focus", "Show only this team") });
            fb.appendChild(this.el("rect", { width: 12, height: 12, rx: 3, fill: "rgba(255,255,255,.9)", stroke: hc ? fg : "#B5B3AA" }));
            fb.appendChild(this.el("path", { d: "M3,6 h6 M6,3 v6", stroke: hc ? fg : "#535146", "stroke-width": 1.4, fill: "none" }));
            fb.appendChild(this.el("circle", { cx: 6, cy: 6, r: 4.2, fill: "none", stroke: hc ? fg : "#535146", "stroke-width": 1 }));
            fb.addEventListener("click", (e) => { e.stopPropagation(); this.setFocus(p.node.id); });
            const ttl = document.createElementNS(SVG, "title"); ttl.textContent = this.t("UI_Focus", "Show only this team"); fb.appendChild(ttl);
            g.appendChild(fb);
        }

        // Abrir / cerrar la rama
        if (p.node.children.length) {
            const closed = this.collapsed.has(p.node.id);
            const [bx, by] = lr ? [cw, ch / 2] : [cw / 2, ch];
            const tg = this.el("g", { class: "tog", transform: `translate(${bx},${by})`, role: "button",
                "aria-label": closed ? this.t("UI_Expand", "Expand") : this.t("UI_Collapse", "Collapse") });
            const lbl = closed ? "+" + p.node.direct : "−";
            const w = closed ? Math.max(18, 8 + lbl.length * 6) : 16;
            tg.appendChild(this.el("rect", { x: -w / 2, y: -8, width: w, height: 16, rx: 8, fill: hc ? (pal.background?.value ?? "#fff") : "#FFFFFF", stroke: hc ? fg : s.linkColor }));
            const tt = this.el("text", { x: 0, y: 4, "text-anchor": "middle", "font-size": 10, "font-weight": 600, fill: hc ? fg : "#535146", "font-family": "'Segoe UI',sans-serif" });
            tt.textContent = lbl;
            tg.appendChild(tt);
            tg.addEventListener("click", (e) => { e.stopPropagation(); this.toggle(p.node.id); });
            g.appendChild(tg);
        }

        if (this.searchMark === p.node.id) {
            g.appendChild(this.el("rect", { x: -4, y: -4, width: cw + 8, height: ch + 8, rx: clamp(s.radius, 0, 30) + 4, fill: "none", stroke: hc ? fg : "#D9A441", "stroke-width": 2.5 }));
        }

        this.wire(g, p);
        if (this.focusIndex === p.node.id || (!this.focusIndex && index === 0)) g.setAttribute("tabindex", "0");
        this.content.appendChild(g);
    }

    // ── Interacción ───────────────────────────────────────────────────────────

    private wire(g: SVGGElement, p: Person): void {
        g.addEventListener("click", (e) => {
            if (this.formatMode || this.dragged) return;
            e.stopPropagation();
            this.select(p, e.ctrlKey || e.metaKey);
        });
        g.addEventListener("dblclick", (e) => { e.stopPropagation(); if (p.node.children.length) this.toggle(p.node.id); });
        g.addEventListener("contextmenu", (e) => {
            e.preventDefault(); e.stopPropagation();
            if (this.canInteract) this.selectionManager.showContextMenu(p.id, { x: e.clientX, y: e.clientY });
        });
        g.addEventListener("mousemove", (e) => this.showTooltip(p, e.clientX, e.clientY));
        g.addEventListener("mouseleave", () => this.host.tooltipService.hide({ immediately: false, isTouchEvent: false }));
        g.addEventListener("keydown", (e: KeyboardEvent) => this.onKey(e, p));
    }

    private onKey(e: KeyboardEvent, p: Person): void {
        const n = p.node;
        const L = this.layout;
        const go = (m: OrgNode | null | undefined) => {
            if (!m || !L?.byId.has(m.id)) return;
            this.focusIndex = m.id;
            const el = this.content.querySelector<SVGGElement>(`g.card[data-id="${CSS.escape(m.id)}"]`);
            this.content.querySelectorAll("g.card").forEach(x => x.setAttribute("tabindex", "-1"));
            if (el) { el.setAttribute("tabindex", "0"); el.focus(); this.ensureVisible(m.id); }
        };
        const sibs = n.parent ? n.parent.children : this.visibleRoots();
        const si = sibs.indexOf(n);
        const lr = this.settings.orientation === "lr";
        let handled = true;
        const toParent = () => go(n.parent && L?.byId.has(n.parent.id) ? n.parent : null);
        const toChild = () => { if (this.collapsed.has(n.id) && n.children.length) this.toggle(n.id); go(n.children[0]); };
        switch (e.key) {
            case "ArrowUp": if (lr) go(sibs[si - 1]); else toParent(); break;
            case "ArrowDown": if (lr) go(sibs[si + 1]); else toChild(); break;
            case "ArrowLeft": if (lr) toParent(); else go(sibs[si - 1]); break;
            case "ArrowRight": if (lr) toChild(); else go(sibs[si + 1]); break;
            case "Home": go(this.visibleRoots()[0]); break;
            case "Enter": case " ": this.select(p, e.ctrlKey || e.metaKey); break;
            case "+": case "-": if (n.children.length) this.toggle(n.id); break;
            case "f": case "F": if (n.children.length) this.setFocus(n.id); break;
            case "Escape": if (this.canInteract) this.selectionManager.clear().then(() => this.paintSelection()); break;
            case "ContextMenu": case "F10": {
                if (e.key === "F10" && !e.shiftKey) { handled = false; break; }
                const r = (e.target as Element).getBoundingClientRect();
                if (this.canInteract) this.selectionManager.showContextMenu(p.id, { x: r.left + r.width / 2, y: r.top });
                break;
            }
            default: handled = false;
        }
        if (handled) { e.preventDefault(); e.stopPropagation(); }
    }

    /** Identidades de la selección: la persona, o la persona y toda su gente. */
    private idsFor(p: Person): ISelectionId[] {
        if (!this.settings.selectTeam || !p.node.children.length) return [p.id];
        const out: ISelectionId[] = [];
        const stack = [p.node];
        while (stack.length) {
            const n = stack.pop() as OrgNode;
            const q = this.people.get(n.id); if (q) out.push(q.id);
            for (const c of n.children) stack.push(c);
        }
        return out;
    }

    private select(p: Person, multi: boolean): void {
        if (!this.canInteract) return;
        const ids = this.idsFor(p);
        const sel = this.selectionManager.getSelectionIds() as ISelectionId[];
        const same = !multi && sel.length === ids.length && ids.every(id => sel.some(s => (s as any).equals?.(id)));
        (same ? this.selectionManager.clear() : this.selectionManager.select(ids, multi)).then(() => this.paintSelection());
    }

    private revealSelection(ids: ISelectionId[]): void {
        const f = this.forest;
        if (!f || !ids?.length) { this.paintSelection(); return; }
        const hit: Person[] = [];
        for (const p of this.people.values()) if (ids.some(s => (s as any).equals?.(p.id))) hit.push(p);
        if (!hit.length) { this.paintSelection(); return; }
        // La cabeza de la selección: quien no tiene a su responsable también seleccionado (un equipo entero
        // seleccionado se reduce a su responsable).
        const sel = new Set(hit.map(p => p.node.id));
        const heads = hit.filter(p => !(p.node.parent && sel.has(p.node.parent.id))).slice(0, 50);
        if (this.focusId && heads.some(h => !pathTo(h.node).some(a => a.id === this.focusId))) this.focusId = null;
        for (const h of heads) {
            for (const a of pathTo(h.node).slice(0, -1)) { this.closed.delete(a.id); this.opened.add(a.id); }
            // Si es un equipo, abrir su primer nivel para que se vea
            if (h.node.children.length && sel.size > 1) { this.closed.delete(h.node.id); this.opened.add(h.node.id); }
        }
        // Sin persistProperties aquí: escribir en el informe mientras Power BI aplica un marcador puede
        // hacer que descarte la selección que acaba de restaurar.
        this.rerender();
        // Centrar en las cabezas
        const L = this.layout; if (!L) return;
        const qs = heads.map(h => L.byId.get(h.node.id)).filter(Boolean) as Placed[];
        if (!qs.length) return;
        const cw = clamp(this.settings.width, 80, 600), ch = clamp(this.settings.height, 28, 300);
        const x0 = Math.min(...qs.map(q => q.x)), x1 = Math.max(...qs.map(q => q.x + cw));
        const y0 = Math.min(...qs.map(q => q.y)), y1 = Math.max(...qs.map(q => q.y + ch));
        if (this.k < 0.6) this.k = 0.8;
        this.tx = this.W / 2 - ((x0 + x1) / 2) * this.k; this.ty = Math.max(40, this.H / 3) - ((y0 + y1) / 2) * this.k;
        this.applyTransform();
    }

    private paintSelection(): void {
        const sel = this.selectionManager.getSelectionIds() as ISelectionId[];
        const has = sel.length > 0;
        this.content.querySelectorAll<SVGGElement>("g.card").forEach(g => {
            const p = this.people.get(g.getAttribute("data-id") || "");
            if (!p) return;
            const on = has ? sel.some(s => (s as any).equals?.(p.id)) : p.highlighted;
            g.style.opacity = on ? "1" : "0.35";
            g.setAttribute("aria-selected", String(has && on));
        });
    }

    private showTooltip(p: Person, x: number, y: number): void {
        const items: powerbi.extensibility.VisualTooltipDataItem[] = [
            { displayName: this.t("UI_TipName", "Name"), value: p.vacant ? this.t("UI_Vacant", "Vacant") : p.name },
        ];
        if (p.title) items.push({ displayName: this.t("UI_TipTitle", "Job title"), value: p.title });
        if (p.dept) items.push({ displayName: this.t("UI_TipDept", "Department"), value: p.dept });
        if (p.node.children.length) {
            items.push({ displayName: this.t("UI_TipDirect", "Direct reports"), value: String(p.node.direct) });
            items.push({ displayName: this.t("UI_TipTeam", "Whole team"), value: String(p.node.total) });
        }
        if (p.value !== null) items.push({ displayName: this.valueName || this.t("UI_TipValue", "Value"), value: this.fmtValue(p.value) });
        if (p.value !== null && p.node.children.length) {
            const tv = this.teamValue(p.node);
            if (tv !== null) items.push({ displayName: (this.valueName || this.t("UI_TipValue", "Value")) + " · " + this.t("UI_TipTeamShort", "team"), value: this.fmtValue(tv) });
        }
        if (p.dotted) {
            const m = this.people.get(p.dotted);
            items.push({ displayName: this.t("UI_TipDotted", "Dotted line to"), value: m ? (m.name || m.node.id) : p.dotted });
        }
        for (const t of p.tooltipExtras) items.push({ displayName: t.name, value: t.value });
        this.host.tooltipService.show({ dataItems: items as any, identities: [p.id], coordinates: [x, y], isTouchEvent: false });
    }

    private toggle(id: string): void {
        if (this.collapsed.has(id)) { this.closed.delete(id); this.opened.add(id); }
        else { this.opened.delete(id); this.closed.add(id); }
        this.persistState();
        this.rerender();
    }

    private setFocus(id: string | null): void {
        this.focusId = id;
        this.needsFit = true;
        if (id) {
            // Al enfocar, abrir al menos el primer nivel de la rama.
            this.closed.delete(id); this.opened.add(id);
        }
        this.persistState();
        this.rerender();
    }

    /** Redibujo por interacción: no es un update() de Power BI, así que no emite eventos de render. */
    private rerender(): void {
        if (!this.forest) return;
        this.render();
    }

    // ── Vista: zoom, desplazamiento, encaje ──────────────────────────────────

    private dragged = false;

    private wireViewport(): void {
        let start: { x: number; y: number; tx: number; ty: number } | null = null;
        this.viewport.addEventListener("pointerdown", (e) => {
            if (e.button !== 0) return;
            if ((e.target as Element).closest?.("g.card") && this.formatMode) return;
            start = { x: e.clientX, y: e.clientY, tx: this.tx, ty: this.ty };
            this.dragged = false;
        });
        window.addEventListener("pointermove", (e) => {
            if (!start) return;
            const dx = e.clientX - start.x, dy = e.clientY - start.y;
            if (!this.dragged && Math.abs(dx) + Math.abs(dy) < 4) return;
            this.dragged = true;
            this.viewport.classList.add("drag");
            this.tx = start.tx + dx; this.ty = start.ty + dy;
            this.applyTransform();
        });
        window.addEventListener("pointerup", () => {
            if (start) setTimeout(() => { this.dragged = false; }, 0);
            start = null;
            this.viewport.classList.remove("drag");
        });
        this.viewport.addEventListener("wheel", (e) => {
            e.preventDefault();
            if (e.ctrlKey || e.metaKey) {
                const r = this.viewport.getBoundingClientRect();
                this.zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top);
            } else {
                this.tx -= e.deltaX; this.ty -= e.deltaY; this.applyTransform();
            }
        }, { passive: false });
        // Clic en vacío: limpiar selección
        this.svg.addEventListener("click", (e) => {
            if (this.dragged || this.formatMode || !this.canInteract) return;
            if (!(e.target as Element).closest?.("g.card")) this.selectionManager.clear().then(() => this.paintSelection());
        });
        this.svg.addEventListener("contextmenu", (e) => {
            if ((e.target as Element).closest?.("g.card")) return;
            e.preventDefault();
            if (this.canInteract) this.selectionManager.showContextMenu({} as ISelectionId, { x: e.clientX, y: e.clientY });
        });
        this.miniEl.addEventListener("click", (e) => {
            const L = this.layout; if (!L) return;
            const r = this.miniEl.getBoundingClientRect();
            const sc = Math.min(r.width / L.width, r.height / L.height);
            const ox = (r.width - L.width * sc) / 2, oy = (r.height - L.height * sc) / 2;
            const cx = (e.clientX - r.left - ox) / sc, cy = (e.clientY - r.top - oy) / sc;
            this.tx = this.W / 2 - cx * this.k; this.ty = this.H / 2 - cy * this.k;
            this.applyTransform();
        });
    }

    private zoomAt(f: number, cx: number, cy: number): void {
        const k2 = clamp(this.k * f, 0.08, 3);
        const real = k2 / this.k;
        this.tx = cx - (cx - this.tx) * real; this.ty = cy - (cy - this.ty) * real;
        this.k = k2;
        this.applyTransform();
    }

    private fitView(): void {
        const L = this.layout; if (!L) return;
        const top = this.settings.breadcrumb || this.settings.toolbar ? 40 : 12;
        const pad = 16;
        const aw = Math.max(40, this.W - pad * 2), ah = Math.max(40, this.H - top - pad);
        // Lo bastante grande para leer: si no cabe todo, se encaja el ancho y se deja desplazar.
        const kFit = Math.min(aw / Math.max(1, L.width), ah / Math.max(1, L.height), 1);
        this.k = Math.max(kFit, Math.min(1, 0.55));
        if (kFit >= 0.55) this.k = kFit;
        this.tx = (this.W - L.width * this.k) / 2;
        this.ty = top + (L.height * this.k < ah ? (ah - L.height * this.k) / 2 : 0);
        if (L.width * this.k > aw) {
            // Más ancho que la vista: centrar la raíz arriba
            const root = L.placed[0];
            if (root) this.tx = this.W / 2 - (root.x + clamp(this.settings.width, 80, 600) / 2) * this.k;
        }
        if (L.height * this.k > ah) {
            // Más alto que la vista (de izquierda a derecha): la raíz a media altura
            const root = L.placed[0];
            if (root) this.ty = Math.min(top, this.H / 2 - (root.y + clamp(this.settings.height, 28, 300) / 2) * this.k);
            if (this.settings.orientation === "lr" && root) this.tx = 16 - root.x * this.k;
        }
    }

    private ensureVisible(id: string): void {
        const L = this.layout; const q = L?.byId.get(id); if (!q) return;
        const cw = clamp(this.settings.width, 80, 600), ch = clamp(this.settings.height, 28, 300);
        const x = q.x * this.k + this.tx, y = q.y * this.k + this.ty;
        if (x < 0 || y < 30 || x + cw * this.k > this.W || y + ch * this.k > this.H) {
            this.tx = this.W / 2 - (q.x + cw / 2) * this.k; this.ty = this.H / 2 - (q.y + ch / 2) * this.k;
            this.applyTransform();
        }
    }

    private applyTransform(): void {
        this.content.setAttribute("transform", `translate(${this.tx},${this.ty}) scale(${this.k})`);
        this.drawMinimap();
    }

    private drawMinimap(): void {
        const L = this.layout;
        const show = this.settings.minimap && !!L && (L.width * this.k > this.W || L.height * this.k > this.H) && this.W > 320 && this.H > 220;
        this.miniEl.style.display = show ? "block" : "none";
        if (!show || !L) return;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const w = 140, h = 90;
        this.miniEl.width = w * dpr; this.miniEl.height = h * dpr;
        const c = this.miniEl.getContext("2d"); if (!c) return;
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        c.clearRect(0, 0, w, h);
        const sc = Math.min((w - 8) / L.width, (h - 8) / L.height);
        const ox = (w - L.width * sc) / 2, oy = (h - L.height * sc) / 2;
        const cw = clamp(this.settings.width, 80, 600), ch = clamp(this.settings.height, 28, 300);
        for (const p of L.placed) {
            const per = this.people.get(p.node.id);
            c.fillStyle = per?.dept ? this.deptColor(per) : "#2B6CB0";
            c.fillRect(ox + p.x * sc, oy + p.y * sc, Math.max(1, cw * sc), Math.max(1, ch * sc));
        }
        c.strokeStyle = "#1F4E80"; c.lineWidth = 1.5;
        c.strokeRect(ox + (-this.tx / this.k) * sc, oy + (-this.ty / this.k) * sc, (this.W / this.k) * sc, (this.H / this.k) * sc);
    }

    // ── Barra de herramientas y miga de pan ──────────────────────────────────

    private searchInput: HTMLInputElement | null = null;

    private button(label: string, svgPath: string, onClick: () => void): HTMLButtonElement {
        const b = document.createElement("button");
        b.type = "button"; b.title = label; b.setAttribute("aria-label", label);
        const s = document.createElementNS(SVG, "svg");
        s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("width", "16"); s.setAttribute("height", "16");
        const p = document.createElementNS(SVG, "path");
        p.setAttribute("d", svgPath); p.setAttribute("fill", "none"); p.setAttribute("stroke", "currentColor"); p.setAttribute("stroke-width", "2");
        p.setAttribute("stroke-linecap", "round"); p.setAttribute("stroke-linejoin", "round");
        s.appendChild(p); b.appendChild(s);
        b.addEventListener("click", (e) => { e.stopPropagation(); onClick(); });
        return b;
    }

    private buildToolbar(): void {
        const inp = document.createElement("input");
        inp.type = "search";
        inp.addEventListener("keydown", (e) => {
            e.stopPropagation();
            if (e.key === "Enter") this.search(inp.value, true);
            if (e.key === "Escape") { inp.value = ""; this.search("", false); }
        });
        inp.addEventListener("input", () => this.search(inp.value, false));
        this.searchInput = inp;
        this.toolbarEl.append(
            inp,
            this.button("Zoom out", "M5 12h14", () => this.zoomAt(1 / 1.25, this.W / 2, this.H / 2)),
            this.button("Zoom in", "M12 5v14M5 12h14", () => this.zoomAt(1.25, this.W / 2, this.H / 2)),
            this.button("Fit", "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5", () => { this.fitView(); this.applyTransform(); }),
            this.button("Expand all", "M7 10l5 5 5-5", () => { this.viewMode = "all"; this.opened.clear(); this.closed.clear(); this.persistState(); this.needsFit = true; this.rerender(); }),
            this.button("Collapse all", "M7 14l5-5 5 5", () => {
                if (!this.forest) return;
                this.viewMode = "none"; this.opened.clear(); this.closed.clear();
                this.persistState(); this.needsFit = true; this.rerender();
            }),
        );
    }

    private renderToolbarState(): void {
        const s = this.settings;
        this.toolbarEl.style.display = s.toolbar && this.W > 260 ? "flex" : "none";
        if (this.searchInput) {
            this.searchInput.style.display = s.search && this.W > 420 ? "block" : "none";
            this.searchInput.placeholder = this.t("UI_Search", "Find a person");
            this.searchInput.setAttribute("aria-label", this.t("UI_Search", "Find a person"));
        }
        const labels = [this.t("UI_ZoomOut", "Zoom out"), this.t("UI_ZoomIn", "Zoom in"), this.t("UI_Fit", "Fit to view"), this.t("UI_ExpandAll", "Expand all"), this.t("UI_CollapseAll", "Collapse all")];
        this.toolbarEl.querySelectorAll("button").forEach((b, i) => { if (labels[i]) { b.title = labels[i]; b.setAttribute("aria-label", labels[i]); } });
    }

    private search(q: string, next: boolean): void {
        const f = this.forest; if (!f) return;
        q = q.trim().toLowerCase();
        if (!q) { this.searchHits = []; this.searchMark = null; this.rerender(); return; }
        if (!next || !this.searchHits.length) {
            this.searchHits = [];
            for (const p of this.people.values()) {
                if ((p.name + " " + p.title + " " + p.dept + " " + p.node.id).toLowerCase().indexOf(q) >= 0) this.searchHits.push(p.node.id);
            }
            this.searchIndex = 0;
        } else this.searchIndex = (this.searchIndex + 1) % this.searchHits.length;
        const id = this.searchHits[this.searchIndex];
        if (!id) { this.searchMark = null; this.rerender(); return; }
        // Abrir el camino hasta la persona, y salir del foco si está fuera de él
        const n = f.nodes.get(id) as OrgNode;
        const path = pathTo(n);
        if (this.focusId && !path.some(x => x.id === this.focusId)) this.focusId = null;
        for (const a of path.slice(0, -1)) { this.closed.delete(a.id); this.opened.add(a.id); }
        this.persistState();
        this.searchMark = id;
        this.rerender();
        const L = this.layout; const qd = L?.byId.get(id);
        if (qd) {
            const cw = clamp(this.settings.width, 80, 600), ch = clamp(this.settings.height, 28, 300);
            if (this.k < 0.6) this.k = 0.8;
            this.tx = this.W / 2 - (qd.x + cw / 2) * this.k; this.ty = this.H / 2 - (qd.y + ch / 2) * this.k;
            this.applyTransform();
        }
    }

    private renderCrumb(): void {
        this.crumbEl.textContent = "";
        const s = this.settings;
        if (!s.breadcrumb || !this.focusId || !this.forest) { this.crumbEl.style.display = "none"; return; }
        const n = this.forest.nodes.get(this.focusId);
        if (!n) { this.crumbEl.style.display = "none"; return; }
        this.crumbEl.style.display = "flex";
        const add = (label: string, onClick: (() => void) | null) => {
            const b = document.createElement("button");
            b.type = "button"; b.textContent = label;
            if (onClick) b.addEventListener("click", (e) => { e.stopPropagation(); onClick(); });
            else b.setAttribute("aria-current", "page");
            this.crumbEl.appendChild(b);
        };
        const sep = () => { const sp = document.createElement("span"); sp.textContent = "›"; sp.setAttribute("aria-hidden", "true"); this.crumbEl.appendChild(sp); };
        add(this.t("UI_All", "Everyone"), () => this.setFocus(null));
        const path = pathTo(n);
        // Rutas largas: primero, "…", y los tres últimos
        const shown = path.length > 5 ? [path[0], null, ...path.slice(-3)] : path;
        for (const a of shown) {
            sep();
            if (!a) { const sp = document.createElement("span"); sp.textContent = "…"; this.crumbEl.appendChild(sp); continue; }
            const p = this.people.get(a.id);
            const label = (p?.vacant ? this.t("UI_Vacant", "Vacant") : p?.name) || a.id;
            add(label, a.id === n.id ? null : () => this.setFocus(a.id));
        }
    }

    // ── Página de inicio ──────────────────────────────────────────────────────

    private landing(): void {
        while (this.content.firstChild) this.content.removeChild(this.content.firstChild);
        this.crumbEl.style.display = "none"; this.toolbarEl.style.display = "none"; this.miniEl.style.display = "none";
        this.root.querySelector(".tcwl")?.remove();
        const box = document.createElement("div");
        box.className = "tcwl";
        const h = document.createElement("h2");
        h.textContent = this.t("UI_LandingTitle", "Org Chart by TCViz");
        const ol = document.createElement("ol");
        for (const [k, fb] of [
            ["UI_Step1", "Drag the person's ID to Employee ID and their manager's ID to Manager ID."],
            ["UI_Step2", "Optional: Name, Job title, Department and Photo for the cards; a measure in Value."],
            ["UI_Step3", "Pick a look in Format > Style template. Click a card to filter the page."],
        ]) {
            const li = document.createElement("li"); li.textContent = this.t(k, fb); ol.appendChild(li);
        }
        const p = document.createElement("p");
        p.textContent = this.t("UI_LandingHelp", "Guide, examples and FAQ: tinocallarisa-web.github.io/org-chart");
        const link = document.createElement("button");
        link.className = "tcwl-link";
        link.textContent = this.t("UI_LandingOpen", "Open the guide");
        link.addEventListener("click", () => this.host.launchUrl(GUIDE));
        p.appendChild(document.createTextNode(" "));
        p.appendChild(link);
        box.append(h, ol, p);
        this.root.appendChild(box);
        this.warnings();
    }

    // ── Formato sobre el lienzo ───────────────────────────────────────────────

    private subSelectable(el: Element, objectName: string, displayName: string, type: powerbi.visuals.SubSelectionStylesType): void {
        if (!this.formatMode) return;
        el.classList.add(HtmlSubSelectableClass);
        el.setAttribute(SubSelectableObjectNameAttribute, objectName);
        el.setAttribute(SubSelectableDisplayNameAttribute, displayName);
        el.setAttribute(SubSelectableTypeAttribute, String(type));
    }

    private updateOutlines(options: VisualUpdateOptions): void {
        if (!this.formatMode) return;
        const subs = (options as any).subSelections as powerbi.visuals.CustomVisualSubSelection[] | undefined;
        this.subSelectionHelper.updateOutlinesFromSubSelections(subs ?? [], true);
    }

    private getSubSelectionStyles(subs: powerbi.visuals.CustomVisualSubSelection[]): powerbi.visuals.SubSelectionStyles | undefined {
        const name = subs[0]?.customVisualObjects[0]?.objectName;
        const ref = (objectName: string, propertyName: string, label: string) => ({ reference: { objectName, propertyName }, label });
        switch (name) {
            case "cardText":
                return {
                    type: powerbi.visuals.SubSelectionStylesType.Text,
                    fontFamily: ref("cards", "fontFamily", this.t("Prop_cards_fontFamily", "Font")),
                    fontSize: ref("cards", "nameSize", this.t("Prop_cards_nameSize", "Name size")),
                    fontColor: ref("cards", "nameColor", this.t("Prop_cards_nameColor", "Name color")),
                } as any;
            case "cardBox":
                return {
                    type: powerbi.visuals.SubSelectionStylesType.Shape,
                    fill: ref("cards", "fill", this.t("Prop_cards_fill", "Card color")),
                    stroke: ref("cards", "borderColor", this.t("Prop_cards_borderColor", "Border color")),
                } as any;
            case "links":
                return {
                    type: powerbi.visuals.SubSelectionStylesType.Shape,
                    stroke: ref("links", "color", this.t("Prop_links_color", "Color")),
                } as any;
        }
        return undefined;
    }

    private getSubSelectionShortcuts(subs: powerbi.visuals.CustomVisualSubSelection[]): powerbi.visuals.VisualSubSelectionShortcuts | undefined {
        const name = subs[0]?.customVisualObjects[0]?.objectName;
        const id = (objectName: string, propertyName: string) => ({ objectName, propertyName });
        const nav = (card: string, label: string) => ({ type: powerbi.visuals.VisualShortcutType.Navigate, destinationInfo: { cardUid: "Visual-" + card + "_card" }, label });
        switch (name) {
            case "cardText":
                return [
                    { type: powerbi.visuals.VisualShortcutType.Toggle, ...id("cards", "showTitle"), relatedToggledFormattingIds: [id("cards", "showTitle")],
                        disabledLabel: this.t("UI_HideTitle", "Hide job title"), enabledLabel: this.t("UI_ShowTitle", "Show job title") },
                    { type: powerbi.visuals.VisualShortcutType.Divider },
                    { type: powerbi.visuals.VisualShortcutType.Reset, relatedResetFormattingIds: [id("cards", "fontFamily"), id("cards", "nameSize"), id("cards", "nameColor")] },
                    nav("cards", this.t("Obj_cards", "Cards")),
                ] as any;
            case "cardBox":
                return [
                    { type: powerbi.visuals.VisualShortcutType.Picker, ...id("style", "template"), label: this.t("Prop_style_template", "Template") },
                    { type: powerbi.visuals.VisualShortcutType.Toggle, ...id("cards", "showPhoto"), relatedToggledFormattingIds: [id("cards", "showPhoto")],
                        disabledLabel: this.t("UI_HidePhoto", "Hide photo"), enabledLabel: this.t("UI_ShowPhoto", "Show photo") },
                    { type: powerbi.visuals.VisualShortcutType.Divider },
                    { type: powerbi.visuals.VisualShortcutType.Reset, relatedResetFormattingIds: [id("cards", "fill"), id("cards", "borderColor"), id("cards", "borderWidth"), id("cards", "radius")] },
                    nav("cards", this.t("Obj_cards", "Cards")),
                ] as any;
            case "links":
                return [
                    { type: powerbi.visuals.VisualShortcutType.Picker, ...id("links", "shape"), label: this.t("Prop_links_shape", "Shape") },
                    { type: powerbi.visuals.VisualShortcutType.Divider },
                    { type: powerbi.visuals.VisualShortcutType.Reset, relatedResetFormattingIds: [id("links", "color"), id("links", "width"), id("links", "shape"), id("links", "dashed")] },
                    nav("links", this.t("Obj_links", "Lines")),
                ] as any;
        }
        return undefined;
    }

    // ── Panel de formato ──────────────────────────────────────────────────────

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        const s = this.settings;
        const T = (k: string, fb: string) => this.t(k, fb);
        const d = (obj: string, prop: string) => ({ objectName: obj, propertyName: prop });
        const num = (obj: string, prop: string, name: string, v: number) => ({ uid: `${obj}_${prop}`, displayName: T(`Prop_${obj}_${prop}`, name), control: { type: powerbi.visuals.FormattingComponent.NumUpDown, properties: { descriptor: d(obj, prop), value: v } } });
        const tog = (obj: string, prop: string, name: string, v: boolean) => ({ uid: `${obj}_${prop}`, displayName: T(`Prop_${obj}_${prop}`, name), control: { type: powerbi.visuals.FormattingComponent.ToggleSwitch, properties: { descriptor: d(obj, prop), value: v } } });
        const font = (obj: string, prop: string, name: string, v: string) => ({ uid: `${obj}_${prop}`, displayName: T(`Prop_${obj}_${prop}`, name), control: { type: powerbi.visuals.FormattingComponent.FontPicker, properties: { descriptor: d(obj, prop), value: v } } });
        const col = (obj: string, prop: string, name: string, v: string, cf = false) => ({
            uid: `${obj}_${prop}`, displayName: T(`Prop_${obj}_${prop}`, name),
            control: { type: powerbi.visuals.FormattingComponent.ColorPicker, properties: {
                descriptor: { ...d(obj, prop), ...(cf ? {
                    instanceKind: powerbi.VisualEnumerationInstanceKinds.ConstantOrRule,
                    selector: dataViewWildcard.createDataViewWildcardSelector(dataViewWildcard.DataViewWildcardMatchingOption.InstancesAndTotals) as any,
                } : {}) },
                value: { value: v || "" },
            } },
        });
        const dd = (obj: string, prop: string, name: string, v: string, items: [string, string, string][]) => {
            const list = items.map(([value, key, fb]) => ({ value, displayName: T(key, fb) }));
            return { uid: `${obj}_${prop}`, displayName: T(`Prop_${obj}_${prop}`, name),
                control: { type: powerbi.visuals.FormattingComponent.Dropdown, properties: { descriptor: d(obj, prop), value: list.find(x => x.value === v) ?? list[0], items: list } as any } };
        };
        const card = (obj: string, name: string, slices: any[]) => ({ uid: `${obj}_card`, displayName: T(`Obj_${obj}`, name), groups: [{ uid: `${obj}_g`, displayName: "", slices }] });

        return {
            cards: [
                card("style", "Style template", [
                    dd("style", "template", "Template", s.template, [["none", "Enum_tpl_none", "None"], ["clean", "Enum_tpl_clean", "Clean"], ["corporate", "Enum_tpl_corporate", "Corporate"],
                        ["colorful", "Enum_tpl_colorful", "Colorful"], ["minimal", "Enum_tpl_minimal", "Minimal"], ["compact", "Enum_tpl_compact", "Compact"]]),
                ]),
                card("cards", "Cards", [
                    num("cards", "width", "Card width", s.width), num("cards", "height", "Card height", s.height),
                    tog("cards", "showPhoto", "Show photo", s.showPhoto),
                    dd("cards", "photoShape", "Photo shape", s.photoShape, [["circle", "Enum_ph_circle", "Circle"], ["rounded", "Enum_ph_rounded", "Rounded"], ["square", "Enum_ph_square", "Square"]]),
                    tog("cards", "photoRing", "Photo ring", s.photoRing),
                    tog("cards", "showTitle", "Show job title", s.showTitle), tog("cards", "showDepartment", "Show department", s.showDepartment),
                    dd("cards", "count", "Team size", s.count, [["none", "Enum_cnt_none", "None"], ["direct", "Enum_cnt_direct", "Direct reports"], ["total", "Enum_cnt_total", "Whole team"], ["both", "Enum_cnt_both", "Direct / whole team"]]),
                    tog("cards", "showValue", "Show value", s.showValue),
                    font("cards", "fontFamily", "Font", s.fontFamily), num("cards", "nameSize", "Name size", s.nameSize),
                    col("cards", "nameColor", "Name color", s.nameColor), col("cards", "textColor", "Text color", s.textColor),
                    col("cards", "fill", "Card color", s.fill, true),
                    col("cards", "borderColor", "Border color", s.borderColor), num("cards", "borderWidth", "Border width", s.borderWidth),
                    num("cards", "radius", "Corner radius", s.radius),
                    dd("cards", "accent", "Department band", s.accent, [["top", "Enum_acc_top", "Top"], ["left", "Enum_acc_left", "Left"], ["none", "Enum_acc_none", "None"]]),
                    tog("cards", "shadow", "Shadow", s.shadow),
                ]),
                card("layout", "Layout", [
                    dd("layout", "orientation", "Orientation", s.orientation, [["td", "Enum_or_td", "Top to bottom"], ["lr", "Enum_or_lr", "Left to right"]]),
                    tog("layout", "compact", "Compact", s.compact),
                    num("layout", "gapSibling", "Space between cards", s.gapSibling), num("layout", "gapLevel", "Space between levels", s.gapLevel),
                    tog("layout", "autoDepth", "Open levels to fit", s.autoDepth),
                    num("layout", "initialDepth", "Levels open at start", s.initialDepth),
                    tog("layout", "clusters", "Group departments", s.clusters),
                    tog("layout", "selectTeam", "Click selects the whole team", s.selectTeam),
                ]),
                card("links", "Lines", [
                    dd("links", "shape", "Shape", s.linkShape, [["elbow", "Enum_ln_elbow", "Elbow"], ["straight", "Enum_ln_straight", "Straight"], ["curved", "Enum_ln_curved", "Curved"]]),
                    col("links", "color", "Color", s.linkColor), num("links", "width", "Width", s.linkWidth),
                    tog("links", "dashed", "Dashed", s.dashed), tog("links", "dotted", "Show dotted-line managers", s.dotted), tog("links", "byDepartment", "Department color", s.linkByDept),
                    dd("links", "label", "Label", s.linkLabel, [["none", "Enum_lab_none", "None"], ["team", "Enum_lab_team", "Team size"], ["value", "Enum_lab_value", "Team value"]]),
                ]),
                card("colors", "Colors", [
                    dd("colors", "mode", "Color by", s.colorMode, [["department", "Enum_col_department", "Department"], ["level", "Enum_col_level", "Level"], ["value", "Enum_col_value", "Color value"], ["single", "Enum_col_single", "Single color"]]),
                    tog("colors", "tint", "Tint cards", s.tint), num("colors", "tintStrength", "Tint strength %", s.tintStrength),
                    dd("colors", "palette", "Palette", s.palette, PALETTES.filter(pp => pp.type === "cat").map(pp => [pp.id, "Enum_pal_" + pp.id, pp.name + (pp.cb ? " (cb)" : "")] as [string, string, string])),
                    col("colors", "lowColor", "Low color", s.lowColor), col("colors", "highColor", "High color", s.highColor),
                    col("colors", "background", "Background", s.background),
                ]),
                card("toolbar", "Toolbar", [
                    tog("toolbar", "show", "Show toolbar", s.toolbar), tog("toolbar", "search", "Search", s.search),
                    tog("toolbar", "minimap", "Minimap", s.minimap), tog("toolbar", "breadcrumb", "Breadcrumb", s.breadcrumb),
                ]),
            ],
        } as any;
    }
}
