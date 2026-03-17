import { type PanelConfig, type PanelType, PANEL_DEFAULTS } from '../types/panels';

let nextId = 0;

function createPanelStore() {
  let panels = $state<PanelConfig[]>([]);

  function findFreeCell(): { col: number; row: number } | null {
    const occupied = new Set(
      panels.flatMap((p) => {
        const cells: string[] = [];
        for (let c = p.col; c < p.col + p.colSpan; c++) {
          for (let r = p.row; r < p.row + p.rowSpan; r++) {
            cells.push(`${c},${r}`);
          }
        }
        return cells;
      })
    );
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        if (!occupied.has(`${c},${r}`)) return { col: c, row: r };
      }
    }
    return null;
  }

  return {
    get panels() {
      return panels;
    },

    addPanel(type: PanelType): PanelConfig | null {
      const cell = findFreeCell();
      if (!cell) return null;

      const panel: PanelConfig = {
        id: `panel-${nextId++}`,
        type,
        title: PANEL_DEFAULTS[type].title,
        col: cell.col,
        row: cell.row,
        colSpan: 1,
        rowSpan: 1,
      };
      panels = [...panels, panel];
      return panel;
    },

    removePanel(id: string) {
      panels = panels.filter((p) => p.id !== id);
    },

    updatePanel(id: string, update: Partial<Pick<PanelConfig, 'col' | 'row' | 'colSpan' | 'rowSpan'>>) {
      panels = panels.map((p) => (p.id === id ? { ...p, ...update } : p));
    },

    movePanel(id: string, col: number, row: number) {
      this.updatePanel(id, { col: Math.max(0, Math.min(1, col)), row: Math.max(0, Math.min(1, row)) });
    },

    toggleSpan(id: string, direction: 'col' | 'row') {
      const panel = panels.find((p) => p.id === id);
      if (!panel) return;
      if (direction === 'col') {
        this.updatePanel(id, { colSpan: panel.colSpan === 1 ? 2 : 1, col: panel.colSpan === 2 ? panel.col : 0 });
      } else {
        this.updatePanel(id, { rowSpan: panel.rowSpan === 1 ? 2 : 1, row: panel.rowSpan === 2 ? panel.row : 0 });
      }
    },

    clear() {
      panels = [];
    },
  };
}

export const panelStore = createPanelStore();
