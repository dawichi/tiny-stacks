import { DecimalPipe } from '@angular/common';
import { Component, effect, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArrowLeft, LucideAngularModule, RotateCcw } from 'lucide-angular';
import type { Board, Connection } from '../../core/game/game-state.service';
import { createConnectionId, createServiceId, GameStateService } from '../../core/game/game-state.service';
import { ServiceType } from '../../core/game/service-types.config';
import { RequestMethod, type TrafficPattern, WRITE_METHODS } from '../../core/game/sim-types';
import { DEFAULT_TRAFFIC, SIM_SPEEDS, TickEngineService } from '../../core/game/tick-engine.service';
import { SANDBOX_STATE_VERSION, StorageKeys, StorageService } from '../../core/storage/storage.service';
import { sanitizeSandboxState } from '../../core/storage/storage-schema';
import { GameBoardComponent } from '../board/game-board.component';
import { ServiceInspectorComponent } from '../inspector/service-inspector.component';
import { ServicePaletteComponent } from '../palette/service-palette.component';
import { ScreenGuardComponent } from '../screen-guard/screen-guard.component';

@Component({
    selector: 'app-sandbox-page',
    standalone: true,
    imports: [
        DecimalPipe,
        RouterLink,
        LucideAngularModule,
        GameBoardComponent,
        ServiceInspectorComponent,
        ServicePaletteComponent,
        ScreenGuardComponent,
    ],
    template: `
    <main class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 p-8">
      <header class="max-w-5xl mx-auto mb-6 flex items-center gap-4">
        <a routerLink="/" class="text-slate-600 hover:text-slate-700 transition-colors" aria-label="Back to home">
          <lucide-icon [img]="ArrowLeftIcon" [size]="20" />
        </a>
        <div class="flex-1">
          <h1 class="text-3xl font-bold text-slate-800">tiny-stacks</h1>
          <p class="text-slate-600">Sandbox</p>
        </div>
        <button
          class="flex items-center gap-2 rounded-lg bg-white/70 px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-white"
          (click)="resetToExample()"
        >
          <lucide-icon [img]="ResetIcon" [size]="14" />
          Reset to example
        </button>
        <button
          class="rounded-lg bg-white/70 px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-white"
          aria-label="Change simulation speed"
          (click)="cycleSpeed()"
        >
          {{ speed() }}×
        </button>
      </header>

      <div class="flex justify-center">
        <app-game-board />
      </div>

      <app-service-palette />
      <app-service-inspector />
      <app-screen-guard />

      <aside class="fixed left-6 top-28 z-40 w-56 rounded-xl border border-white/50 bg-white/75 p-3 shadow-lg backdrop-blur-md">
        <h2 class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Live system</h2>
        <div class="grid grid-cols-2 gap-x-3 gap-y-2">
          <div>
            <div class="text-sm font-semibold text-slate-700">{{ metrics().throughput | number: '1.0-1' }}/s</div>
            <div class="text-[9px] text-slate-600">Throughput</div>
          </div>
          <div>
            <div class="text-sm font-semibold text-slate-700">{{ metrics().errorRate | number: '1.0-1' }}%</div>
            <div class="text-[9px] text-slate-600">Errors</div>
          </div>
          <div>
            <div class="text-sm font-semibold text-slate-700">{{ metrics().avgLatency | number: '1.0-0' }} ms</div>
            <div class="text-[9px] text-slate-600">Average latency</div>
          </div>
          <div>
            <div class="text-sm font-semibold text-slate-700">{{ metrics().p95Latency | number: '1.0-0' }} ms</div>
            <div class="text-[9px] text-slate-600">P95 latency</div>
          </div>
          <div>
            <div class="text-sm font-semibold text-slate-700">&#36;{{ metrics().costPerSecond | number: '1.0-0' }}/s</div>
            <div class="text-[9px] text-slate-600">Current cost</div>
          </div>
          <div>
            <div class="text-sm font-semibold text-slate-700">{{ metrics().asyncPending }}</div>
            <div class="text-[9px] text-slate-600">Queued messages</div>
          </div>
        </div>
      </aside>
    </main>
  `,
})
export class SandboxPageComponent implements OnInit, OnDestroy {
    private readonly simulation = inject(TickEngineService);
    private readonly gameState = inject(GameStateService);
    private readonly storage = inject(StorageService);
    private readonly persistenceReady = signal(false);

