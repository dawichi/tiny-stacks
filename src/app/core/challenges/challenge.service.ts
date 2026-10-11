import { computed, Injectable, inject, signal } from '@angular/core';
import { GameStateService } from '../game/game-state.service';
import { seedFromString } from '../game/sim-random';
import type { SimOutage } from '../game/sim-types';
import { TickEngineService } from '../game/tick-engine.service';
import { StorageKeys, StorageService } from '../storage/storage.service';
import { sanitizeProgress } from '../storage/storage-schema';
import type { ChallengeDefinition, ChallengeProgress, ChallengeProgressEntry, DeployResult } from './challenge.model';
import { CHALLENGE_DEFINITIONS } from './challenge-definitions';
import { buildChallengeSetup, scoreDeploy, topologyTier } from './challenge-evaluation';

/** Build: the player edits the board under baseline traffic. Deploying: scripted run, board locked. */
export type ChallengePhase = 'build' | 'deploying' | 'results';

@Injectable({ providedIn: 'root' })
export class ChallengeService {
    // ── Injected Services ──────────────────────────────────────────────
    private readonly gameState = inject(GameStateService);
    private readonly tickEngine = inject(TickEngineService);
    private readonly storage = inject(StorageService);

    // ── Signals ────────────────────────────────────────────────────────
    readonly activeChallenge = signal<ChallengeDefinition | null>(null);
    readonly phase = signal<ChallengePhase>('build');
    readonly lastResult = signal<DeployResult | null>(null);
    readonly progress = signal<ChallengeProgress>(this.loadProgress());

    /** Highest star tier (0-3) whose topology the current board matches. Deploy decides the real stars. */
    readonly topologyStars = computed(() => {
        const challenge = this.activeChallenge();
        if (!challenge) return 0;
        return topologyTier(challenge, {
            services: this.gameState.services(),
            connections: this.gameState.connections(),
        });
    });
    /** @deprecated Use `topologyStars`; this alias remains for existing challenge fixtures. */
    readonly starStatus = computed<[boolean, boolean, boolean]>(() => {
        const stars = this.topologyStars();
        return [stars >= 1, stars >= 2, stars >= 3];
    });

    // ── Private State ──────────────────────────────────────────────────
    private outages: SimOutage[] = [];
    private unsubscribeTick: (() => void) | null = null;

    // ── Public Methods ─────────────────────────────────────────────────

    getDefinitions(): ChallengeDefinition[] {
        return CHALLENGE_DEFINITIONS;
    }

    getDefinition(id: string): ChallengeDefinition | undefined {
        return CHALLENGE_DEFINITIONS.find((c) => c.id === id);
    }

    /** First level always unlocked, the rest need at least one star on the previous level */
    isUnlocked(id: string): boolean {
        const index = CHALLENGE_DEFINITIONS.findIndex((c) => c.id === id);
        if (index <= 0) return true;
        const previous = CHALLENGE_DEFINITIONS[index - 1];
        if (!previous) return true;
        const prevId = previous.id;
        return (this.progress()[prevId]?.starsEarned ?? 0) >= 1;
    }

    /** Load a challenge: set up the board (no undo history, pre-placed services locked) and its traffic */
    loadChallenge(id: string): boolean {
        const def = this.getDefinition(id);
        if (!def) return false;

        this.tickEngine.stop();
        this.detachTick();

        const setup = buildChallengeSetup(def);
        this.gameState.loadBoard(setup.board, setup.serviceIds);
        this.tickEngine.trafficOverrides.set(setup.traffic);
        this.tickEngine.seed(seedFromString(def.id));
        this.outages = setup.outages;

        this.activeChallenge.set(def);
        this.phase.set('build');
        this.lastResult.set(null);
        this.unsubscribeTick = this.tickEngine.onTick(() => this.checkDeploy());
        return true;
    }

    unloadChallenge(): void {
        this.tickEngine.stop();
        this.detachTick();
        this.tickEngine.trafficOverrides.set(new Map());
        this.activeChallenge.set(null);
        this.phase.set('build');
        this.lastResult.set(null);
        this.outages = [];
        this.gameState.reset();
    }

    /** Lock the board and run the level's scripted traffic from an empty system */
    deploy(): void {
        const challenge = this.activeChallenge();
        if (!challenge || this.phase() !== 'build') return;
        this.gameState.selectService(null);
        this.gameState.selectedConnectionId.set(null);
        this.gameState.editable.set(false);
        this.tickEngine.seed(seedFromString(challenge.id));
        this.tickEngine.startRun(this.outages);
        this.lastResult.set(null);
        this.phase.set('deploying');
    }

    /** Leave the results and go back to editing under baseline traffic */
    keepBuilding(): void {
        if (this.phase() === 'build') return;
        this.tickEngine.endRun();
        this.gameState.editable.set(true);
        this.lastResult.set(null);
        this.phase.set('build');
    }

    // ── Private Methods ────────────────────────────────────────────────

    private checkDeploy(): void {
        if (this.phase() !== 'deploying') return;
        const run = this.tickEngine.run();
        const challenge = this.activeChallenge();
        if (!run?.finished || !run.summary || !challenge) return;

        const board = { services: this.gameState.services(), connections: this.gameState.connections() };
        const result = scoreDeploy(challenge, board, run.summary);
        this.lastResult.set(result);
        this.phase.set('results');
        this.tickEngine.pause();
        this.saveProgress(challenge.id, result);
    }

    /** Keep the best star count, and the best value of each metric across runs that earned a star */
    private saveProgress(id: string, result: DeployResult): void {
        const current = this.progress();
        const prev = current[id];
        const { summary, stars } = result;
        const better = (value: number, best: number | undefined) =>
            best === undefined ? value : Math.min(value, best);
        const entry: ChallengeProgressEntry = { starsEarned: Math.max(stars, prev?.starsEarned ?? 0) };
        for (const [key, value, previous] of [
            ['bestP95', summary.p95Latency, prev?.bestP95],
            ['bestErrorRate', summary.errorRate, prev?.bestErrorRate],
            ['bestCost', summary.cost, prev?.bestCost],
        ] as const) {
            const best = stars > 0 ? better(value, previous) : previous;
            if (best !== undefined) entry[key] = best;
        }
        const updated: ChallengeProgress = { ...current, [id]: entry };
        this.progress.set(updated);
        this.storage.setItem(StorageKeys.CHALLENGE_PROGRESS, updated);
    }

    private detachTick(): void {
        this.unsubscribeTick?.();
        this.unsubscribeTick = null;
    }

    private loadProgress(): ChallengeProgress {
        return sanitizeProgress(this.storage.getItem(StorageKeys.CHALLENGE_PROGRESS));
    }
}
