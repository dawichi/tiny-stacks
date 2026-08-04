import { Component, computed, HostListener, inject, signal } from '@angular/core';
import { ChallengeService } from '../../core/challenges/challenge.service';
import { GameStateService, type PortRef } from '../../core/game/game-state.service';
import { evaluateBezier, getConnectionBezier } from '../../core/game/port-utils';
import { getServiceConfig, ServiceType } from '../../core/game/service-types.config';
import { type ServiceVisualState, TickEngineService } from '../../core/game/tick-engine.service';
import { ConnectionLayerComponent } from '../connections/connection-layer.component';
import { ServiceComponent } from '../services/service.component';
import { BoardToolbarComponent } from './board-toolbar.component';

interface HoverPosition {
    gridX: number;
    gridY: number;
}

@Component({
    selector: 'app-game-board',
    standalone: true,
    imports: [ServiceComponent, ConnectionLayerComponent, BoardToolbarComponent],
    templateUrl: './game-board.component.html',
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
    private readonly challengeService = inject(ChallengeService);

    // ── Properties ─────────────────────────────────────────────────────
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
                const t = p.direction === 'response' ? 1 - p.progress : p.progress;
                const pos = evaluateBezier(t, curve);
                return { x: pos.x, y: pos.y, color: p.color, isResponse: p.direction === 'response' };
            })
            .filter((p) => p !== null);
    });

    // ── Failed packet rendering ─────────────────────────────────────────
    protected readonly renderedFailedPackets = computed(() => {
        const failedPackets = this.simulation.failedPackets();
        if (failedPackets.length === 0) return [];

        const services = this.gameState.services();
        const cellSize = this.cellSize();

        return failedPackets
            .map((fp) => {
                const svc = services.find((s) => s.id === fp.serviceId);
                if (!svc) return null;
                const config = getServiceConfig(svc.type);
                const x = (svc.gridX + config.gridWidth / 2) * cellSize;
                const y = (svc.gridY + config.gridHeight / 2) * cellSize;
                const progress = 1 - fp.remainingMs / 500;
                return { x, y, progress, id: fp.id };
            })
            .filter((fp) => fp !== null);
    });

    // ── Keyboard handlers ─────────────────────────────────────────────
    @HostListener('window:keydown', ['$event'])
    protected onKeyDown(event: KeyboardEvent): void {
        const mod = event.metaKey || event.ctrlKey;

        if (mod && event.key === 'z' && !event.shiftKey) {
            event.preventDefault();
            this.gameState.undo();
            return;
        }

        if ((mod && event.key === 'z' && event.shiftKey) || (mod && event.key === 'y')) {
            event.preventDefault();
            this.gameState.redo();
            return;
        }

        const selectedConn = this.gameState.selectedConnectionId();
        if ((event.key === 'Delete' || event.key === 'Backspace') && selectedConn) {
            event.preventDefault();
            this.gameState.removeConnection(selectedConn);
        }
    }

    // ── Service interaction ────────────────────────────────────────────
    protected onServiceClick(id: string): void {
        this.gameState.selectedConnectionId.set(null);
        this.gameState.selectService(id);
    }

    protected onConnectionClick(connectionId: string): void {
        this.gameState.selectService(null);
        this.gameState.selectedConnectionId.set(connectionId);
    }

    // ── Palette drag-drop ──────────────────────────────────────────────
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

    // ── Connection drag ────────────────────────────────────────────────
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

    // ── Move drag ─────────────────────────────────────────────────────
    protected onMoveDragStart(event: { serviceId: string }): void {
        if (this.connectionDragSource() || this.isServiceLocked(event.serviceId)) return;
        this.moveDragServiceId.set(event.serviceId);
        this.gameState.selectedConnectionId.set(null);
        this.gameState.selectService(event.serviceId);
    }

    protected getServiceVisual(serviceId: string): ServiceVisualState | null {
        return this.simulation.serviceVisuals().get(serviceId) ?? null;
    }

    protected isServiceLocked(serviceId: string): boolean {
        return this.challengeService.lockedServiceIds().has(serviceId);
    }

    protected getOriginRps(serviceId: string, type: ServiceType): number | null {
        if (type !== ServiceType.ORIGIN) return null;
        const override = this.simulation.trafficOverrides().get(serviceId);
        return override?.requestsPerSecond ?? 10;
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
