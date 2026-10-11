import { Component, computed, input, output } from '@angular/core';
import { Cloud, Database, Globe, LucideAngularModule, Mail, Server, Split, Zap } from 'lucide-angular';
import { PlacedService } from '../../core/game/game-state.service';
import { getServiceConfig, ServiceType } from '../../core/game/service-types.config';
import type { ServiceVisualState } from '../../core/game/tick-engine.service';

@Component({
    selector: 'app-service',
    standalone: true,
    imports: [LucideAngularModule],
    template: `
    <div
      class="service absolute rounded-lg flex flex-col items-center justify-center cursor-grab
             transition-shadow duration-150 hover:scale-[1.02] hover:shadow-lg overflow-hidden
             focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
      (mousedown)="onServiceMouseDown($event)"
      (keydown)="onServiceKeyDown($event)"
      tabindex="0"
      role="group"
      [attr.aria-label]="serviceAccessibleLabel()"
      [class.cursor-not-allowed]="locked()"
      [attr.aria-disabled]="locked()"
      [class.ring-2]="isSelected()"
      [class.ring-blue-500]="isSelected()"
      [class.ring-offset-2]="isSelected()"
      [class.processing]="isProcessing()"
      [class.overloaded]="isOverloaded()"
      [class.origin-active]="isOriginActive()"
      [style.left.px]="positionX()"
      [style.top.px]="positionY()"
      [style.width.px]="width()"
      [style.height.px]="height()"
      [style.background-color]="config().color"
    >
      <!-- Icon -->
      <lucide-icon
        [img]="iconComponent()"
        [size]="iconSize()"
        class="text-white/90 drop-shadow-sm"
        aria-hidden="true"
      />

      <!-- Service name -->
      <span
        class="text-[10px] font-medium text-slate-900/90 mt-1 text-center leading-tight px-1"
        [class.hidden]="height() < 60"
      >
        {{ config().name }}
      </span>

      <!-- Origin rps label -->
      @if (originRps() !== null) {
        <span class="text-[9px] font-semibold text-slate-900/90 leading-none mt-0.5">
          {{ originRps() }} req/s
        </span>
      }

      <!-- Queue fill bar -->
      @if (showQueueBar()) {
        <div class="queue-bar absolute bottom-0 left-0 right-0 h-[3px] bg-black/10">
          <div
            class="h-full transition-all duration-200"
            [style.width.%]="queueBarWidth()"
            [style.background-color]="queueBarColor()"
          ></div>
        </div>
      }

      <!-- Port dots -->
      @for (port of config().ports; track $index) {
        <button
          type="button"
          class="port-dot absolute w-3 h-3 rounded-full border-2 border-white shadow-sm cursor-crosshair p-0
                 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-900"
          [class.port-highlight]="connectionDragActive()"
          [style.background-color]="portColor(port.direction)"
          [style.left.px]="portX(port)"
          [style.top.px]="portY(port)"
          [attr.aria-label]="portLabel(port, $index)"
          (mousedown)="onPortMouseDown($event, $index)"
          (mouseup)="onPortMouseUp($event, $index)"
          (click)="onPortClick($event, $index)"
        ></button>
      }
    </div>
  `,
    styles: [
        `
    .service {
      box-shadow:
        0 4px 6px -1px rgba(0, 0, 0, 0.1),
        0 2px 4px -2px rgba(0, 0, 0, 0.1),
        inset 0 1px 0 rgba(255, 255, 255, 0.2);
    }

    .port-dot {
      transition: transform 150ms ease, box-shadow 150ms ease;
      z-index: 1;
    }

    .port-highlight {
      transform: scale(1.5);
      box-shadow: 0 0 8px rgba(59, 130, 246, 0.6);
      z-index: 10;
    }

    .processing {
      animation: processing-pulse 1.5s ease-in-out infinite;
    }

    .overloaded {
      animation: overload-pulse 0.8s ease-in-out infinite;
    }

    .origin-active {
      animation: origin-breathe 2s ease-in-out infinite;
    }

    @keyframes processing-pulse {
      0%, 100% { box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.2); }
      50% { box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.2), 0 0 12px rgba(255,255,255,0.4); }
    }

    @keyframes overload-pulse {
      0%, 100% { box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 0 0 2px rgba(239,68,68,0.3); }
      50% { box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 0 0 4px rgba(239,68,68,0.5), 0 0 16px rgba(239,68,68,0.3); }
    }

    @keyframes origin-breathe {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.03); }
    }
  `,
    ],
})
export class ServiceComponent {
    // ── Inputs ─────────────────────────────────────────────────────────
    readonly service = input.required<PlacedService>();
    readonly cellSize = input.required<number>();
    readonly isSelected = input<boolean>(false);
    readonly connectionDragActive = input<boolean>(false);
    readonly runtimeVisual = input<ServiceVisualState | null>(null);
    readonly simulationRunning = input<boolean>(false);
    readonly originRps = input<number | null>(null);
    readonly locked = input(false);

    // ── Outputs ────────────────────────────────────────────────────────
    readonly portDragStart = output<{ serviceId: string; portIndex: number }>();
    readonly portDragEnd = output<{ serviceId: string; portIndex: number }>();
    readonly moveDragStart = output<{ serviceId: string }>();
    readonly keyboardSelect = output<{ serviceId: string }>();
    readonly keyboardMove = output<{ serviceId: string; deltaX: number; deltaY: number }>();
    readonly portActivate = output<{ serviceId: string; portIndex: number }>();

