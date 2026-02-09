import { Component, computed, input, output } from '@angular/core';
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
          class="connection-path pointer-events-auto cursor-pointer"
          [class.selected]="conn.id === selectedConnectionId()"
          fill="none"
          [attr.stroke]="conn.id === selectedConnectionId() ? '#3b82f6' : '#94a3b8'"
          [attr.stroke-width]="conn.id === selectedConnectionId() ? 4 : 3"
          stroke-linecap="round"
          (click)="onConnectionClick($event, conn.id)"
        />
      }

      <!-- Packets -->
      @for (packet of packets(); track $index) {
        <circle
          [attr.cx]="packet.x"
          [attr.cy]="packet.y"
          [attr.r]="packet.isResponse ? 4 : 5"
          [attr.fill]="packet.color"
          [attr.stroke]="packet.isResponse ? 'white' : 'none'"
          [attr.stroke-width]="packet.isResponse ? 2 : 0"
          class="packet"
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
    .connection-path {
      transition: stroke 150ms ease, stroke-width 150ms ease;
    }
    .connection-path:hover {
      stroke: #64748b;
      stroke-width: 4;
    }
    .connection-path.selected {
      filter: drop-shadow(0 0 4px rgba(59, 130, 246, 0.4));
    }
    .packet {
      filter: drop-shadow(0 0 4px var(--packet-color, rgba(255, 255, 255, 0.6)));
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
    readonly selectedConnectionId = input<string | null>(null);
    readonly packets = input<{ x: number; y: number; color: string; isResponse: boolean }[]>([]);
    readonly dragPreviewSource = input<PortRef | null>(null);
    readonly dragPreviewCursor = input<{ x: number; y: number } | null>(null);

    // ── Outputs ────────────────────────────────────────────────────────
    readonly connectionClick = output<string>();

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

    // ── Methods ────────────────────────────────────────────────────────
    protected onConnectionClick(event: MouseEvent, connectionId: string): void {
        event.stopPropagation();
        this.connectionClick.emit(connectionId);
    }
}
