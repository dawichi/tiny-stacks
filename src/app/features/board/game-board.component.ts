import { Component, computed, HostListener, inject, signal } from '@angular/core';
import { GameStateService, type PortRef } from '../../core/game/game-state.service';
import { evaluateBezier, getConnectionBezier } from '../../core/game/port-utils';
import { getServiceConfig, type ServiceType } from '../../core/game/service-types.config';
import { type ServiceVisualState, TickEngineService } from '../../core/game/tick-engine.service';
import { ConnectionLayerComponent } from '../connections/connection-layer.component';
import { ServiceComponent } from '../services/service.component';

interface HoverPosition {
    gridX: number;
    gridY: number;
}

@Component({
    selector: 'app-game-board',
    standalone: true,
    imports: [ServiceComponent, ConnectionLayerComponent],
    template: `
    <div
      class="game-board relative bg-slate-100 rounded-lg overflow-hidden"
      [class.cursor-grabbing]="moveDragServiceId()"
      [style.width.px]="boardWidth()"
      [style.height.px]="boardHeight()"
      (dragover)="onDragOver($event)"
      (dragleave)="onDragLeave($event)"
      (drop)="onDrop($event)"
      (mousemove)="onBoardMouseMove($event)"
      (mouseup)="onBoardMouseUp()"
    >
      <!-- Grid lines -->
      <div
        class="absolute inset-0 pointer-events-none"
        [style.background-image]="gridPattern()"
        [style.background-size]="cellSize() + 'px ' + cellSize() + 'px'"
      ></div>

      <!-- Toolbar buttons -->
      <div class="absolute top-3 right-3 z-10 flex items-center gap-1.5">
        @if (simulation.running()) {
          <!-- Metrics chips -->
          <div class="flex items-center gap-1 mr-0.5">
            <span class="px-1.5 py-0.5 rounded-md bg-white/60 backdrop-blur-sm
                         text-[10px] font-medium text-slate-600 select-none">
              {{ formatNumber(simulation.metrics().throughput) }} req/s
            </span>
            <span class="px-1.5 py-0.5 rounded-md bg-white/60 backdrop-blur-sm
                         text-[10px] font-medium text-slate-600 select-none">
              {{ formatNumber(simulation.metrics().avgLatency) }}ms
            </span>
            <span class="px-1.5 py-0.5 rounded-md bg-white/60 backdrop-blur-sm
                         text-[10px] font-medium select-none"
              [class.text-red-500]="simulation.metrics().totalFailed > 0"
              [class.text-slate-600]="simulation.metrics().totalFailed === 0"
            >
              {{ simulation.metrics().totalFailed }} err
            </span>
          </div>
          <!-- Speed controls -->
          <div class="flex items-center gap-0.5 mr-0.5">
            @for (s of speedOptions; track s) {
              <button
                class="px-1.5 py-0.5 rounded-md text-[10px] font-medium select-none
                       transition-all duration-150 border"
                [class.bg-slate-600]="simulation.speed() === s"
                [class.text-white]="simulation.speed() === s"
                [class.border-slate-600]="simulation.speed() === s"
                [class.bg-white/60]="simulation.speed() !== s"
                [class.text-slate-500]="simulation.speed() !== s"
                [class.border-white/40]="simulation.speed() !== s"
                [class.hover:bg-white/80]="simulation.speed() !== s"
                (click)="simulation.speed.set(s)"
              >
                {{ s }}x
              </button>
            }
          </div>
        }
        <button
          class="w-8 h-8 rounded-full flex items-center justify-center
                 bg-white/80 backdrop-blur-md border border-white/40 shadow-md
                 hover:bg-white/90 transition-all duration-200
                 disabled:opacity-30 disabled:cursor-not-allowed"
          [disabled]="!gameState.canUndo()"
          (click)="gameState.undo()"
          aria-label="Undo"
        >
          <span class="text-slate-600 text-sm font-bold select-none">&#x21A9;</span>
        </button>
        <button
          class="w-8 h-8 rounded-full flex items-center justify-center
                 bg-white/80 backdrop-blur-md border border-white/40 shadow-md
                 hover:bg-white/90 transition-all duration-200
                 disabled:opacity-30 disabled:cursor-not-allowed"
          [disabled]="!gameState.canRedo()"
          (click)="gameState.redo()"
          aria-label="Redo"
        >
          <span class="text-slate-600 text-sm font-bold select-none">&#x21AA;</span>
        </button>
        <button
          class="w-8 h-8 rounded-full flex items-center justify-center
                 bg-white/80 backdrop-blur-md border border-white/40 shadow-md
                 hover:bg-white/90 transition-all duration-200"
          (click)="simulation.toggle()"
          [attr.aria-label]="simulation.running() ? 'Pause simulation' : 'Start simulation'"
        >
          <span class="text-slate-600 text-sm font-bold select-none">
            {{ simulation.running() ? '\u23F8' : '\u25B6' }}
          </span>
        </button>
      </div>

      <!-- Connection layer (SVG) -->
      <app-connection-layer
        [connections]="gameState.connections()"
        [services]="gameState.services()"
        [cellSize]="cellSize()"
        [boardWidth]="boardWidth()"
        [boardHeight]="boardHeight()"
        [selectedConnectionId]="gameState.selectedConnectionId()"
        [packets]="renderedPackets()"
        [dragPreviewSource]="connectionDragSource()"
        [dragPreviewCursor]="connectionDragCursor()"
        (connectionClick)="onConnectionClick($event)"
      />

      <!-- Placement preview overlay -->
      @if (previewVisible()) {
        <div
          class="absolute rounded-lg pointer-events-none transition-all duration-75"
          [class.bg-green-400/30]="previewValid()"
          [class.border-green-400]="previewValid()"
          [class.bg-red-400/30]="!previewValid()"
          [class.border-red-400]="!previewValid()"
          [style.left.px]="previewLeft()"
          [style.top.px]="previewTop()"
          [style.width.px]="previewWidth()"
          [style.height.px]="previewHeight()"
          style="border-width: 2px; border-style: dashed;"
        ></div>
      }

      <!-- Services layer -->
      @for (service of gameState.services(); track service.id) {
        <app-service
          [service]="service"
          [cellSize]="cellSize()"
          [isSelected]="gameState.selectedServiceId() === service.id"
          [connectionDragActive]="connectionDragActive()"
          [runtimeVisual]="getServiceVisual(service.id)"
          [simulationRunning]="simulation.running()"
          (click)="onServiceClick(service.id)"
          (portDragStart)="onPortDragStart($event)"
          (portDragEnd)="onPortDragEnd($event)"
          (moveDragStart)="onMoveDragStart($event)"
        />
      }
    </div>
  `,
    styles: [
        `
    :host {
      display: block;
    }

    .game-board {
      box-shadow:
        inset 0 2px 4px rgba(0, 0, 0, 0.06),
        0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
  `,
    ],
})
export class GameBoardComponent {
    // ── Injected Services ──────────────────────────────────────────────
    protected readonly gameState = inject(GameStateService);
    protected readonly simulation = inject(TickEngineService);

