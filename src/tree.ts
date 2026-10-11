/**
 * Árbol del organigrama a partir de filas empleado → responsable, y su colocación.
 *
 * Sin dependencias: la colocación es un "tidy tree" por contornos (cada rama se coloca lo más
 * cerca posible de la anterior sin solaparse a ninguna profundidad, y el responsable se centra
 * sobre sus subordinados). Coste O(n · profundidad), suficiente para miles de personas.
 */

export interface OrgNode {
    id: string;
    parentId: string | null;
    /** Fila del dataView de la que sale (la primera, si el ID se repite). */
    row: number;
    children: OrgNode[];
    parent: OrgNode | null;
    depth: number;
    /** Personas a cargo: directas y totales (toda la rama). */
    direct: number;
    total: number;
}

export interface Forest {
    nodes: Map<string, OrgNode>;
    roots: OrgNode[];
    /** IDs repetidos (se usa la primera fila). */
    duplicates: string[];
    /** Responsables que no existen como empleados: su gente se muestra como raíz. */
    missingManagers: string[];
    /** Ciclos rotos: el nodo indicado pasa a ser raíz. */
    cycles: string[];
}

export function buildForest(rows: { id: string; parentId: string | null; row: number }[]): Forest {
    const nodes = new Map<string, OrgNode>();
    const duplicates: string[] = [];
    for (const r of rows) {
        if (!r.id) continue;
        if (nodes.has(r.id)) { duplicates.push(r.id); continue; }
        nodes.set(r.id, { id: r.id, parentId: r.parentId && r.parentId !== r.id ? r.parentId : null, row: r.row,
            children: [], parent: null, depth: 0, direct: 0, total: 0 });
    }
    const missing = new Set<string>();
    for (const n of nodes.values()) {
        if (n.parentId === null) continue;
        const p = nodes.get(n.parentId);
        if (!p) { missing.add(n.parentId); n.parentId = null; continue; }
        n.parent = p;
    }
    // Ciclos: subir por los responsables; si se vuelve a un nodo del mismo recorrido, se corta ahí.
    const cycles: string[] = [];
    const state = new Map<string, number>();   // 1 = en el recorrido, 2 = resuelto
    for (const start of nodes.values()) {
        if (state.get(start.id) === 2) continue;
        const path: OrgNode[] = [];
        let n: OrgNode | null = start;
        while (n && state.get(n.id) !== 2) {
            if (state.get(n.id) === 1) {
                // n está en el ciclo: pasa a ser raíz
                cycles.push(n.id);
                n.parent = null; n.parentId = null;
                break;
            }
            state.set(n.id, 1); path.push(n);
            n = n.parent;
        }
        for (const p of path) state.set(p.id, 2);
    }
    const roots: OrgNode[] = [];
    for (const n of nodes.values()) {
        if (n.parent) n.parent.children.push(n); else roots.push(n);
    }
    // Profundidad y recuentos, sin recursión (las cadenas de mando pueden ser largas)
    const order: OrgNode[] = [];
    const stack = roots.slice().reverse();
    for (const r of roots) r.depth = 0;
    while (stack.length) {
        const n = stack.pop() as OrgNode;
        order.push(n);
        for (let i = n.children.length - 1; i >= 0; i--) { n.children[i].depth = n.depth + 1; stack.push(n.children[i]); }
    }
    for (let i = order.length - 1; i >= 0; i--) {
        const n = order[i];
        n.direct = n.children.length;
        n.total = n.children.reduce((s, c) => s + 1 + c.total, 0);
    }
    return { nodes, roots, duplicates, missingManagers: Array.from(missing), cycles };
}

export interface LayoutOptions {
    nodeW: number;
    nodeH: number;
    /** Separación entre hermanos y entre niveles. */
    gapSibling: number;
    gapLevel: number;
    /** Subordinados sin gente a cargo apilados en columna bajo su responsable. */
    compact: boolean;
    /** "td": de arriba abajo; "lr": de izquierda a derecha. */
    orientation: "td" | "lr";
    /** Nodos con la rama contraída. */
    collapsed: Set<string>;
}

export interface Placed {
    node: OrgNode;
    /** Esquina superior izquierda de la tarjeta, en coordenadas del lienzo. */
    x: number;
    y: number;
    /** Tiene hijos ocultos por estar contraído. */
    hasHidden: boolean;
    /** Colocado en columna (modo compacto). */
    stacked: boolean;
}

export interface Edge { from: Placed; to: Placed; stacked: boolean }

export interface Layout { placed: Placed[]; edges: Edge[]; width: number; height: number; byId: Map<string, Placed> }

/** Contorno de una rama: por cada fila (nivel o hueco de columna), el x mínimo y máximo ocupados. */
interface Sub { node: OrgNode; x: number; kids: Sub[]; stacked: boolean; left: number[]; right: number[]; rows: number }

/**
 * Coloca los árboles visibles. En "lr" se calcula como "td" con ancho y alto intercambiados y
 * al final se giran las coordenadas.
 */
