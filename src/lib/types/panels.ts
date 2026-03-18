export type PanelType = 'cesium' | 'slicer' | 'heatmap';

export interface PanelConfig {
  id: string;
  type: PanelType;
  title: string;
  /** Grid column (0 or 1) */
  col: number;
  /** Grid row (0 or 1) */
  row: number;
  /** Column span (1 or 2) */
  colSpan: number;
  /** Row span (1 or 2) */
  rowSpan: number;
}

export const PANEL_DEFAULTS: Record<PanelType, { title: string }> = {
  cesium: { title: '3D Globe View' },
  slicer: { title: 'Data Slicer' },
  heatmap: { title: 'Heat Map' },
};