    protected readonly ArrowLeftIcon = ArrowLeft;
    protected readonly ResetIcon = RotateCcw;
    protected readonly metrics = this.simulation.metrics;
    protected readonly speed = this.simulation.speed;

    constructor() {
        effect(() => {
            if (this.persistenceReady()) this.persistBoard();
        });
    }

    ngOnInit(): void {
        this.simulation.stop();
        this.simulation.sandboxMode.set(true);

        const saved = sanitizeSandboxState(this.storage.getItem(StorageKeys.GAME_STATE));
        const board = saved ?? this.createExampleBoard();
        this.gameState.loadBoard(board);
        this.restoreTraffic(board, saved?.originRps ?? {});
        this.persistenceReady.set(true);
        this.simulation.start();
    }

    ngOnDestroy(): void {
        this.persistBoard();
        this.persistenceReady.set(false);
        this.simulation.sandboxMode.set(false);
        this.simulation.stop();
    }

    protected resetToExample(): void {
        const board = this.createExampleBoard();
        this.gameState.loadBoard(board);
        this.restoreTraffic(board, {});
        this.simulation.stop();
        this.simulation.start();
    }

    protected cycleSpeed(): void {
        const index = SIM_SPEEDS.indexOf(this.speed());
        const next = SIM_SPEEDS[(index + 1) % SIM_SPEEDS.length];
        if (next !== undefined) this.simulation.speed.set(next);
    }

    private restoreTraffic(board: Board, savedRates: Record<string, number>): void {
        const overrides = new Map<string, TrafficPattern>();
        for (const service of board.services) {
            if (service.type !== ServiceType.ORIGIN) continue;
            const requestsPerSecond = savedRates[service.id] ?? DEFAULT_TRAFFIC.requestsPerSecond;
            overrides.set(service.id, { ...DEFAULT_TRAFFIC, requestsPerSecond });
        }
        this.simulation.trafficOverrides.set(overrides);
    }

    private persistBoard(): void {
        const services = this.gameState.services();
        const originRps: Record<string, number> = {};
        for (const service of services) {
            if (service.type === ServiceType.ORIGIN) {
                originRps[service.id] = this.simulation.trafficFor(service.id).requestsPerSecond;
            }
        }
        this.storage.setItem(StorageKeys.GAME_STATE, {
            version: SANDBOX_STATE_VERSION,
            services,
            connections: this.gameState.connections(),
            originRps,
        });
    }

    private createExampleBoard(): Board {
        const origin = { id: createServiceId(), type: ServiceType.ORIGIN, gridX: 2, gridY: 6 };
        const gateway = { id: createServiceId(), type: ServiceType.API_GATEWAY, gridX: 5, gridY: 6 };
        const rest = { id: createServiceId(), type: ServiceType.REST_SERVICE, gridX: 9, gridY: 6 };
        const cache = { id: createServiceId(), type: ServiceType.CACHE, gridX: 12, gridY: 5 };
        const database = { id: createServiceId(), type: ServiceType.DATABASE, gridX: 16, gridY: 5 };
        const connect = (
            sourceId: string,
            sourcePort: number,
            targetId: string,
            targetPort: number,
            methods?: RequestMethod[],
        ): Connection => ({
            id: createConnectionId(),
            source: { serviceId: sourceId, portIndex: sourcePort },
            target: { serviceId: targetId, portIndex: targetPort },
            ...(methods ? { filter: { methods, weight: 100 } } : {}),
        });

        return {
            services: [origin, gateway, rest, cache, database],
            connections: [
                connect(origin.id, 0, gateway.id, 0),
                connect(gateway.id, 1, rest.id, 0),
                connect(rest.id, 1, cache.id, 0, [RequestMethod.GET]),
                connect(cache.id, 1, database.id, 0),
                connect(rest.id, 1, database.id, 0, [...WRITE_METHODS]),
            ],
        };
    }
}
