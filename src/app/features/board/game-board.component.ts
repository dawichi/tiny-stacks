import { Component, computed, inject, signal } from '@angular/core';
import { GameStateService } from '../../core/game/game-state.service';
import { getServiceConfig, type ServiceType } from '../../core/game/service-types.config';
import { ServiceComponent } from '../services/service.component';

interface HoverPosition {
    gridX: number;
    gridY: number;
}

@Component({
    selector: 'app-game-board',
    standalone: true,
    imports: [ServiceComponent],
    template: `
    <div
      class="game-board relative bg-slate-100 rounded-lg overflow-hidden"
      [style.width.px]="boardWidth()"
      [style.height.px]="boardHeight()"
      (dragover)="onDragOver($event)"
      (dragleave)="onDragLeave($event)"
      (drop)="onDrop($event)"
    >
      <!-- Grid lines -->
      <div
        class="absolute inset-0 pointer-events-none"
        [style.background-image]="gridPattern()"
        [style.background-size]="cellSize() + 'px ' + cellSize() + 'px'"
      ></div>

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
          (click)="onServiceClick(service.id)"
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

    // ── Properties ─────────────────────────────────────────────────────
    private readonly hoverPosition = signal<HoverPosition | null>(null);

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

    // ── Preview computed signals ───────────────────────────────────────
    protected readonly previewVisible = computed(() => {
        return this.gameState.draggingType() !== null && this.hoverPosition() !== null;
    });

    protected readonly previewValid = computed(() => {
        const type = this.gameState.draggingType();
        const pos = this.hoverPosition();
        if (!type || !pos) return false;
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
        const type = this.gameState.draggingType();
        if (!type) return 0;
        return getServiceConfig(type).gridWidth * this.cellSize();
    });

    protected readonly previewHeight = computed(() => {
        const type = this.gameState.draggingType();
        if (!type) return 0;
        return getServiceConfig(type).gridHeight * this.cellSize();
    });

    // ── Methods ────────────────────────────────────────────────────────
    protected onServiceClick(id: string): void {
        this.gameState.selectService(id);
    }

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

    private eventToGrid(event: DragEvent): HoverPosition | null {
        const target = event.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();
        const cellSize = this.cellSize();

        const gridX = Math.floor((event.clientX - rect.left) / cellSize);
        const gridY = Math.floor((event.clientY - rect.top) / cellSize);

        const grid = this.gameState.gridConfig();
        if (gridX < 0 || gridY < 0 || gridX >= grid.width || gridY >= grid.height) {
            return null;
        }

        return { gridX, gridY };
    }
}