    // ── Properties ─────────────────────────────────────────────────────
    protected readonly speedOptions = [0.5, 1, 2];
    private readonly hoverPosition = signal<HoverPosition | null>(null);

    // Connection drag state
    protected readonly connectionDragSource = signal<PortRef | null>(null);
    protected readonly connectionDragCursor = signal<{ x: number; y: number } | null>(null);
    protected readonly connectionDragActive = computed(() => this.connectionDragSource() !== null);

    // Move drag state
    protected readonly moveDragServiceId = signal<string | null>(null);

    protected readonly cellSize = computed(() => this.gameState.gridConfig().cellSize);

    protected readonly boardWidth = computed(() => {
        const config = this.gameState.gridConfig();
        return config.width * config.cellSize;
    });

    protected readonly boardHeight = computed(() => {
        const config = this.gameState.gridConfig();
        return config.height * config.cellSize;
    });

    protected readonly gridPattern = computed(() => {
        const lineColor = 'rgba(148, 163, 184, 0.3)';
        return `
      linear-gradient(to right, ${lineColor} 1px, transparent 1px),
      linear-gradient(to bottom, ${lineColor} 1px, transparent 1px)
    `;
    });

    // ── Placement/move preview computed signals ────────────────────────
    private readonly previewServiceType = computed<ServiceType | null>(() => {
        const paletteType = this.gameState.draggingType();
        if (paletteType) return paletteType;

        const moveId = this.moveDragServiceId();
        if (moveId) {
            const service = this.gameState.services().find((s) => s.id === moveId);
            return service?.type ?? null;
        }
        return null;
    });

