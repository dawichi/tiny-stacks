import { Injectable, inject, signal } from '@angular/core';
import { GameStateService } from '../game/game-state.service';
import type { ServiceType } from '../game/service-types.config';
import type { RequestMethod, TrafficPattern } from '../game/sim-types';
import { TickEngineService } from '../game/tick-engine.service';
import { StorageKeys, StorageService } from '../storage/storage.service';
import type { ChallengeDefinition, ChallengeProgress, ConditionOperator, WinCondition } from './challenge.model';
import { CHALLENGE_DEFINITIONS } from './challenge-definitions';

@Injectable({ providedIn: 'root' })
export class ChallengeService {
    // ── Injected Services ──────────────────────────────────────────────
    private readonly gameState = inject(GameStateService);
    private readonly tickEngine = inject(TickEngineService);
    private readonly storage = inject(StorageService);

    // ── Signals ────────────────────────────────────────────────────────
    readonly activeChallenge = signal<ChallengeDefinition | null>(null);
    readonly starStatus = signal<[boolean, boolean, boolean]>([false, false, false]);
    readonly elapsedMs = signal(0);
    readonly progress = signal<ChallengeProgress>(this.loadProgress());

    /** Set of runtime service IDs that are locked (pre-placed, can't be moved/deleted) */
    readonly lockedServiceIds = signal<Set<string>>(new Set());

    // ── Private State ──────────────────────────────────────────────────
    /** Maps condition key → milliseconds the condition has been continuously true */
    private sustainTrackers = new Map<string, number>();

    /** Maps challenge service index → runtime service ID */
    private serviceIdMap = new Map<number, string>();

    // ── Public Methods ─────────────────────────────────────────────────

    /** Get all challenge definitions */
    getDefinitions(): ChallengeDefinition[] {
        return CHALLENGE_DEFINITIONS;
    }

    /** Get a specific challenge by ID */
    getDefinition(id: string): ChallengeDefinition | undefined {
        return CHALLENGE_DEFINITIONS.find((c) => c.id === id);
    }

    /** Check if a challenge is unlocked (first level always unlocked, rest need previous star) */
    isUnlocked(id: string): boolean {
        const index = CHALLENGE_DEFINITIONS.findIndex((c) => c.id === id);
        if (index <= 0) return true;
        const prevId = CHALLENGE_DEFINITIONS[index - 1].id;
        const prev = this.progress()[prevId];
        return (prev?.starsEarned ?? 0) >= 1;
    }

    /** Load a challenge: set up the board, configure traffic, wire evaluation */
    loadChallenge(id: string): void {
        const def = this.getDefinition(id);
        if (!def) return;

        // Stop any running simulation
        if (this.tickEngine.running()) {
            this.tickEngine.stop();
        }

        // Clear board
        this.gameState.clearAll();

        // Reset state
        this.activeChallenge.set(def);
        this.starStatus.set([false, false, false]);
        this.elapsedMs.set(0);
        this.sustainTrackers.clear();
        this.serviceIdMap.clear();

        // Place pre-defined services
        const lockedIds = new Set<string>();
        for (let i = 0; i < def.services.length; i++) {
            const svc = def.services[i];
            const placed = this.gameState.addService(svc.type, svc.gridX, svc.gridY);
            if (placed) {
                this.serviceIdMap.set(i, placed.id);
                if (svc.locked) {
                    lockedIds.add(placed.id);
                }
            }
        }
        this.lockedServiceIds.set(lockedIds);

        // Place pre-defined connections
        for (const conn of def.connections) {
            const sourceId = this.serviceIdMap.get(conn.sourceIndex);
            const targetId = this.serviceIdMap.get(conn.targetIndex);
            if (sourceId && targetId) {
                const created = this.gameState.addConnection(
                    { serviceId: sourceId, portIndex: conn.sourcePortIndex },
                    { serviceId: targetId, portIndex: conn.targetPortIndex },
                );
                if (created && conn.filter) {
                    this.gameState.updateConnectionFilter(created.id, conn.filter);
                }
            }
        }

        // Configure traffic overrides
        const overrides = new Map<string, TrafficPattern>();
        for (const t of def.traffic) {
            const originId = this.serviceIdMap.get(t.originIndex);
            if (originId) {
                overrides.set(originId, t.pattern);
            }
        }
        this.tickEngine.trafficOverrides.set(overrides);

        // Wire tick callback for evaluation
        this.tickEngine.onTickCallback = (simDelta) => this.evaluateTick(simDelta);
    }

    /** Unload current challenge and clean up */
    unloadChallenge(): void {
        if (this.tickEngine.running()) {
            this.tickEngine.stop();
        }
        this.activeChallenge.set(null);
        this.starStatus.set([false, false, false]);
        this.lockedServiceIds.set(new Set());
        this.tickEngine.trafficOverrides.set(new Map());
        this.tickEngine.onTickCallback = null;
        this.sustainTrackers.clear();
        this.serviceIdMap.clear();
        this.gameState.clearAll();
    }

