import { Ion, Viewer, type Viewer as ViewerType } from 'cesium';

// Default Cesium ion token — users should replace with their own
// This uses the default community token for development
Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlYWE1OWUxNy1mMWZiLTQzYjYtYTQ0OS1kMWFjYmFkNjc5YzciLCJpZCI6NTc3MzMsImlhdCI6MTYyNzg0NTE4Mn0.XcKpgANiY19MC4bdFUXMVEBToBmqS8kuYpUlxJHYZxk';

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
  });

  // Remove default credit display clutter
  (viewer.cesiumWidget.creditContainer as HTMLElement).style.display = 'none';

  return viewer;
}
