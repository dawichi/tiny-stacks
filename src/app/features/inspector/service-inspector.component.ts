import { Component, computed, inject } from '@angular/core';
import { Database, Globe, LucideAngularModule, Mail, Server, Split, Trash2, X, Zap } from 'lucide-angular';
import { GameStateService } from '../../core/game/game-state.service';
import { getServiceConfig } from '../../core/game/service-types.config';

@Component({
    selector: 'app-service-inspector',
    standalone: true,
    imports: [LucideAngularModule],
    template: `
    @if (service()) {
      <div class="inspector fixed right-6 top-1/2 -translate-y-1/2 z-50
                  bg-white/70 backdrop-blur-md border border-white/40
                  rounded-xl shadow-xl p-4 w-64">

        <!-- Header -->
        <div class="flex items-center gap-2.5 mb-3">
          <div
            class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            [style.background-color]="config()!.color"
          >
            <lucide-icon [img]="iconComponent()" [size]="18" class="text-white/90" />
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="text-sm font-semibold text-slate-800 truncate">{{ config()!.name }}</h3>
            <span class="text-[10px] text-slate-400">
              {{ config()!.gridWidth }}&times;{{ config()!.gridHeight }} &middot;
              ({{ service()!.gridX }}, {{ service()!.gridY }})
            </span>
          </div>
          <button
            class="w-6 h-6 flex items-center justify-center rounded-md
                   hover:bg-slate-200/60 transition-colors text-slate-400 hover:text-slate-600"
            (click)="onClose()"
          >
            <lucide-icon [img]="XIcon" [size]="14" />
          </button>
        </div>

        <!-- Description -->
        <p class="text-xs text-slate-500 mb-3 leading-relaxed">{{ config()!.description }}</p>

        <!-- Simulation params -->
        <div class="mb-3">
          <h4 class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Simulation</h4>
          <div class="grid grid-cols-3 gap-1.5">
            <div class="stat-card bg-white/50 rounded-md p-1.5 text-center">
              <div class="text-xs font-semibold text-slate-700">{{ config()!.baseProcessingTime }}ms</div>
              <div class="text-[9px] text-slate-400">Latency</div>
            </div>
            <div class="stat-card bg-white/50 rounded-md p-1.5 text-center">
              <div class="text-xs font-semibold text-slate-700">{{ config()!.maxConcurrency }}</div>
              <div class="text-[9px] text-slate-400">Concurrency</div>
            </div>
            <div class="stat-card bg-white/50 rounded-md p-1.5 text-center">
              <div class="text-xs font-semibold text-slate-700">{{ config()!.queueSize }}</div>
              <div class="text-[9px] text-slate-400">Queue</div>
            </div>
          </div>
        </div>

        <!-- Ports -->
        <div class="mb-3">
          <h4 class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Ports</h4>
          <div class="flex flex-col gap-1">
            @for (port of config()!.ports; track $index) {
              <div class="flex items-center gap-2 text-xs text-slate-600">
                <span
                  class="w-2 h-2 rounded-full shrink-0"
                  [style.background-color]="portColor(port.direction)"
                ></span>
                <span class="capitalize">{{ port.direction }}</span>
                <span class="text-slate-400">&middot; {{ port.edge }}</span>
              </div>
            }
          </div>
        </div>

        <!-- Connections -->
        @if (serviceConnections().length > 0) {
          <div class="mb-3">
            <h4 class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Connections ({{ serviceConnections().length }})
            </h4>
            <div class="flex flex-col gap-1">
              @for (conn of serviceConnections(); track conn.id) {
                <div class="flex items-center gap-1.5 text-xs text-slate-600 group">
                  <span class="text-slate-400">{{ conn.direction }}</span>
                  <span class="truncate flex-1">{{ conn.otherServiceName }}</span>
                  <button
                    class="w-4 h-4 flex items-center justify-center rounded
                           opacity-0 group-hover:opacity-100 transition-opacity
                           hover:bg-red-100 text-red-400 hover:text-red-600"
                    (click)="onDeleteConnection(conn.id)"
                  >
                    <lucide-icon [img]="XIcon" [size]="10" />
                  </button>
                </div>
              }
            </div>
          </div>
        }

        <!-- Delete action -->
        <button
          class="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs
                 text-red-500 hover:bg-red-50/60 transition-colors border border-red-200/50"
          (click)="onDelete()"
        >
          <lucide-icon [img]="Trash2Icon" [size]="12" />
          Delete Service
        </button>
      </div>
    }
  `,
    styles: [
        `
    .inspector {
      animation: inspector-in 200ms ease-out;
    }

    @keyframes inspector-in {
      from {
        opacity: 0;
        transform: translateY(-50%) translateX(8px);
      }
      to {
        opacity: 1;
        transform: translateY(-50%) translateX(0);
      }
    }
  `,
    ],
})
export class ServiceInspectorComponent {
    // ── Injected Services ──────────────────────────────────────────────
    private readonly gameState = inject(GameStateService);

    // ── Icon references ────────────────────────────────────────────────
    protected readonly XIcon = X;
    protected readonly Trash2Icon = Trash2;

    private readonly icons = {
        globe: Globe,
        server: Server,
        database: Database,
        zap: Zap,
        mail: Mail,
        split: Split,
    };

    // ── Computed signals ───────────────────────────────────────────────
    protected readonly service = this.gameState.selectedService;

    protected readonly config = computed(() => {
        const s = this.service();
        return s ? getServiceConfig(s.type) : null;
    });

    protected readonly iconComponent = computed(() => {
        const cfg = this.config();
        if (!cfg) return Globe;
        const iconName = cfg.icon as keyof typeof this.icons;
        return this.icons[iconName] || Globe;
    });

    protected readonly serviceConnections = computed(() => {
        const s = this.service();
        if (!s) return [];

        const connections = this.gameState.connections();
        const services = this.gameState.services();

        return connections
            .filter((c) => c.source.serviceId === s.id || c.target.serviceId === s.id)
            .map((c) => {
                const isSource = c.source.serviceId === s.id;
                const otherId = isSource ? c.target.serviceId : c.source.serviceId;
                const otherService = services.find((svc) => svc.id === otherId);
                const otherName = otherService ? getServiceConfig(otherService.type).name : 'Unknown';

                return {
                    id: c.id,
                    direction: isSource ? '\u2192' : '\u2190',
                    otherServiceName: otherName,
                };
            });
    });

    // ── Methods ────────────────────────────────────────────────────────
    protected portColor(direction: string): string {
        switch (direction) {
            case 'input':
                return '#22c55e';
            case 'output':
                return '#3b82f6';
            case 'bidirectional':
                return '#f97316';
            default:
                return '#9ca3af';
        }
    }

    protected onClose(): void {
        this.gameState.selectService(null);
    }

    protected onDelete(): void {
        const s = this.service();
        if (s) {
            this.gameState.removeService(s.id);
        }
    }

    protected onDeleteConnection(connectionId: string): void {
        this.gameState.removeConnection(connectionId);
    }
}
