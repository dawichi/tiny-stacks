import { Component, computed, inject } from '@angular/core';
import { Cloud, Database, Globe, LucideAngularModule, Mail, Server, Split, Trash2, X, Zap } from 'lucide-angular';
import type { Connection } from '../../core/game/game-state.service';
import { GameStateService } from '../../core/game/game-state.service';
import { getServiceConfig, ServiceType } from '../../core/game/service-types.config';
import { REQUEST_METHOD_COLORS, RequestMethod } from '../../core/game/sim-types';
import { TickEngineService } from '../../core/game/tick-engine.service';

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

        <!-- Live stats (when simulation running + not Origin) -->
        @if (showLiveStats()) {
          <div class="mb-3">
            <h4 class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Live</h4>
            <div class="grid grid-cols-2 gap-1.5">
              <div class="stat-card bg-white/50 rounded-md p-1.5">
                <div class="text-xs font-semibold text-slate-700">
                  {{ liveVisual()!.queueCount }}/{{ liveVisual()!.queueCapacity }}
                </div>
                <div class="text-[9px] text-slate-400 mb-1">Queue</div>
                <div class="h-1 bg-black/10 rounded-full overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all duration-200"
                    [style.width.%]="liveVisual()!.queueRatio * 100"
                    [style.background-color]="queueBarColor()"
                  ></div>
                </div>
              </div>
              <div class="stat-card bg-white/50 rounded-md p-1.5">
                <div class="text-xs font-semibold text-slate-700">
                  {{ liveVisual()!.processingCount }}/{{ liveVisual()!.maxConcurrency }}
                </div>
                <div class="text-[9px] text-slate-400 mb-1">Processing</div>
                <div class="h-1 bg-black/10 rounded-full overflow-hidden">
                  <div
                    class="h-full rounded-full bg-blue-400 transition-all duration-200"
                    [style.width.%]="liveVisual()!.processingRatio * 100"
                  ></div>
                </div>
              </div>
            </div>
          </div>
        }

        <!-- Cache stats (only for Cache services when sim running) -->
        @if (showCacheStats()) {
          <div class="mb-3">
            <h4 class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Cache</h4>
            <div class="grid grid-cols-3 gap-1.5">
              <div class="stat-card bg-white/50 rounded-md p-1.5 text-center">
                <div class="text-xs font-semibold text-emerald-600">
                  {{ cacheHitRate() }}%
                </div>
                <div class="text-[9px] text-slate-400">Hit Rate</div>
              </div>
              <div class="stat-card bg-white/50 rounded-md p-1.5 text-center">
                <div class="text-xs font-semibold text-slate-700">
                  {{ cacheStats()!.hitCount }}/{{ cacheStats()!.missCount }}
                </div>
                <div class="text-[9px] text-slate-400">Hit/Miss</div>
              </div>
              <div class="stat-card bg-white/50 rounded-md p-1.5 text-center">
                <div class="text-xs font-semibold text-slate-700">
                  {{ cacheStats()!.cachedResources }}
                </div>
                <div class="text-[9px] text-slate-400">Cached</div>
              </div>
            </div>
          </div>
        }

        <!-- Simulation params (static config) -->
        @if (!isOrigin()) {
          <div class="mb-3">
            <h4 class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Config</h4>
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
        }

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

    <!-- Connection Inspector -->
    @if (selectedConnection()) {
      <div class="inspector fixed right-6 top-1/2 -translate-y-1/2 z-50
                  bg-white/70 backdrop-blur-md border border-white/40
                  rounded-xl shadow-xl p-4 w-64">

        <!-- Header -->
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-semibold text-slate-800">Connection</h3>
          <button
            class="w-6 h-6 flex items-center justify-center rounded-md
                   hover:bg-slate-200/60 transition-colors text-slate-400 hover:text-slate-600"
            (click)="onCloseConnection()"
          >
            <lucide-icon [img]="XIcon" [size]="14" />
          </button>
        </div>

        <!-- Source → Target -->
        <div class="flex items-center gap-2 text-xs text-slate-600 mb-4">
          <span class="font-medium">{{ connSourceName() }}</span>
          <span class="text-slate-400">&rarr;</span>
          <span class="font-medium">{{ connTargetName() }}</span>
        </div>

        <!-- Method filter -->
        <div class="mb-4">
          <h4 class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Allowed Methods</h4>
          <div class="flex gap-1.5">
            @for (m of allMethods; track m) {
              <button
                class="method-toggle flex-1 text-[10px] font-semibold py-1 rounded-md transition-all"
                [class.active]="isMethodActive(m)"
                [style.background-color]="isMethodActive(m) ? methodColor(m) : 'transparent'"
                [style.color]="isMethodActive(m) ? 'white' : methodColor(m)"
                [style.border]="'1px solid ' + methodColor(m)"
                (click)="onToggleMethod(m)"
              >
                {{ m }}
              </button>
            }
          </div>
        </div>

        <!-- Weight slider -->
        <div class="mb-4">
          <div class="flex items-center justify-between mb-1.5">
            <h4 class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Weight</h4>
            <span class="text-xs font-semibold text-slate-700">{{ connWeight() }}</span>
          </div>
          <input
            type="range"
            min="1"
            max="100"
            [value]="connWeight()"
            (input)="onWeightChange($event)"
            class="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-blue-500"
          />
        </div>

        <!-- Delete -->
        <button
          class="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs
                 text-red-500 hover:bg-red-50/60 transition-colors border border-red-200/50"
          (click)="onDeleteSelectedConnection()"
        >
          <lucide-icon [img]="Trash2Icon" [size]="12" />
          Delete Connection
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
    private readonly tickEngine = inject(TickEngineService);

    // ── Icon references ────────────────────────────────────────────────
    protected readonly XIcon = X;
    protected readonly Trash2Icon = Trash2;

    private readonly icons = {
        cloud: Cloud,
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

    protected readonly isOrigin = computed(() => {
        return this.service()?.type === ServiceType.ORIGIN;
    });

    protected readonly liveVisual = computed(() => {
        const s = this.service();
        if (!s) return null;
        return this.tickEngine.serviceVisuals().get(s.id) ?? null;
    });

    protected readonly showLiveStats = computed(() => {
        return this.tickEngine.running() && this.liveVisual() !== null;
    });

    protected readonly cacheStats = computed(() => {
        return this.liveVisual()?.cacheStats ?? null;
    });

    protected readonly showCacheStats = computed(() => {
        return this.tickEngine.running() && this.cacheStats() !== null;
    });

    protected readonly cacheHitRate = computed(() => {
        const stats = this.cacheStats();
        if (!stats) return 0;
        const total = stats.hitCount + stats.missCount;
        if (total === 0) return 0;
        return Math.round((stats.hitCount / total) * 100);
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

    // ── Connection inspector signals ────────────────────────────────────
    protected readonly allMethods = [RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE];

    protected readonly selectedConnection = computed<Connection | null>(() => {
        if (this.service()) return null; // service inspector takes priority
        const connId = this.gameState.selectedConnectionId();
        if (!connId) return null;
        return this.gameState.connections().find((c) => c.id === connId) ?? null;
    });

    protected readonly connSourceName = computed(() => {
        const conn = this.selectedConnection();
        if (!conn) return '';
        const svc = this.gameState.services().find((s) => s.id === conn.source.serviceId);
        return svc ? getServiceConfig(svc.type).name : 'Unknown';
    });

    protected readonly connTargetName = computed(() => {
        const conn = this.selectedConnection();
        if (!conn) return '';
        const svc = this.gameState.services().find((s) => s.id === conn.target.serviceId);
        return svc ? getServiceConfig(svc.type).name : 'Unknown';
    });

    protected readonly connWeight = computed(() => {
        return this.selectedConnection()?.filter?.weight ?? 100;
    });

    protected readonly connMethods = computed(() => {
        return this.selectedConnection()?.filter?.methods ?? [];
    });

    // ── Methods ────────────────────────────────────────────────────────
    protected isMethodActive(method: RequestMethod): boolean {
        const methods = this.connMethods();
        return methods.length === 0 || methods.includes(method);
    }

    protected methodColor(method: RequestMethod): string {
        return REQUEST_METHOD_COLORS[method];
    }

    protected onToggleMethod(method: RequestMethod): void {
        const conn = this.selectedConnection();
        if (!conn) return;

        let currentMethods = conn.filter?.methods ?? [];
        const currentWeight = conn.filter?.weight ?? 100;

        // If empty (all allowed), initialize with all methods then toggle off the clicked one
        if (currentMethods.length === 0) {
            currentMethods = this.allMethods.filter((m) => m !== method);
        } else if (currentMethods.includes(method)) {
            currentMethods = currentMethods.filter((m) => m !== method);
        } else {
            currentMethods = [...currentMethods, method];
        }

        // If all 4 selected, reset to empty (= all allowed)
        if (currentMethods.length === this.allMethods.length) {
            currentMethods = [];
        }

        this.gameState.updateConnectionFilter(conn.id, { methods: currentMethods, weight: currentWeight });
    }

    protected onWeightChange(event: Event): void {
        const conn = this.selectedConnection();
        if (!conn) return;
        const value = Number.parseInt((event.target as HTMLInputElement).value, 10);
        const currentMethods = conn.filter?.methods ?? [];
        this.gameState.updateConnectionFilter(conn.id, { methods: currentMethods, weight: value });
    }

    protected onCloseConnection(): void {
        this.gameState.selectedConnectionId.set(null);
    }

    protected onDeleteSelectedConnection(): void {
        const conn = this.selectedConnection();
        if (conn) {
            this.gameState.removeConnection(conn.id);
        }
    }

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

    protected queueBarColor(): string {
        const visual = this.liveVisual();
        if (!visual) return '#22c55e';
        if (visual.queueRatio > 0.8) return '#ef4444';
        if (visual.queueRatio > 0.5) return '#eab308';
        return '#22c55e';
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
