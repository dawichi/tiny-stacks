import { Component, computed, inject, signal } from '@angular/core';
import { Database, Globe, LucideAngularModule, Mail, Server, Split, Zap } from 'lucide-angular';
import { GameStateService } from '../../core/game/game-state.service';
import {
    getAllServiceTypes,
    getServiceConfig,
    type ServiceType,
    type ServiceTypeConfig,
} from '../../core/game/service-types.config';

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
          <h3 class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">
            Services
          </h3>

          <div class="flex flex-col gap-1.5">
            @for (serviceType of serviceTypes(); track serviceType) {
              <div
                class="service-item flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-grab
                       hover:bg-white/60 transition-colors duration-150 select-none"
                draggable="true"
                (dragstart)="onDragStart($event, serviceType)"
                (dragend)="onDragEnd()"
              >
                <!-- Icon -->
                <div
                  class="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                  [style.background-color]="getConfig(serviceType).color"
                >
                  <lucide-icon
                    [img]="getIcon(serviceType)"
                    [size]="16"
                    class="text-white/90"
                  />
                </div>

                <!-- Name & size -->
                <div class="flex flex-col min-w-0">
                  <span class="text-sm font-medium text-slate-700 truncate">
                    {{ getConfig(serviceType).name }}
                  </span>
                  <span class="text-[10px] text-slate-400">
                    {{ getConfig(serviceType).gridWidth }}&times;{{ getConfig(serviceType).gridHeight }}
                  </span>
                </div>
              </div>
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
    private readonly gameState = inject(GameStateService);

    // ── Properties ─────────────────────────────────────────────────────
    protected readonly collapsed = signal(false);

    protected readonly serviceTypes = computed(() => getAllServiceTypes());

    private readonly icons = {
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

    protected onDragStart(event: DragEvent, type: ServiceType): void {
        this.gameState.draggingType.set(type);
        event.dataTransfer?.setData('application/service-type', type);
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'copy';
        }
    }

    protected onDragEnd(): void {
        this.gameState.draggingType.set(null);
    }
}
