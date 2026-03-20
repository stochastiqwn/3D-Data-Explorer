<script lang="ts">
  import type { PanelConfig } from '../../lib/types/panels';
  import { panelStore } from '../../lib/stores/panelStore.svelte';
  import type { Snippet } from 'svelte';

  let {
    panel,
    children,
  }: {
    panel: PanelConfig;
    children: Snippet;
  } = $props();

  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let resizeStartX = 0;
  let resizeStartY = 0;
  let resizeStartW = 0;
  let resizeStartH = 0;

  function focus() {
    panelStore.focusPanel(panel.id);
  }

  function onDragStart(e: MouseEvent) {
    if (panel.maximized) return;
    e.preventDefault();
    focus();
    dragOffsetX = e.clientX - panel.x;
    dragOffsetY = e.clientY - panel.y;
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragEnd);
  }

  function onDragMove(e: MouseEvent) {
    panelStore.movePanel(
      panel.id,
      Math.max(0, e.clientX - dragOffsetX),
      Math.max(0, e.clientY - dragOffsetY),
    );
  }

  function onDragEnd() {
    window.removeEventListener('mousemove', onDragMove);
    window.removeEventListener('mouseup', onDragEnd);
  }

  function onResizeStart(e: MouseEvent) {
    if (panel.maximized) return;
    e.preventDefault();
    e.stopPropagation();
    focus();
    resizeStartX = e.clientX;
    resizeStartY = e.clientY;
    resizeStartW = panel.w;
    resizeStartH = panel.h;
    window.addEventListener('mousemove', onResizeMove);
    window.addEventListener('mouseup', onResizeEnd);
  }

  function onResizeMove(e: MouseEvent) {
    panelStore.resizePanel(
      panel.id,
      resizeStartW + (e.clientX - resizeStartX),
      resizeStartH + (e.clientY - resizeStartY),
    );
  }

  function onResizeEnd() {
    window.removeEventListener('mousemove', onResizeMove);
    window.removeEventListener('mouseup', onResizeEnd);
  }

  function onTitleDblClick() {
    panelStore.maximizePanel(panel.id);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="panel-wrapper"
  class:minimized={panel.minimized}
  class:maximized={panel.maximized}
  onmousedown={focus}
>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="panel-titlebar" onmousedown={onDragStart} ondblclick={onTitleDblClick}>
    <span class="panel-title">{panel.title}</span>
    <div class="panel-controls">
      <button class="ctrl-btn" onclick={() => panelStore.minimizePanel(panel.id)} title={panel.minimized ? 'Restore' : 'Minimize'}>
        {panel.minimized ? '\u002B' : '\u2013'}
      </button>
      <button class="ctrl-btn" onclick={() => panelStore.maximizePanel(panel.id)} title={panel.maximized ? 'Restore' : 'Maximize'}>
        {panel.maximized ? '\u29C9' : '\u25A1'}
      </button>
      <button class="ctrl-btn close" onclick={() => panelStore.removePanel(panel.id)} title="Close">
        {'✕'}
      </button>
    </div>
  </div>
  {#if !panel.minimized}
    <div class="panel-content">
      {@render children()}
    </div>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="resize-handle" onmousedown={onResizeStart}></div>
  {/if}
</div>

<style>
  .panel-wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-secondary);
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid var(--border);
    box-shadow: 0 2px 12px var(--shadow);
  }

  .panel-wrapper.minimized {
    height: 32px;
  }

  .panel-titlebar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 10px;
    height: 32px;
    background: var(--bg-panel);
    cursor: grab;
    user-select: none;
    flex-shrink: 0;
  }

  .panel-titlebar:active {
    cursor: grabbing;
  }

  .panel-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .panel-controls {
    display: flex;
    gap: 2px;
  }

  .ctrl-btn {
    width: 24px;
    height: 24px;
    border-radius: 3px;
    font-size: 13px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
    color: var(--text-secondary);
  }

  .ctrl-btn:hover {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  .ctrl-btn.close:hover {
    background: var(--danger);
    color: #fff;
  }

  .panel-content {
    flex: 1;
    overflow: hidden;
    position: relative;
  }

  .resize-handle {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 14px;
    height: 14px;
    cursor: nwse-resize;
    z-index: 10;
  }

  .resize-handle::after {
    content: '';
    position: absolute;
    right: 3px;
    bottom: 3px;
    width: 8px;
    height: 8px;
    border-right: 2px solid var(--text-secondary);
    border-bottom: 2px solid var(--text-secondary);
    opacity: 0.4;
  }
</style>
