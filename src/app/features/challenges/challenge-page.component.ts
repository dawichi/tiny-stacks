import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ArrowLeft, LucideAngularModule, Play, RotateCcw, Star, X } from 'lucide-angular';
import { ChallengeService } from '../../core/challenges/challenge.service';
import { TickEngineService } from '../../core/game/tick-engine.service';
import { GameBoardComponent } from '../board/game-board.component';
import { ServiceInspectorComponent } from '../inspector/service-inspector.component';
import { ServicePaletteComponent } from '../palette/service-palette.component';
import { ScreenGuardComponent } from '../screen-guard/screen-guard.component';

interface StarToast {
    id: number;
    starIndex: number;
}

@Component({
    selector: 'app-challenge-page',
    standalone: true,
    imports: [
        RouterLink,
        LucideAngularModule,
        GameBoardComponent,
        ServicePaletteComponent,
        ServiceInspectorComponent,
        ScreenGuardComponent,
    ],
    templateUrl: './challenge-page.component.html',
    styles: [
        `
    :host {
      display: block;
    }
    @keyframes toast-in {
      from { opacity: 0; transform: translateX(12px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    .toast-in {
      animation: toast-in 200ms ease-out;
    }
  `,
    ],
})
export class ChallengePageComponent implements OnInit, OnDestroy {
    // ── Injected Services ──────────────────────────────────────────────
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly challengeService = inject(ChallengeService);
    private readonly tickEngine = inject(TickEngineService);

    // ── Icon references ────────────────────────────────────────────────
    protected readonly ArrowLeftIcon = ArrowLeft;
    protected readonly StarIcon = Star;
    protected readonly PlayIcon = Play;
    protected readonly RetryIcon = RotateCcw;
    protected readonly XIcon = X;

    // ── State ──────────────────────────────────────────────────────────
    protected readonly showBriefing = signal(true);
    protected readonly showVictory = signal(false);
    protected readonly starToasts = signal<StarToast[]>([]);

    protected readonly challenge = this.challengeService.activeChallenge;
    protected readonly starStatus = this.challengeService.starStatus;

    protected readonly allowedResources = computed(() => {
        return this.challenge()?.availableResources ?? null;
    });

    protected readonly starsEarned = computed(() => {
        return this.starStatus().filter(Boolean).length;
    });

    protected readonly formattedTime = computed(() => {
        const ms = this.challengeService.elapsedMs();
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    });

    protected readonly starDetails = computed(() => {
        const ch = this.challenge();
        const status = this.starStatus();
        if (!ch) return [];
        return ch.stars.map((star, i) => ({
            earned: status[i],
            label: star.label,
        }));
    });

    protected readonly hasNextLevel = computed(() => {
        const defs = this.challengeService.getDefinitions();
        const current = this.challenge();
        if (!current) return false;
        const idx = defs.findIndex((d) => d.id === current.id);
        return idx < defs.length - 1;
    });

    // ── Private state ──────────────────────────────────────────────────
    private previousStarStatus: [boolean, boolean, boolean] = [false, false, false];
    private toastCounter = 0;
    private victoryCheckInterval: ReturnType<typeof setInterval> | null = null;
    private toastTimers: ReturnType<typeof setTimeout>[] = [];

    // ── Lifecycle ──────────────────────────────────────────────────────
    ngOnInit(): void {
        const id = this.route.snapshot.paramMap.get('id');
        if (id) {
            this.challengeService.loadChallenge(id);
            if (!this.challenge()) {
                this.router.navigate(['/challenges']);
            }
        }

        this.victoryCheckInterval = setInterval(() => {
            if (this.showBriefing() || this.showVictory()) return;

            const current = this.starStatus();

            for (let i = 0; i < 3; i++) {
                if (current[i] && !this.previousStarStatus[i]) {
                    this.addToast(i);
                }
            }
            this.previousStarStatus = [...current] as [boolean, boolean, boolean];

            if (current.every(Boolean)) {
                this.showResults();
            }
        }, 200);
    }

    ngOnDestroy(): void {
        if (this.victoryCheckInterval) clearInterval(this.victoryCheckInterval);
        for (const t of this.toastTimers) clearTimeout(t);
        this.challengeService.unloadChallenge();
    }

    // ── Methods ────────────────────────────────────────────────────────
    protected onStart(): void {
        this.showBriefing.set(false);
        this.tickEngine.start();
    }

    protected onBack(): void {
        this.challengeService.unloadChallenge();
    }

    protected onContinue(): void {
        this.showVictory.set(false);
        this.tickEngine.start();
    }

    protected onRetry(): void {
        this.showVictory.set(false);
        this.starToasts.set([]);
        this.previousStarStatus = [false, false, false];
        const current = this.challenge();
        if (current) {
            this.challengeService.loadChallenge(current.id);
            this.showBriefing.set(true);
        }
    }

    protected onNextLevel(): void {
        this.showVictory.set(false);
        const defs = this.challengeService.getDefinitions();
        const current = this.challenge();
        if (!current) return;
        const idx = defs.findIndex((d) => d.id === current.id);
        if (idx < defs.length - 1) {
            const next = defs[idx + 1];
            this.router.navigate(['/challenges', next.id]);
            this.challengeService.loadChallenge(next.id);
            this.showBriefing.set(true);
        }
    }

    protected onViewResults(): void {
        this.showResults();
    }

    protected dismissToast(id: number): void {
        this.starToasts.update((toasts) => toasts.filter((t) => t.id !== id));
    }

    protected ordinal(starIndex: number): string {
        return (['1st', '2nd', '3rd'] as const)[starIndex] ?? `${starIndex + 1}th`;
    }

    // ── Private ────────────────────────────────────────────────────────
    private showResults(): void {
        this.starToasts.set([]);
        this.showVictory.set(true);
        this.tickEngine.stop();
        this.challengeService.saveProgress();
    }

    private addToast(starIndex: number): void {
        const id = this.toastCounter++;
        this.starToasts.update((toasts) => [...toasts, { id, starIndex }]);
        const timer = setTimeout(() => this.dismissToast(id), 4000);
        this.toastTimers.push(timer);
    }
}
