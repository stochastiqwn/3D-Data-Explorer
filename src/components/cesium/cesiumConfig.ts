import { Viewer, OpenStreetMapImageryProvider, type Viewer as ViewerType } from 'cesium';

export interface CesiumViewerOptions {
  container: HTMLElement;
}

export function createCesiumViewer(options: CesiumViewerOptions): ViewerType {
  const viewer = new Viewer(options.container, {
    animation: false,
    baseLayerPicker: false,
    fullscreenButton: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    sceneModePicker: false,
    selectionIndicator: false,
    timeline: false,
    navigationHelpButton: false,
    scene3DOnly: true,
    requestRenderMode: true,
    maximumRenderTimeChange: Infinity,
    baseLayer: false, // disable default Ion imagery
  });

  // Use OpenStreetMap tiles instead of Cesium Ion
  viewer.imageryLayers.addImageryProvider(
    new OpenStreetMapImageryProvider({
      url: 'https://tile.openstreetmap.org/',
    })
  );

  // Remove default credit display clutter
  (viewer.cesiumWidget.creditContainer as HTMLElement).style.display = 'none';

  return viewer;
}
