import { DecimalPipe } from '@angular/common';
import { Component, computed, DestroyRef, ElementRef, effect, inject, OnInit, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { ArrowLeft, LucideAngularModule, Play, RotateCcw, Star } from 'lucide-angular';
import type { RunMetric } from '../../core/challenges/challenge.model';
import { ChallengeService } from '../../core/challenges/challenge.service';
import { GameStateService } from '../../core/game/game-state.service';
import { SIM_SPEEDS, TickEngineService } from '../../core/game/tick-engine.service';
import { GameBoardComponent } from '../board/game-board.component';
import { ServiceInspectorComponent } from '../inspector/service-inspector.component';
import { ServicePaletteComponent } from '../palette/service-palette.component';
import { ScreenGuardComponent } from '../screen-guard/screen-guard.component';

@Component({
    selector: 'app-challenge-page',
    standalone: true,
    imports: [
        DecimalPipe,
        LucideAngularModule,
        GameBoardComponent,
        ServicePaletteComponent,
        ServiceInspectorComponent,
        ScreenGuardComponent,
    ],
    templateUrl: './challenge-page.component.html',
    styles: [
        `
    :host { display: block; }
    @keyframes panel-in {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .panel-in { animation: panel-in 200ms ease-out; }
  `,
    ],
})
export class ChallengePageComponent implements OnInit {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly destroyRef = inject(DestroyRef);
    private readonly challengeService = inject(ChallengeService);
    private readonly tickEngine = inject(TickEngineService);
    protected readonly gameState = inject(GameStateService);
    private readonly gameBoard = viewChild(GameBoardComponent);
    private readonly briefingPrimaryAction = viewChild<ElementRef<HTMLButtonElement>>('briefingPrimaryAction');
    private readonly resultsPrimaryAction = viewChild<ElementRef<HTMLButtonElement>>('resultsPrimaryAction');

    protected readonly ArrowLeftIcon = ArrowLeft;
    protected readonly PlayIcon = Play;
    protected readonly RetryIcon = RotateCcw;
    protected readonly StarIcon = Star;

    protected readonly challenge = this.challengeService.activeChallenge;
    protected readonly phase = this.challengeService.phase;
    protected readonly lastResult = this.challengeService.lastResult;
    protected readonly results = computed(() => (this.phase() === 'results' ? this.lastResult() : null));
    protected readonly run = this.tickEngine.run;
    protected readonly metrics = this.tickEngine.metrics;
    protected readonly speed = this.tickEngine.speed;
    protected readonly showBriefing = signal(true);

    protected readonly allowedResources = computed(() => this.challenge()?.availableResources ?? null);
    protected readonly topologyStars = this.challengeService.topologyStars;
    protected readonly starStatus = computed(() => {
        const challenge = this.challenge();
        if (!challenge) return [false, false, false] as const;
        const earned = this.challengeService.progress()[challenge.id]?.starsEarned ?? 0;
        return [earned >= 1, earned >= 2, earned >= 3] as const;
    });
    protected readonly bestStarsLabel = computed(
        () => `${this.starStatus().filter((earned) => earned).length} of 3 best stars earned`,
    );
    protected readonly starDetails = computed(() => {
        const challenge = this.challenge();
        const result = this.lastResult();
        if (!challenge) return [];
        return challenge.stars.map((tier, index) => ({
            label: tier.label,
            earned: result?.tiers[index]?.earned ?? this.starStatus()[index] ?? false,
        }));
    });
    protected readonly hasNextLevel = computed(() => {
        const current = this.challenge();
        const definitions = this.challengeService.getDefinitions();
        return current !== null && definitions.findIndex((d) => d.id === current.id) < definitions.length - 1;
    });
    protected readonly starsEarned = computed(() => this.lastResult()?.stars ?? 0);
    protected readonly runProgress = computed(() => {
        const current = this.run();
        if (!current || current.durationMs <= 0) return 0;
        return Math.min(100, (current.elapsedMs / current.durationMs) * 100);
    });

    constructor() {
        effect(() => {
            const showBriefing = this.showBriefing();
            const showResults = this.results() !== null;
            queueMicrotask(() => {
                if (showBriefing && this.showBriefing()) this.briefingPrimaryAction()?.nativeElement.focus();
                else if (showResults && this.results()) this.resultsPrimaryAction()?.nativeElement.focus();
            });
        });
    }

    ngOnInit(): void {
        this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
            const id = params.get('id');
            if (!id || !this.challengeService.loadChallenge(id)) {
                this.router.navigate(['/challenges']);
                return;
            }
            this.showBriefing.set(true);
            this.tickEngine.speed.set(1);
        });

        this.destroyRef.onDestroy(() => this.challengeService.unloadChallenge());
    }

    protected onStart(): void {
        this.showBriefing.set(false);
        this.tickEngine.start();
        queueMicrotask(() => this.gameBoard()?.focusBoard());
    }

    protected onDeploy(): void {
        this.challengeService.deploy();
        this.tickEngine.start();
    }

    protected onKeepBuilding(): void {
        this.challengeService.keepBuilding();
        this.tickEngine.start();
        queueMicrotask(() => this.gameBoard()?.focusBoard());
    }

    protected onRetry(): void {
        const current = this.challenge();
        if (current && this.challengeService.loadChallenge(current.id)) this.showBriefing.set(true);
    }

    protected onNextLevel(): void {
        const definitions = this.challengeService.getDefinitions();
        const current = this.challenge();
        if (!current) return;
        const index = definitions.findIndex((d) => d.id === current.id);
        if (index >= 0 && index < definitions.length - 1) {
            const next = definitions[index + 1];
            if (next) this.router.navigate(['/challenges', next.id]);
        }
    }

    protected onBack(): void {
        this.router.navigate(['/challenges']);
    }

    protected onDialogKeydown(event: KeyboardEvent): void {
        if (event.key === 'Escape') {
            event.preventDefault();
            if (this.showBriefing()) this.onBack();
            else this.onKeepBuilding();
            return;
        }
        if (event.key !== 'Tab') return;

        const dialog = event.currentTarget as HTMLElement;
        const focusable = [
            ...dialog.querySelectorAll<HTMLElement>(
                'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
            ),
        ];
        const first = focusable[0];
        const last = focusable.at(-1);
        if (!first || !last) {
            event.preventDefault();
            dialog.focus();
        } else if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    protected cycleSpeed(): void {
        const index = SIM_SPEEDS.indexOf(this.speed());
        const next = SIM_SPEEDS[(index + 1) % SIM_SPEEDS.length];
        if (next !== undefined) this.tickEngine.speed.set(next);
    }

    protected formatMetric(metric: RunMetric, value: number): string {
        switch (metric) {
            case 'errorRate':
                return `${value.toFixed(1)}%`;
            case 'avgLatency':
            case 'p95Latency':
                return `${Math.round(value)} ms`;
            case 'throughput':
                return `${value.toFixed(1)}/s`;
            case 'cost':
                return `$${value.toFixed(0)}`;
            case 'dbOperations':
                return `${Math.round(value)} ops`;
        }
    }

    protected metricLabel(metric: RunMetric): string {
        switch (metric) {
            case 'errorRate':
                return 'Error rate';
            case 'avgLatency':
                return 'Average latency';
            case 'p95Latency':
                return 'P95 latency';
            case 'throughput':
                return 'Throughput';
            case 'cost':
                return 'Deploy cost';
            case 'dbOperations':
                return 'Database operations';
        }
    }
}