    /** Save current star status as progress if better than previous */
    saveProgress(): void {
        const challenge = this.activeChallenge();
        if (!challenge) return;

        const stars = this.starStatus();
        const earned = stars.filter(Boolean).length;
        const current = this.progress();
        const prev = current[challenge.id];

        if (!prev || earned > prev.starsEarned) {
            const metrics = this.tickEngine.metrics();
            const updated: ChallengeProgress = {
                ...current,
                [challenge.id]: {
                    starsEarned: earned,
                    bestLatency: metrics.avgLatency || prev?.bestLatency,
                    bestThroughput: metrics.throughput || prev?.bestThroughput,
                },
            };
            this.progress.set(updated);
            this.storage.setItem(StorageKeys.CHALLENGE_PROGRESS, updated);
        }
    }

    // ── Private Methods ────────────────────────────────────────────────

    private evaluateTick(simDelta: number): void {
        const challenge = this.activeChallenge();
        if (!challenge) return;

        this.elapsedMs.update((ms) => ms + simDelta);

        // Hierarchical: check from highest tier down, award the first matching tier.
        // Building the ★3 topology automatically awards all 3 stars.
        let highestPassed = -1;
        for (let tier = challenge.stars.length - 1; tier >= 0; tier--) {
            const allPassed = challenge.stars[tier].conditions.every((cond) =>
                this.evaluateCondition(cond, tier, simDelta),
            );
            if (allPassed) {
                highestPassed = tier;
                break;
            }
        }

        const newStars: [boolean, boolean, boolean] = [highestPassed >= 0, highestPassed >= 1, highestPassed >= 2];
        const current = this.starStatus();
        if (newStars.some((v, i) => v !== current[i])) {
            this.starStatus.set(newStars);
            this.saveProgress();
        }
    }

    private evaluateCondition(cond: WinCondition, tierIndex: number, simDelta: number): boolean {
        const currentValue = this.resolveMetric(cond);
        const passes = this.compare(currentValue, cond.operator, cond.value);

        const key = `${tierIndex}:${cond.metric}:${cond.operator}:${cond.value}`;
        const sustainMs = cond.sustainMs ?? 0;

        if (sustainMs <= 0) return passes;

        if (passes) {
            const current = this.sustainTrackers.get(key) ?? 0;
            this.sustainTrackers.set(key, current + simDelta);
            return current + simDelta >= sustainMs;
        }

        this.sustainTrackers.set(key, 0);
        return false;
    }

    private resolveMetric(cond: WinCondition): number {
        const m = this.tickEngine.metrics();
        switch (cond.metric) {
            case 'throughput':
                return m.throughput;
            case 'avgLatency':
                return m.avgLatency;
            case 'totalCompleted':
                return m.totalCompleted;
            case 'serviceCount':
                return this.gameState.services().length;
            case 'errorRate': {
                const total = m.totalCompleted + m.totalFailed;
                return total > 0 ? (m.totalFailed / total) * 100 : 0;
            }
            case 'pathExists':
                return this.resolvePathExists(cond.path ?? []);
            case 'pathNotExists':
                return this.resolvePathExists(cond.path ?? []) === 0 ? 1 : 0;
            case 'filteredPathExists':
                return this.resolveFilteredPathExists(cond.path ?? [], cond.requiredMethods ?? []) ? 1 : 0;
            default:
                return 0;
        }
    }

    private resolveFilteredPathExists(path: ServiceType[], requiredMethods: RequestMethod[]): boolean {
        if (path.length < 2) return false;
        const services = this.gameState.services();
        const connections = this.gameState.connections();
        const from = services.filter((s) => s.type === path[0]);
        const to = services.filter((s) => s.type === path[1]);

        return from.some((src) =>
            to.some((tgt) => {
                const conn = connections.find((c) => c.source.serviceId === src.id && c.target.serviceId === tgt.id);
                if (!conn) return false;
                const actual = [...(conn.filter?.methods ?? [])].sort();
                const required = [...requiredMethods].sort();
                return actual.length === required.length && actual.every((m, i) => m === required[i]);
            }),
        );
    }

    /**
     * Counts distinct paths matching the ordered service-type sequence.
     * Returns >= 1 if any path exists, >= 2 for two distinct paths, etc.
     * Conditions using pathExists with value: 2 require at least 2 distinct paths (e.g. both LB outputs used).
     */
    private resolvePathExists(path: ServiceType[]): number {
        if (path.length < 2) return 1;
        const services = this.gameState.services();
        const connections = this.gameState.connections();

        const countFrom = (serviceId: string, pathIndex: number): number => {
            if (pathIndex >= path.length) return 1;
            return connections
                .filter((c) => c.source.serviceId === serviceId)
                .reduce((sum, conn) => {
                    const target = services.find((s) => s.id === conn.target.serviceId);
                    return target?.type === path[pathIndex] ? sum + countFrom(target.id, pathIndex + 1) : sum;
                }, 0);
        };

        return services.filter((s) => s.type === path[0]).reduce((sum, s) => sum + countFrom(s.id, 1), 0);
    }

    private compare(value: number, operator: ConditionOperator, target: number): boolean {
        switch (operator) {
            case '>=':
                return value >= target;
            case '<=':
                return value <= target;
            case '>':
                return value > target;
            case '<':
                return value < target;
            case '==':
                return value === target;
            default:
                return false;
        }
    }

    private loadProgress(): ChallengeProgress {
        return this.storage.getItem(StorageKeys.CHALLENGE_PROGRESS) ?? {};
    }
}