    protected readonly previewVisible = computed(() => {
        return this.previewServiceType() !== null && this.hoverPosition() !== null;
    });

    protected readonly previewValid = computed(() => {
        const type = this.previewServiceType();
        const pos = this.hoverPosition();
        if (!type || !pos) return false;

        const moveId = this.moveDragServiceId();
        if (moveId) {
            return this.gameState.canPlaceServiceExcluding(type, pos.gridX, pos.gridY, moveId);
        }
        return this.gameState.canPlaceService(type, pos.gridX, pos.gridY);
    });

    protected readonly previewLeft = computed(() => {
        const pos = this.hoverPosition();
        return pos ? pos.gridX * this.cellSize() : 0;
    });

    protected readonly previewTop = computed(() => {
        const pos = this.hoverPosition();
        return pos ? pos.gridY * this.cellSize() : 0;
    });

    protected readonly previewWidth = computed(() => {
        const type = this.previewServiceType();
        if (!type) return 0;
        return getServiceConfig(type).gridWidth * this.cellSize();
    });

    protected readonly previewHeight = computed(() => {
        const type = this.previewServiceType();
        if (!type) return 0;
        return getServiceConfig(type).gridHeight * this.cellSize();
    });

    // ── Packet rendering ──────────────────────────────────────────────
    protected readonly renderedPackets = computed(() => {
        const packets = this.simulation.packets();
        if (packets.length === 0) return [];

        const services = this.gameState.services();
        const connections = this.gameState.connections();
        const cellSize = this.cellSize();

        // Build a lookup of connection → bezier curve
        const curveCache = new Map<string, ReturnType<typeof getConnectionBezier>>();
        for (const conn of connections) {
            const src = services.find((s) => s.id === conn.source.serviceId);
            const tgt = services.find((s) => s.id === conn.target.serviceId);
            if (src && tgt) {
                curveCache.set(
                    conn.id,
                    getConnectionBezier(src, conn.source.portIndex, tgt, conn.target.portIndex, cellSize),
                );
            }
        }

        return packets
            .map((p) => {
                const curve = curveCache.get(p.connectionId);
                if (!curve) return null;
                const pos = evaluateBezier(p.progress, curve);
                return { x: pos.x, y: pos.y, color: p.color };
            })
            .filter((p) => p !== null);
    });

    // ── Keyboard handlers ─────────────────────────────────────────────
    @HostListener('window:keydown', ['$event'])
    protected onKeyDown(event: KeyboardEvent): void {
        const mod = event.metaKey || event.ctrlKey;

        // Undo: Ctrl+Z / Cmd+Z
        if (mod && event.key === 'z' && !event.shiftKey) {
            event.preventDefault();
            this.gameState.undo();
            return;
        }

        // Redo: Ctrl+Shift+Z / Cmd+Shift+Z or Ctrl+Y / Cmd+Y
        if ((mod && event.key === 'z' && event.shiftKey) || (mod && event.key === 'y')) {
            event.preventDefault();
            this.gameState.redo();
            return;
        }

        // Delete connection
        const selectedConn = this.gameState.selectedConnectionId();
        if ((event.key === 'Delete' || event.key === 'Backspace') && selectedConn) {
            event.preventDefault();
            this.gameState.removeConnection(selectedConn);
        }
    }

    // ── Service interaction methods ────────────────────────────────────
    protected onServiceClick(id: string): void {
        this.gameState.selectedConnectionId.set(null);
        this.gameState.selectService(id);
    }

