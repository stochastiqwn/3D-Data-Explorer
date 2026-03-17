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

  let dragging = $state(false);
  let dragStartX = 0;
  let dragStartY = 0;

  function onDragStart(e: MouseEvent) {
    dragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragEnd);
  }

  function onDragMove(e: MouseEvent) {
    // Visual feedback handled by CSS class
  }

  function onDragEnd(e: MouseEvent) {
    dragging = false;
    window.removeEventListener('mousemove', onDragMove);
    window.removeEventListener('mouseup', onDragEnd);

    // Determine which grid cell the mouse ended in
    const grid = document.querySelector('.panel-grid') as HTMLElement;
    if (!grid) return;
    const rect = grid.getBoundingClientRect();
    const col = Math.floor(((e.clientX - rect.left) / rect.width) * 2);
    const row = Math.floor(((e.clientY - rect.top) / rect.height) * 2);
    if (col >= 0 && col < 2 && row >= 0 && row < 2) {
      panelStore.movePanel(panel.id, col, row);
    }
  }

  function close() {
    panelStore.removePanel(panel.id);
  }

  function toggleExpandH() {
    panelStore.toggleSpan(panel.id, 'col');
  }

  function toggleExpandV() {
    panelStore.toggleSpan(panel.id, 'row');
  }
</script>

<div class="panel-wrapper" class:dragging>
  <div class="panel-titlebar" onmousedown={onDragStart} role="toolbar">
    <span class="panel-title">{panel.title}</span>
    <div class="panel-controls">
      <button class="ctrl-btn" onclick={toggleExpandH} title="Toggle horizontal span">
        ⬌
      </button>
      <button class="ctrl-btn" onclick={toggleExpandV} title="Toggle vertical span">
        ⬍
      </button>
      <button class="ctrl-btn close" onclick={close} title="Close panel">
        ✕
      </button>
    </div>
  </div>
  <div class="panel-content">
    {@render children()}
  </div>
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
    transition: box-shadow 0.15s;
  }

  .panel-wrapper.dragging {
    opacity: 0.8;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    z-index: 100;
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
    gap: 4px;
  }

  .ctrl-btn {
    width: 22px;
    height: 22px;
    border-radius: 3px;
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
  }

  .ctrl-btn:hover {
    background: rgba(255, 255, 255, 0.1);
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
</style>