export function layoutForest(roots: OrgNode[], o: LayoutOptions): Layout {
    const lr = o.orientation === "lr";
    const W = lr ? o.nodeH : o.nodeW, H = lr ? o.nodeW : o.nodeH;
    const gapS = o.gapSibling, gapL = o.gapLevel;
    // En modo compacto, una columna de subordinados ocupa filas de esta altura.
    const stackRowH = H + Math.max(8, gapS * 0.6);
    const levelH = H + gapL;
    // Las filas del contorno se miden en "medias filas" para mezclar niveles y columnas.
    const unit = Math.min(levelH, stackRowH) / 2;
    const rowsOf = (h: number) => Math.max(1, Math.ceil(h / unit));

    const visibleKids = (n: OrgNode) => (o.collapsed.has(n.id) ? [] : n.children);

    const build = (n: OrgNode): Sub => {
        const kids = visibleKids(n);
        const s: Sub = { node: n, x: 0, kids: [], stacked: false, left: [], right: [], rows: 0 };
        const nodeRows = rowsOf(levelH);
        if (!kids.length) {
            s.left = new Array(nodeRows).fill(0); s.right = new Array(nodeRows).fill(W); s.rows = nodeRows;
            return s;
        }
        const allLeaves = kids.every(k => !visibleKids(k).length);
        if (o.compact && allLeaves && kids.length > 1) {
            // Columna: los subordinados cuelgan a la derecha de una línea vertical bajo el responsable.
            s.stacked = true;
            const indent = Math.round(W * 0.18);
            const colRows = rowsOf(levelH) + Math.ceil(kids.length * stackRowH / unit);
            s.left = new Array(colRows).fill(0);
            s.right = new Array(colRows).fill(Math.max(W, indent + W));
            s.rows = colRows;
            s.kids = kids.map(k => ({ node: k, x: indent, kids: [], stacked: true, left: [], right: [], rows: 0 }));
            return s;
        }
        const subs = kids.map(build);
        // Colocar cada hijo pegado al contorno acumulado de los anteriores.
        const accL: number[] = [], accR: number[] = [];
        for (const c of subs) {
            let shift = 0;
            if (accR.length) {
                let need = -Infinity;
                for (let i = 0; i < Math.min(accR.length, c.rows); i++) need = Math.max(need, accR[i] + gapS - c.left[i]);
                shift = need === -Infinity ? 0 : need;
            }
            c.x = shift;
            for (let i = 0; i < c.rows; i++) {
                const l = c.left[i] + shift, r = c.right[i] + shift;
                if (i >= accR.length) { accL.push(l); accR.push(r); }
                else { accL[i] = Math.min(accL[i], l); accR[i] = Math.max(accR[i], r); }
            }
        }
        // Centrar el responsable sobre el primer y el último subordinado directo.
        const first = subs[0], last = subs[subs.length - 1];
        const center = (first.x + last.x + W) / 2;
        const px = center - W / 2;
        // Re-basar: el padre en 0
        for (const c of subs) c.x -= px;
        s.kids = subs;
        const top = rowsOf(levelH);
        s.rows = top + accR.length;
        s.left = new Array(top).fill(0).concat(accL.map(v => v - px));
        s.right = new Array(top).fill(W).concat(accR.map(v => v - px));
        return s;
    };

    const placed: Placed[] = [];
    const edges: Edge[] = [];
    const byId = new Map<string, Placed>();
    let offset = 0;
    let maxX = 0, maxY = 0;
    const emit = (s: Sub, ax: number, ay: number, parent: Placed | null) => {
        const p: Placed = { node: s.node, x: ax, y: ay, hasHidden: o.collapsed.has(s.node.id) && s.node.children.length > 0, stacked: s.stacked };
        placed.push(p); byId.set(s.node.id, p);
        maxX = Math.max(maxX, ax + W); maxY = Math.max(maxY, ay + H);
        if (parent) edges.push({ from: parent, to: p, stacked: false });
        if (s.stacked) {
            s.kids.forEach((k, i) => {
                const kp: Placed = { node: k.node, x: ax + k.x, y: ay + levelH + i * stackRowH, hasHidden: o.collapsed.has(k.node.id) && k.node.children.length > 0, stacked: true };
                placed.push(kp); byId.set(k.node.id, kp);
                maxX = Math.max(maxX, kp.x + W); maxY = Math.max(maxY, kp.y + H);
                edges.push({ from: p, to: kp, stacked: true });
            });
            return;
        }
        for (const k of s.kids) emit(k, ax + k.x, ay + levelH, p);
    };
    // Varias raíces (o responsables que faltan): una al lado de otra.
    for (const r of roots) {
        const s = build(r);
        const minL = Math.min(...s.left);
        emit(s, offset - minL, 0, null);
        offset += Math.max(...s.right) - minL + gapS * 2;
    }
    // Llevar todo a x >= 0
    const minX = placed.reduce((m, p) => Math.min(m, p.x), 0);
    if (minX < 0) { for (const p of placed) p.x -= minX; maxX -= minX; }

    if (lr) {
        for (const p of placed) { const t = p.x; p.x = p.y; p.y = t; }
        return { placed, edges, width: maxY, height: maxX, byId };
    }
    return { placed, edges, width: maxX, height: maxY, byId };
}

/** Ruta desde la raíz hasta el nodo (para la miga de pan). */
export function pathTo(n: OrgNode): OrgNode[] {
    const out: OrgNode[] = [];
    for (let c: OrgNode | null = n; c; c = c.parent) out.unshift(c);
    return out;
}
