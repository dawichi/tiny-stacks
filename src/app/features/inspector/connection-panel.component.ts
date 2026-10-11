import { Component, computed, inject } from '@angular/core';
import { LucideAngularModule, Trash2, X } from 'lucide-angular';
import type { Connection } from '../../core/game/game-state.service';
import { GameStateService } from '../../core/game/game-state.service';
import { getServiceConfig } from '../../core/game/service-types.config';
import { REQUEST_METHOD_COLORS, RequestMethod } from '../../core/game/sim-types';

@Component({
    selector: 'app-connection-panel',
    standalone: true,
    imports: [LucideAngularModule],
    template: `
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
            (click)="onClose()"
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
          <h4 class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Route Rule</h4>
          <div class="flex gap-1.5">
            @for (m of allMethods; track m) {
              <button
                class="method-toggle flex-1 text-[10px] font-semibold py-1 rounded-md transition-all"
                [class.active]="isMethodActive(m)"
                [style.background-color]="isMethodActive(m) ? methodColor(m) : 'transparent'"
                [style.color]="isMethodActive(m) ? 'white' : methodColor(m)"
                [style.border]="'1px solid ' + methodColor(m)"
                [disabled]="!gameState.editable()"
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
            [disabled]="!gameState.editable()"
            (pointerdown)="onWeightStart()"
            (keydown)="onWeightStart()"
            (input)="onWeightChange($event)"
            (change)="onWeightCommit()"
            class="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-blue-500"
          />
        </div>

        <!-- Delete -->
        <button
          class="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs
                 text-red-500 hover:bg-red-50/60 transition-colors border border-red-200/50"
          [disabled]="!gameState.editable()"
          (click)="onDelete()"
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
      from { opacity: 0; transform: translateY(-50%) translateX(8px); }
      to   { opacity: 1; transform: translateY(-50%) translateX(0); }
    }
  `,
    ],
})
export class ConnectionPanelComponent {
    // ── Injected Services ──────────────────────────────────────────────
    protected readonly gameState = inject(GameStateService);

    // ── Icon references ────────────────────────────────────────────────
    protected readonly XIcon = X;
    protected readonly Trash2Icon = Trash2;
    protected readonly allMethods = [RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE];

    // ── Computed signals ───────────────────────────────────────────────
    protected readonly selectedConnection = computed<Connection | null>(() => {
        if (this.gameState.selectedService()) return null; // service panel takes priority
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

    protected readonly connWeight = computed(() => this.selectedConnection()?.filter?.weight ?? 100);

    protected readonly connMethods = computed(() => this.selectedConnection()?.filter?.methods ?? []);

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

        if (currentMethods.length === 0) {
            currentMethods = this.allMethods.filter((m) => m !== method);
        } else if (currentMethods.includes(method)) {
            currentMethods = currentMethods.filter((m) => m !== method);
        } else {
            currentMethods = [...currentMethods, method];
        }

        if (currentMethods.length === this.allMethods.length) currentMethods = [];

        this.gameState.updateConnectionFilter(conn.id, { methods: currentMethods, weight: currentWeight });
    }

    protected onWeightChange(event: Event): void {
        const conn = this.selectedConnection();
        if (!conn) return;
        this.gameState.beginConnectionFilterEdit(conn.id);
        const value = Number.parseInt((event.target as HTMLInputElement).value, 10);
        const currentMethods = conn.filter?.methods ?? [];
        this.gameState.updateConnectionFilter(
            conn.id,
            { methods: currentMethods, weight: value },
            { recordHistory: false },
        );
    }

    protected onWeightStart(): void {
        const conn = this.selectedConnection();
        if (conn) this.gameState.beginConnectionFilterEdit(conn.id);
    }

    protected onWeightCommit(): void {
        const conn = this.selectedConnection();
        if (conn) this.gameState.commitConnectionFilterEdit(conn.id);
    }

    protected onClose(): void {
        this.gameState.selectedConnectionId.set(null);
    }

    protected onDelete(): void {
        const conn = this.selectedConnection();
        if (conn) this.gameState.removeConnection(conn.id);
    }
}
