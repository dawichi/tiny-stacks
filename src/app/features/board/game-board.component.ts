import { Component, computed, ElementRef, HostListener, inject, input, signal } from '@angular/core';
import { GameStateService, isServiceType, type PortRef } from '../../core/game/game-state.service';
import { evaluateBezier, getConnectionBezier } from '../../core/game/port-utils';
import { getServiceConfig, ServiceType } from '../../core/game/service-types.config';
import { DEFAULT_TRAFFIC, type ServiceVisualState, TickEngineService } from '../../core/game/tick-engine.service';
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
    private readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef);

    // ── Inputs ─────────────────────────────────────────────────────────
    /** Placement limits (challenges, tutorial). null = unlimited (sandbox). */
    readonly availableResources = input<{ type: ServiceType; count: number }[] | null>(null);

    // ── Properties ─────────────────────────────────────────────────────
    private readonly hoverPosition = signal<HoverPosition | null>(null);
    private readonly keyboardPlacementPosition = signal<HoverPosition>({ gridX: 0, gridY: 0 });
    protected readonly keyboardAnnouncement = signal('');
    private readonly previewPosition = computed(() => {
        if (this.gameState.keyboardPlacementActive()) return this.keyboardPlacementPosition();
        return this.hoverPosition();
    });

    // Connection drag state
    protected readonly connectionDragSource = signal<PortRef | null>(null);
    protected readonly connectionDragCursor = signal<{ x: number; y: number } | null>(null);
    protected readonly connectionDragActive = computed(() => this.connectionDragSource() !== null);

    // Move drag state
    protected readonly moveDragServiceId = signal<string | null>(null);

    protected readonly cellSize = computed(() => this.gameState.gridConfig().cellSize);

    focusBoard(): void {
        this.hostElement.nativeElement.querySelector<HTMLElement>('.game-board')?.focus();
    }

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
        return this.previewServiceType() !== null && this.previewPosition() !== null;
    });

    protected readonly previewValid = computed(() => {
        const type = this.previewServiceType();
        const pos = this.previewPosition();
        if (!type || !pos) return false;

        const moveId = this.moveDragServiceId();
        if (moveId) {
            return this.gameState.canPlaceServiceExcluding(type, pos.gridX, pos.gridY, moveId);
        }
        return this.gameState.canPlaceService(type, pos.gridX, pos.gridY);
    });

    protected readonly previewLeft = computed(() => {
        const pos = this.previewPosition();
        return pos ? pos.gridX * this.cellSize() : 0;
    });

    protected readonly previewTop = computed(() => {
        const pos = this.previewPosition();
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
                return { x: pos.x, y: pos.y, color: p.color, isResponse: p.direction === 'response', async: p.async };
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
        // Keys typed into form controls belong to them (sliders, toggles, future text fields)
        if (isEditableTarget(event.target)) return;

        if (this.gameState.keyboardPlacementActive() && this.handleKeyboardPlacementKey(event)) return;

        const mod = event.metaKey || event.ctrlKey;
        const key = event.key.toLowerCase();

        if (mod && key === 'z' && !event.shiftKey) {
            event.preventDefault();
            this.gameState.undo();
            return;
        }

        if ((mod && key === 'z' && event.shiftKey) || (mod && key === 'y')) {
            event.preventDefault();
            this.gameState.redo();
            return;
        }

        if (event.key !== 'Delete' && event.key !== 'Backspace') return;
        if (isInteractiveControlOutsideBoard(event.target)) return;

        const selectedConn = this.gameState.selectedConnectionId();
        if (selectedConn) {
            event.preventDefault();
            this.gameState.removeConnection(selectedConn);
            this.keyboardAnnouncement.set('Connection removed.');
            return;
        }

        const selectedService = this.gameState.selectedServiceId();
        if (selectedService && !this.gameState.isLocked(selectedService)) {
            const service = this.gameState.services().find((item) => item.id === selectedService);
            event.preventDefault();
            this.gameState.removeService(selectedService);
            if (service) this.keyboardAnnouncement.set(`${getServiceConfig(service.type).name} removed.`);
        }
    }

    // ── Service interaction ────────────────────────────────────────────
    protected onServiceClick(id: string): void {
        this.gameState.selectedConnectionId.set(null);
        this.gameState.selectService(id);
    }

    protected onServiceKeyboardSelect(event: { serviceId: string }): void {
        this.onServiceClick(event.serviceId);
        const service = this.gameState.services().find((item) => item.id === event.serviceId);
        if (service) this.keyboardAnnouncement.set(`${getServiceConfig(service.type).name} selected.`);
    }

    protected onServiceKeyboardMove(event: { serviceId: string; deltaX: number; deltaY: number }): void {
        const service = this.gameState.services().find((item) => item.id === event.serviceId);
        if (!service) return;
        this.gameState.selectedConnectionId.set(null);
        this.gameState.selectService(event.serviceId);
        const moved = this.gameState.moveService(
            event.serviceId,
            service.gridX + event.deltaX,
            service.gridY + event.deltaY,
        );
        const config = getServiceConfig(service.type);
        this.keyboardAnnouncement.set(
            moved
                ? `${config.name} moved to column ${service.gridX + event.deltaX + 1}, row ${service.gridY + event.deltaY + 1}.`
                : `${config.name} cannot move to that cell.`,
        );
    }

    protected onPortActivate(event: PortRef): void {
        const source = this.connectionDragSource();
        if (!source) {
            this.connectionDragSource.set(event);
            const service = this.gameState.services().find((item) => item.id === event.serviceId);
            const port = service ? getServiceConfig(service.type).ports[event.portIndex] : undefined;
            this.keyboardAnnouncement.set(
                service && port
                    ? `Connection start selected: ${getServiceConfig(service.type).name} ${port.direction} port. Choose a destination port.`
                    : 'Connection start selected. Choose a destination port.',
            );
            return;
        }

        if (source.serviceId === event.serviceId && source.portIndex === event.portIndex) {
            this.connectionDragSource.set(null);
            this.keyboardAnnouncement.set('Connection cancelled.');
            return;
        }

        const connection = this.gameState.addConnection(source, event);
        if (connection) {
            this.onConnectionClick(connection.id);
            this.keyboardAnnouncement.set('Connection created and selected. Press Delete to remove it.');
            this.connectionDragSource.set(null);
            return;
        }

        this.keyboardAnnouncement.set('Those ports cannot connect. Choose a compatible destination port.');
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

    protected onBoardClick(event: MouseEvent): void {
        if (event.target !== event.currentTarget || this.gameState.keyboardPlacementActive()) return;
        const type = this.gameState.draggingType();
        if (!type) return;

        const board = event.currentTarget as HTMLElement;
        const position = this.clientToGrid(event.clientX, event.clientY, board.getBoundingClientRect());
        if (!position) return;
        if (!this.hasRemaining(type)) {
            this.keyboardAnnouncement.set(`No ${getServiceConfig(type).name} services remain for this challenge.`);
            return;
        }

        const placed = this.gameState.addService(type, position.gridX, position.gridY);
        if (placed) {
            this.gameState.draggingType.set(null);
            this.keyboardAnnouncement.set(
                `${getServiceConfig(type).name} placed at column ${position.gridX + 1}, row ${position.gridY + 1}.`,
            );
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

        const type = event.dataTransfer?.getData('application/service-type');
        const pos = this.eventToGrid(event);

        // The drag payload comes from outside Angular: check it before trusting it
        if (isServiceType(type) && pos && this.hasRemaining(type)) {
            this.gameState.addService(type, pos.gridX, pos.gridY);
        }

        this.hoverPosition.set(null);
        this.gameState.draggingType.set(null);
        this.gameState.keyboardPlacementActive.set(false);
    }

    // ── Connection drag ────────────────────────────────────────────────
    protected onPortDragStart(event: { serviceId: string; portIndex: number }): void {
        this.gameState.keyboardPlacementActive.set(false);
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
        if (this.connectionDragSource() || !this.gameState.editable() || this.isServiceLocked(event.serviceId)) return;
        this.moveDragServiceId.set(event.serviceId);
        this.gameState.selectedConnectionId.set(null);
        this.gameState.selectService(event.serviceId);
    }

    protected getServiceVisual(serviceId: string): ServiceVisualState | null {
        return this.simulation.serviceVisuals().get(serviceId) ?? null;
    }

    protected isServiceLocked(serviceId: string): boolean {
        return this.gameState.isLocked(serviceId);
    }

    protected getOriginRps(serviceId: string, type: ServiceType): number | null {
        if (type !== ServiceType.ORIGIN) return null;
        const pattern = this.simulation.trafficOverrides().get(serviceId) ?? DEFAULT_TRAFFIC;
        const run = this.simulation.run();
        if (!run || run.finished || !pattern.phases?.length) return pattern.requestsPerSecond;
        let start = 0;
        for (const phase of pattern.phases) {
            if (run.elapsedMs < start + phase.durationMs) return phase.requestsPerSecond;
            start += phase.durationMs;
        }
        return 0;
    }

    private hasRemaining(type: ServiceType): boolean {
        const resources = this.availableResources();
        if (resources === null) return true;
        const limit = resources.find((r) => r.type === type)?.count ?? 0;
        return this.gameState.placedByPlayer(type) < limit;
    }

    private handleKeyboardPlacementKey(event: KeyboardEvent): boolean {
        const type = this.gameState.draggingType();
        if (!type) {
            this.gameState.keyboardPlacementActive.set(false);
            return false;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            this.gameState.draggingType.set(null);
            this.gameState.keyboardPlacementActive.set(false);
            this.keyboardAnnouncement.set('Placement cancelled.');
            return true;
        }

        const movement: Record<string, HoverPosition> = {
            ArrowLeft: { gridX: -1, gridY: 0 },
            ArrowRight: { gridX: 1, gridY: 0 },
            ArrowUp: { gridX: 0, gridY: -1 },
            ArrowDown: { gridX: 0, gridY: 1 },
        };
        const delta = movement[event.key];
        if (delta) {
            event.preventDefault();
            const grid = this.gameState.gridConfig();
            const current = this.keyboardPlacementPosition();
            const next = {
                gridX: Math.max(0, Math.min(grid.width - 1, current.gridX + delta.gridX)),
                gridY: Math.max(0, Math.min(grid.height - 1, current.gridY + delta.gridY)),
            };
            this.keyboardPlacementPosition.set(next);
            this.keyboardAnnouncement.set(`Placement cursor at column ${next.gridX + 1}, row ${next.gridY + 1}.`);
            return true;
        }

        if (event.key !== 'Enter' && event.key !== ' ') return false;
        event.preventDefault();
        const position = this.keyboardPlacementPosition();
        if (!this.hasRemaining(type)) {
            this.keyboardAnnouncement.set(`No ${getServiceConfig(type).name} services remain for this challenge.`);
            return true;
        }
        if (!this.previewValid()) {
            this.keyboardAnnouncement.set(
                'That service cannot be placed there. Use arrow keys to choose another cell.',
            );
            return true;
        }

        const placed = this.gameState.addService(type, position.gridX, position.gridY);
        if (placed) {
            this.keyboardAnnouncement.set(
                `${getServiceConfig(type).name} placed at column ${position.gridX + 1}, row ${position.gridY + 1}.`,
            );
            this.gameState.draggingType.set(null);
            this.gameState.keyboardPlacementActive.set(false);
            this.keyboardPlacementPosition.set({ gridX: 0, gridY: 0 });
        }
        return true;
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

function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target.isContentEditable
    );
}

function isInteractiveControlOutsideBoard(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return Boolean(
        target.closest('button, a[href], input, select, textarea, [role="button"], [contenteditable="true"]') &&
            !target.closest('.game-board'),
    );
}
