import { Component, computed, inject } from "@angular/core";
import { GameStateService } from "../../core/game/game-state.service";
import { ServiceComponent } from "../services/service.component";

@Component({
    selector: "app-game-board",
    standalone: true,
    imports: [ServiceComponent],
    template: `
    <div
      class="game-board relative bg-slate-100 rounded-lg overflow-hidden"
      [style.width.px]="boardWidth()"
      [style.height.px]="boardHeight()"
    >
      <!-- Grid lines -->
      <div
        class="absolute inset-0 pointer-events-none"
        [style.background-image]="gridPattern()"
        [style.background-size]="cellSize() + 'px ' + cellSize() + 'px'"
      ></div>

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
    protected readonly gameState = inject(GameStateService);

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
        // Create subtle grid lines using CSS gradient
        const lineColor = "rgba(148, 163, 184, 0.3)"; // slate-400 with opacity
        return `
      linear-gradient(to right, ${lineColor} 1px, transparent 1px),
      linear-gradient(to bottom, ${lineColor} 1px, transparent 1px)
    `;
    });

    protected onServiceClick(id: string): void {
        this.gameState.selectService(id);
    }
}
