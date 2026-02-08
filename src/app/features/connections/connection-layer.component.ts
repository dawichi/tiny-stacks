import { Component, computed, input } from '@angular/core';
import type { Connection, PlacedService, PortRef } from '../../core/game/game-state.service';
import { computeBezierPath, computePreviewPath, getPortAbsolutePosition } from '../../core/game/port-utils';

@Component({
    selector: 'app-connection-layer',
    standalone: true,
    template: `
    <svg
      class="absolute inset-0 pointer-events-none"
      [attr.width]="boardWidth()"
      [attr.height]="boardHeight()"
      [attr.viewBox]="'0 0 ' + boardWidth() + ' ' + boardHeight()"
    >
      <!-- Rendered connections -->
      @for (conn of renderedConnections(); track conn.id) {
        <path
          [attr.d]="conn.path"
          class="pointer-events-auto cursor-pointer"
          fill="none"
          stroke="#94a3b8"
          stroke-width="3"
          stroke-linecap="round"
        />
      }

      <!-- Drag preview -->
      @if (previewPath()) {
        <path
          [attr.d]="previewPath()"
          fill="none"
          stroke="#3b82f6"
          stroke-width="2"
          stroke-dasharray="8 4"
          stroke-linecap="round"
          opacity="0.7"
        />
      }
    </svg>
  `,
    styles: [
        `
    path.pointer-events-auto {
      transition: stroke 150ms ease, stroke-width 150ms ease;
    }
    path.pointer-events-auto:hover {
      stroke: #64748b;
      stroke-width: 4;
    }
  `,
    ],
})
export class ConnectionLayerComponent {
    // ── Inputs ─────────────────────────────────────────────────────────
    readonly connections = input.required<Connection[]>();
    readonly services = input.required<PlacedService[]>();
    readonly cellSize = input.required<number>();
    readonly boardWidth = input.required<number>();
    readonly boardHeight = input.required<number>();
    readonly dragPreviewSource = input<PortRef | null>(null);
    readonly dragPreviewCursor = input<{ x: number; y: number } | null>(null);

    // ── Computed ──────────────────────────────────────────────────────
    protected readonly renderedConnections = computed(() => {
        const services = this.services();
        const cellSize = this.cellSize();

        return this.connections().map((conn) => {
            const srcService = services.find((s) => s.id === conn.source.serviceId);
            const tgtService = services.find((s) => s.id === conn.target.serviceId);

            if (!srcService || !tgtService) {
                return { id: conn.id, path: '' };
            }

            const from = getPortAbsolutePosition(srcService, conn.source.portIndex, cellSize);
            const to = getPortAbsolutePosition(tgtService, conn.target.portIndex, cellSize);

            return { id: conn.id, path: computeBezierPath(from, to) };
        });
    });

    protected readonly previewPath = computed(() => {
        const source = this.dragPreviewSource();
        const cursor = this.dragPreviewCursor();
        if (!source || !cursor) return null;

        const services = this.services();
        const srcService = services.find((s) => s.id === source.serviceId);
        if (!srcService) return null;

        const from = getPortAbsolutePosition(srcService, source.portIndex, this.cellSize());
        return computePreviewPath(from, cursor.x, cursor.y);
    });
}
