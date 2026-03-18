export type PanelType = 'cesium' | 'slicer' | 'heatmap' | 'integral';

export interface PanelConfig {
  id: string;
  type: PanelType;
  title: string;
  /** Position/size in pixels relative to the panel container */
  x: number;
  y: number;
  w: number;
  h: number;
  zIndex: number;
  minimized: boolean;
  maximized: boolean;
  /** Saved rect for restoring after maximize */
  savedRect?: { x: number; y: number; w: number; h: number };
}

export const PANEL_DEFAULTS: Record<PanelType, { title: string; minW: number; minH: number }> = {
  cesium: { title: '3D Globe View', minW: 320, minH: 240 },
  slicer: { title: 'Data Slicer', minW: 300, minH: 300 },
  heatmap: { title: 'Heat Map', minW: 200, minH: 200 },
  integral: { title: 'Integral Map', minW: 200, minH: 200 },
};
