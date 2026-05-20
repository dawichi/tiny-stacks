import { Component, computed, inject } from '@angular/core';
import { Cloud, Database, Globe, LucideAngularModule, Mail, Server, Split, Trash2, X, Zap } from 'lucide-angular';
import { GameStateService } from '../../core/game/game-state.service';
import { getServiceConfig, ServiceType } from '../../core/game/service-types.config';
import { TickEngineService } from '../../core/game/tick-engine.service';

@Component({
    selector: 'app-service-panel',
    standalone: true,
    imports: [LucideAngularModule],
    templateUrl: './service-panel.component.html',
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
export class ServicePanelComponent {
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

    protected readonly isOrigin = computed(() => this.service()?.type === ServiceType.ORIGIN);

    protected readonly liveVisual = computed(() => {
        const s = this.service();
        if (!s) return null;
        return this.tickEngine.serviceVisuals().get(s.id) ?? null;
    });

    protected readonly showLiveStats = computed(() => this.tickEngine.running() && this.liveVisual() !== null);

    protected readonly cacheStats = computed(() => this.liveVisual()?.cacheStats ?? null);

    protected readonly showCacheStats = computed(() => this.tickEngine.running() && this.cacheStats() !== null);

    protected readonly cacheHitRate = computed(() => {
        const stats = this.cacheStats();
        if (!stats) return 0;
        const total = stats.hitCount + stats.missCount;
        return total > 0 ? Math.round((stats.hitCount / total) * 100) : 0;
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
                return {
                    id: c.id,
                    direction: isSource ? '→' : '←',
                    otherServiceName: otherService ? getServiceConfig(otherService.type).name : 'Unknown',
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
        if (s) this.gameState.removeService(s.id);
    }

    protected onDeleteConnection(connectionId: string): void {
        this.gameState.removeConnection(connectionId);
    }
}
