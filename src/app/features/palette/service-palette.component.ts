import { Component, computed, inject, input, signal } from '@angular/core';
import { Cloud, Database, Globe, LucideAngularModule, Mail, Server, Split, Zap } from 'lucide-angular';
import { GameStateService } from '../../core/game/game-state.service';
import {
    getAllServiceTypes,
    getServiceConfig,
    type ServiceType,
    type ServiceTypeConfig,
} from '../../core/game/service-types.config';

interface PaletteItem {
    type: ServiceType;
    remaining: number; // Infinity = unlimited (sandbox)
}

@Component({
    selector: 'app-service-palette',
    standalone: true,
    imports: [LucideAngularModule],
    template: `
    <div class="palette fixed bottom-6 left-6 z-50">
      <!-- Toggle button -->
      <button
        class="toggle-btn w-10 h-10 rounded-full flex items-center justify-center
               bg-white/80 backdrop-blur-md border border-white/40 shadow-lg
               hover:bg-white/90 transition-all duration-200 mb-2"
        (click)="toggleCollapsed()"
        [attr.aria-label]="collapsed() ? 'Open service palette' : 'Close service palette'"
      >
        <span class="text-slate-600 text-lg font-bold select-none">
          {{ collapsed() ? '+' : '-' }}
        </span>
      </button>

      <!-- Palette panel -->
      @if (!collapsed()) {
        <div class="panel bg-white/70 backdrop-blur-md border border-white/40
                    rounded-xl shadow-xl p-3 w-52">
          <h2 class="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 px-1">
            Services
          </h2>

          <div class="flex flex-col gap-1.5">
            @for (item of paletteItems(); track item.type) {
              <button
                type="button"
                class="service-item w-full text-left flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors duration-150 select-none
                       focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                [class.cursor-grab]="item.remaining > 0"
                [class.cursor-not-allowed]="item.remaining <= 0"
                [class.opacity-40]="item.remaining <= 0"
                [class.hover:bg-white/60]="item.remaining > 0"
                [class.ring-2]="gameState.draggingType() === item.type && gameState.keyboardPlacementActive()"
                [class.ring-blue-500]="gameState.draggingType() === item.type && gameState.keyboardPlacementActive()"
                [draggable]="item.remaining > 0"
                [disabled]="item.remaining <= 0"
                [attr.aria-pressed]="gameState.draggingType() === item.type"
                [attr.aria-label]="itemLabel(item)"
                (click)="onItemClick($event, item.type)"
                (dragstart)="onDragStart($event, item.type, item.remaining)"
                (dragend)="onDragEnd()"
              >
                <!-- Icon -->
                <div
                  class="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                  [style.background-color]="getConfig(item.type).color"
                >
                  <lucide-icon
                    [img]="getIcon(item.type)"
                    [size]="16"
                    class="text-white/90"
                  />
                </div>

                <!-- Name, size & remaining count -->
                <div class="flex flex-col min-w-0 flex-1">
                  <span class="text-sm font-medium text-slate-700 truncate">
                    {{ getConfig(item.type).name }}
                  </span>
                  <span class="text-[10px] text-slate-600">
                    {{ getConfig(item.type).gridWidth }}&times;{{ getConfig(item.type).gridHeight }}
                  </span>
                </div>

                @if (item.remaining !== Infinity) {
                  <span class="text-[10px] font-semibold shrink-0"
                    [class.text-slate-600]="item.remaining > 0"
                    [class.text-red-400]="item.remaining <= 0"
                  >
                    {{ item.remaining }} left
                  </span>
                }
              </button>
            }
          </div>
        </div>
      }
    </div>
  `,
    styles: [
        `
    .service-item:active {
      cursor: grabbing;
    }

    .panel {
      animation: palette-in 200ms ease-out;
    }

    @keyframes palette-in {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `,
    ],
})
export class ServicePaletteComponent {
    // ── Injected Services ──────────────────────────────────────────────
    protected readonly gameState = inject(GameStateService);

    // ── Inputs ────────────────────────────────────────────────────────
    /** Challenge resource limits. null = sandbox mode (all types, unlimited). */
    readonly availableResources = input<{ type: ServiceType; count: number }[] | null>(null);

    // ── Properties ─────────────────────────────────────────────────────
    protected readonly collapsed = signal(false);
    protected readonly Infinity = Infinity;

    protected readonly paletteItems = computed<PaletteItem[]>(() => {
        const resources = this.availableResources();
        const editable = this.gameState.editable();

        if (resources === null) {
            return getAllServiceTypes().map((type) => ({ type, remaining: editable ? Infinity : 0 }));
        }

        return resources.map(({ type, count }) => ({
            type,
            remaining: editable ? count - this.gameState.placedByPlayer(type) : 0,
        }));
    });

    private readonly icons = {
        cloud: Cloud,
        globe: Globe,
        server: Server,
        database: Database,
        zap: Zap,
        mail: Mail,
        split: Split,
    };

    // ── Public Methods ─────────────────────────────────────────────────
    protected toggleCollapsed(): void {
        this.collapsed.update((v) => !v);
    }

    protected getConfig(type: ServiceType): ServiceTypeConfig {
        return getServiceConfig(type);
    }

    protected getIcon(type: ServiceType) {
        const iconName = getServiceConfig(type).icon as keyof typeof this.icons;
        return this.icons[iconName] || Globe;
    }

    protected itemLabel(item: PaletteItem): string {
        const name = getServiceConfig(item.type).name;
        const available = item.remaining === Infinity ? 'unlimited available' : `${item.remaining} remaining`;
        return `Choose ${name} for placement, ${available}`;
    }

    protected onItemClick(event: MouseEvent, type: ServiceType): void {
        this.gameState.draggingType.set(type);
        this.gameState.keyboardPlacementActive.set(event.detail === 0);
    }

    protected onDragStart(event: DragEvent, type: ServiceType, remaining: number): void {
        if (remaining <= 0) {
            event.preventDefault();
            return;
        }
        this.gameState.draggingType.set(type);
        this.gameState.keyboardPlacementActive.set(false);
        event.dataTransfer?.setData('application/service-type', type);
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'copy';
        }
    }

    protected onDragEnd(): void {
        this.gameState.draggingType.set(null);
        this.gameState.keyboardPlacementActive.set(false);
    }
}