    protected onConnectionClick(connectionId: string): void {
        this.gameState.selectService(null);
        this.gameState.selectedConnectionId.set(connectionId);
    }

    // ── Palette drag-drop methods ──────────────────────────────────────
    protected onDragOver(event: DragEvent): void {
        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'copy';
        }

        const gridPos = this.eventToGrid(event);
        if (gridPos) {
            this.hoverPosition.set(gridPos);
        }
    }

    protected onDragLeave(event: DragEvent): void {
        const target = event.currentTarget as HTMLElement;
        const related = event.relatedTarget as Node | null;
        if (!related || !target.contains(related)) {
            this.hoverPosition.set(null);
        }
    }

    protected onDrop(event: DragEvent): void {
        event.preventDefault();

        const typeStr = event.dataTransfer?.getData('application/service-type');
        const pos = this.eventToGrid(event);

        if (typeStr && pos) {
            this.gameState.addService(typeStr as ServiceType, pos.gridX, pos.gridY);
        }

        this.hoverPosition.set(null);
        this.gameState.draggingType.set(null);
    }

    // ── Connection drag methods ────────────────────────────────────────
    protected onPortDragStart(event: { serviceId: string; portIndex: number }): void {
        this.connectionDragSource.set(event);
    }

    protected onPortDragEnd(event: { serviceId: string; portIndex: number }): void {
        const source = this.connectionDragSource();
        if (source) {
            this.gameState.addConnection(source, event);
        }
        this.connectionDragSource.set(null);
        this.connectionDragCursor.set(null);
    }

    protected onBoardMouseMove(event: MouseEvent): void {
        if (this.connectionDragSource()) {
            const target = event.currentTarget as HTMLElement;
            const rect = target.getBoundingClientRect();
            this.connectionDragCursor.set({
                x: event.clientX - rect.left,
                y: event.clientY - rect.top,
            });
            return;
        }

        if (this.moveDragServiceId()) {
            const gridPos = this.mouseEventToGrid(event);
            this.hoverPosition.set(gridPos);
        }
    }

    protected onBoardMouseUp(): void {
        if (this.connectionDragSource()) {
            this.connectionDragSource.set(null);
            this.connectionDragCursor.set(null);
        }

        const moveId = this.moveDragServiceId();
        if (moveId) {
            const pos = this.hoverPosition();
            if (pos && this.previewValid()) {
                this.gameState.moveService(moveId, pos.gridX, pos.gridY);
            }
            this.moveDragServiceId.set(null);
            this.hoverPosition.set(null);
        }
    }

    // ── Move drag methods ────────────────────────────────────────────
    protected onMoveDragStart(event: { serviceId: string }): void {
        if (this.connectionDragSource()) return;
        this.moveDragServiceId.set(event.serviceId);
        this.gameState.selectedConnectionId.set(null);
        this.gameState.selectService(event.serviceId);
    }

    protected formatNumber(value: number): string {
        return Math.round(value).toString();
    }

    protected getServiceVisual(serviceId: string): ServiceVisualState | null {
        return this.simulation.serviceVisuals().get(serviceId) ?? null;
    }

    // ── Private helpers ────────────────────────────────────────────────
    private eventToGrid(event: DragEvent): HoverPosition | null {
        const target = event.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();
        return this.clientToGrid(event.clientX, event.clientY, rect);
    }

    private mouseEventToGrid(event: MouseEvent): HoverPosition | null {
        const target = event.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();
        return this.clientToGrid(event.clientX, event.clientY, rect);
    }

    private clientToGrid(clientX: number, clientY: number, rect: DOMRect): HoverPosition | null {
        const cellSize = this.cellSize();
        const gridX = Math.floor((clientX - rect.left) / cellSize);
        const gridY = Math.floor((clientY - rect.top) / cellSize);

        const grid = this.gameState.gridConfig();
        if (gridX < 0 || gridY < 0 || gridX >= grid.width || gridY >= grid.height) {
            return null;
        }

        return { gridX, gridY };
    }
}