    // ── Properties ─────────────────────────────────────────────────────
    private readonly icons = {
        cloud: Cloud,
        globe: Globe,
        server: Server,
        database: Database,
        zap: Zap,
        mail: Mail,
        split: Split,
    };

    protected readonly config = computed(() => getServiceConfig(this.service().type));
    protected readonly serviceAccessibleLabel = computed(() => {
        const service = this.service();
        const position = `Column ${service.gridX + 1}, row ${service.gridY + 1}.`;
        const instructions = this.locked()
            ? 'Locked in place. Press Enter to select.'
            : 'Press Enter to select. Use arrow keys to move one cell.';
        return `${this.config().name}. ${position} ${instructions}`;
    });

    protected readonly positionX = computed(() => this.service().gridX * this.cellSize());
    protected readonly positionY = computed(() => this.service().gridY * this.cellSize());

    protected readonly width = computed(() => this.config().gridWidth * this.cellSize());
    protected readonly height = computed(() => this.config().gridHeight * this.cellSize());

    protected readonly iconSize = computed(() => Math.min(this.width(), this.height()) * 0.4);

    protected readonly iconComponent = computed(() => {
        const iconName = this.config().icon as keyof typeof this.icons;
        return this.icons[iconName] || Globe;
    });

    // ── Runtime visual computed signals ────────────────────────────────
    protected readonly isProcessing = computed(() => {
        const visual = this.runtimeVisual();
        return visual !== null && visual.processingRatio > 0;
    });

    protected readonly isOverloaded = computed(() => {
        return this.runtimeVisual()?.isOverloaded ?? false;
    });

    protected readonly isOriginActive = computed(() => {
        return this.service().type === ServiceType.ORIGIN && this.simulationRunning();
    });

    protected readonly showQueueBar = computed(() => {
        const visual = this.runtimeVisual();
        return visual !== null && visual.queueRatio > 0;
    });

    protected readonly queueBarWidth = computed(() => {
        const visual = this.runtimeVisual();
        return visual ? Math.min(visual.queueRatio * 100, 100) : 0;
    });

    protected readonly queueBarColor = computed(() => {
        const visual = this.runtimeVisual();
        if (!visual) return '#22c55e';
        const ratio = visual.queueRatio;
        if (ratio > 0.8) return '#ef4444'; // red-500
        if (ratio > 0.5) return '#eab308'; // yellow-500
        return '#22c55e'; // green-500
    });

    // ── Methods ────────────────────────────────────────────────────────
    protected portColor(direction: string): string {
        switch (direction) {
            case 'input':
                return '#22c55e'; // green-500
            case 'output':
                return '#3b82f6'; // blue-500
            case 'bidirectional':
                return '#f97316'; // orange-500
            default:
                return '#9ca3af'; // gray-400
        }
    }

    protected portLabel(port: { direction: string }, portIndex: number): string {
        return `${this.config().name} ${port.direction} port ${portIndex + 1}`;
    }

    protected portX(port: { cellOffsetX: number; edge: string }): number {
        const cellSize = this.cellSize();
        const baseX = port.cellOffsetX * cellSize;

        switch (port.edge) {
            case 'west':
                return -6; // Half of port width, positioned at left edge
            case 'east':
                return this.width() - 6;
            default:
                return baseX + cellSize / 2 - 6;
        }
    }

    protected portY(port: { cellOffsetY: number; edge: string }): number {
        const cellSize = this.cellSize();
        const baseY = port.cellOffsetY * cellSize;

        switch (port.edge) {
            case 'north':
                return -6;
            case 'south':
                return this.height() - 6;
            default:
                return baseY + cellSize / 2 - 6;
        }
    }

    protected onServiceMouseDown(event: MouseEvent): void {
        if (event.button !== 0 || this.locked()) return;
        this.moveDragStart.emit({ serviceId: this.service().id });
    }

    protected onServiceKeyDown(event: KeyboardEvent): void {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.keyboardSelect.emit({ serviceId: this.service().id });
            return;
        }
        if (this.locked()) return;

        const movement: Record<string, { deltaX: number; deltaY: number }> = {
            ArrowLeft: { deltaX: -1, deltaY: 0 },
            ArrowRight: { deltaX: 1, deltaY: 0 },
            ArrowUp: { deltaX: 0, deltaY: -1 },
            ArrowDown: { deltaX: 0, deltaY: 1 },
        };
        const delta = movement[event.key];
        if (!delta) return;
        event.preventDefault();
        this.keyboardMove.emit({ serviceId: this.service().id, ...delta });
    }

    protected onPortMouseDown(event: MouseEvent, portIndex: number): void {
        event.stopPropagation();
        event.preventDefault();
        this.portDragStart.emit({ serviceId: this.service().id, portIndex });
    }

    protected onPortMouseUp(event: MouseEvent, portIndex: number): void {
        event.stopPropagation();
        this.portDragEnd.emit({ serviceId: this.service().id, portIndex });
    }

    protected onPortClick(event: MouseEvent, portIndex: number): void {
        event.stopPropagation();
        if (event.detail !== 0) return;
        this.portActivate.emit({ serviceId: this.service().id, portIndex });
    }
}
