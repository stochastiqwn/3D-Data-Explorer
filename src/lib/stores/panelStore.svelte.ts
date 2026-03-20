import { type PanelConfig, type PanelType, PANEL_DEFAULTS } from '../types/panels';

let nextId = 0;
let topZ = 1;

function createPanelStore() {
  let panels = $state<PanelConfig[]>([]);
  let containerW = $state(1200);
  let containerH = $state(700);

  function tilePosition(index: number, total: number): { x: number; y: number; w: number; h: number } {
    const gap = 6;
    const cols = total <= 1 ? 1 : 2;
    const rows = Math.ceil(total / cols);
    const col = index % cols;
    const row = Math.floor(index / cols);
    const cellW = (containerW - gap * (cols + 1)) / cols;
    const cellH = (containerH - gap * (rows + 1)) / rows;
    return {
      x: gap + col * (cellW + gap),
      y: gap + row * (cellH + gap),
      w: cellW,
      h: cellH,
    };
  }

  function retile() {
    const visible = panels.filter((p) => !p.minimized && !p.maximized);
    visible.forEach((p, i) => {
      const pos = tilePosition(i, visible.length);
      p.x = pos.x;
      p.y = pos.y;
      p.w = pos.w;
      p.h = pos.h;
    });
    panels = [...panels];
  }

  return {
    get panels() { return panels; },
    get containerW() { return containerW; },
    get containerH() { return containerH; },

    setContainerSize(w: number, h: number) {
      containerW = w;
      containerH = h;
    },

    addPanel(type: PanelType): PanelConfig | null {
      const pos = tilePosition(panels.length, panels.length + 1);
      topZ++;
      const panel: PanelConfig = {
        id: `panel-${nextId++}`,
        type,
        title: PANEL_DEFAULTS[type].title,
        ...pos,
        zIndex: topZ,
        minimized: false,
        maximized: false,
      };
      panels = [...panels, panel];
      retile();
      return panel;
    },

    removePanel(id: string) {
      panels = panels.filter((p) => p.id !== id);
      retile();
    },

    focusPanel(id: string) {
      topZ++;
      panels = panels.map((p) => (p.id === id ? { ...p, zIndex: topZ } : p));
    },

    movePanel(id: string, x: number, y: number) {
      const target = panels.find((p) => p.id === id);
      if (!target) return;
      x = Math.max(0, Math.min(containerW - target.w, x));
      y = Math.max(0, Math.min(containerH - target.h, y));
      panels = panels.map((p) => (p.id === id ? { ...p, x, y } : p));
    },

    resizePanel(id: string, w: number, h: number) {
      const target = panels.find((p) => p.id === id);
      if (!target) return;
      const { minW, minH } = PANEL_DEFAULTS[target.type];
      w = Math.max(minW, Math.min(containerW - target.x, w));
      h = Math.max(minH, Math.min(containerH - target.y, h));
      panels = panels.map((p) => (p.id === id ? { ...p, w, h } : p));
    },

    minimizePanel(id: string) {
      panels = panels.map((p) => {
        if (p.id !== id) return p;
        return p.minimized
          ? { ...p, minimized: false }
          : { ...p, minimized: true, maximized: false };
      });
    },

    maximizePanel(id: string) {
      panels = panels.map((p) => {
        if (p.id !== id) return p;
        if (p.maximized) {
          const r = p.savedRect ?? { x: 50, y: 50, w: 400, h: 300 };
          return { ...p, maximized: false, ...r, savedRect: undefined };
        }
        return {
          ...p,
          maximized: true,
          minimized: false,
          savedRect: { x: p.x, y: p.y, w: p.w, h: p.h },
          x: 0, y: 0, w: containerW, h: containerH,
        };
      });
    },

    tileAll() { retile(); },

    clear() { panels = []; },
  };
}

export const panelStore = createPanelStore();
