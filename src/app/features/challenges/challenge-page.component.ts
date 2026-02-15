import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ArrowLeft, LucideAngularModule, Play, RotateCcw, Star } from 'lucide-angular';
import { ChallengeService } from '../../core/challenges/challenge.service';
import { TickEngineService } from '../../core/game/tick-engine.service';
import { GameBoardComponent } from '../board/game-board.component';
import { ServiceInspectorComponent } from '../inspector/service-inspector.component';
import { ServicePaletteComponent } from '../palette/service-palette.component';

@Component({
    selector: 'app-challenge-page',
    standalone: true,
    imports: [RouterLink, LucideAngularModule, GameBoardComponent, ServicePaletteComponent, ServiceInspectorComponent],
    template: `
    <main class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 p-8 relative">
      <!-- HUD -->
      <header class="max-w-4xl mx-auto mb-6 flex items-center gap-4">
        <a routerLink="/challenges" class="text-slate-400 hover:text-slate-600 transition-colors" (click)="onBack()">
          <lucide-icon [img]="ArrowLeftIcon" [size]="20" />
        </a>
        <div class="flex-1">
          <h1 class="text-xl font-bold text-slate-800">{{ challenge()?.name }}</h1>
          <p class="text-xs text-slate-500">{{ challenge()?.description }}</p>
        </div>

        <!-- Stars -->
        <div class="flex gap-1.5">
          @for (star of starStatus(); track $index) {
            <lucide-icon
              [img]="StarIcon"
              [size]="22"
              [class]="star ? 'star-filled text-amber-400' : 'text-slate-300'"
            />
          }
        </div>

        <!-- Timer -->
        <div class="text-sm font-mono text-slate-600 min-w-16 text-right">
          {{ formattedTime() }}
        </div>
      </header>

      <!-- Board -->
      <div class="flex justify-center">
        <app-game-board />
      </div>

      <app-service-palette [allowedTypes]="allowedTypes()" />
      <app-service-inspector />

      <!-- Briefing overlay -->
      @if (showBriefing()) {
        <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div class="bg-white/90 backdrop-blur-md border border-white/60 rounded-2xl shadow-2xl p-8 max-w-md mx-4">
            <h2 class="text-2xl font-bold text-slate-800 mb-2">{{ challenge()?.name }}</h2>
            <p class="text-sm text-slate-600 leading-relaxed mb-6">{{ challenge()?.briefing }}</p>

            <!-- Goals -->
            <div class="mb-6">
              <h3 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Goals</h3>
              <div class="flex flex-col gap-2">
                @for (star of challenge()?.stars ?? []; track $index) {
                  <div class="flex items-start gap-2 text-sm text-slate-600">
                    <lucide-icon [img]="StarIcon" [size]="14" class="text-slate-300 shrink-0 mt-0.5" />
                    <div class="flex flex-col gap-0.5">
                      @for (cond of star.conditions; track $index) {
                        <span>{{ cond.label }}</span>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>

            <button
              class="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold
                     bg-blue-500 text-white hover:bg-blue-600 transition-colors shadow-lg"
              (click)="onStart()"
            >
              <lucide-icon [img]="PlayIcon" [size]="16" />
              Start Challenge
            </button>
          </div>
        </div>
      }

      <!-- Victory overlay -->
      @if (showVictory()) {
        <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div class="bg-white/90 backdrop-blur-md border border-white/60 rounded-2xl shadow-2xl p-8 max-w-md mx-4">
            <h2 class="text-2xl font-bold text-slate-800 mb-4 text-center">Challenge Complete!</h2>

            <!-- Star details -->
            <div class="flex flex-col gap-3 mb-6">
              @for (star of starDetails(); track $index) {
                <div class="flex items-start gap-3 p-3 rounded-lg" [class]="star.earned ? 'bg-amber-50/80' : 'bg-slate-50/80'">
                  <lucide-icon
                    [img]="StarIcon"
                    [size]="20"
                    [class]="star.earned ? 'star-filled text-amber-400 shrink-0 mt-0.5' : 'text-slate-300 shrink-0 mt-0.5'"
                  />
                  <div class="flex flex-col gap-0.5">
                    @for (cond of star.conditions; track $index) {
                      <span class="text-sm" [class]="star.earned ? 'text-slate-700' : 'text-slate-400'">
                        {{ cond }}
                      </span>
                    }
                  </div>
                </div>
              }
            </div>

            <div class="flex gap-3">
              <button
                class="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium
                       bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                (click)="onRetry()"
              >
                <lucide-icon [img]="RetryIcon" [size]="14" />
                Retry
              </button>
              @if (hasNextLevel()) {
                <button
                  class="flex-1 py-2.5 rounded-xl text-sm font-semibold
                         bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                  (click)="onNextLevel()"
                >
                  Next Level
                </button>
              } @else {
                <a
                  routerLink="/challenges"
                  class="flex-1 py-2.5 rounded-xl text-sm font-semibold text-center
                         bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                  (click)="onBack()"
                >
                  Back to Levels
                </a>
              }
            </div>
          </div>
        </div>
      }
    </main>
  `,
    styles: [
        `
    :host {
      display: block;
    }
    .star-filled ::ng-deep svg {
      fill: currentColor;
      filter: drop-shadow(0 0 4px rgba(251, 191, 36, 0.5));
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

    // ── State ──────────────────────────────────────────────────────────
    protected readonly showBriefing = signal(true);
    protected readonly showVictory = signal(false);

    protected readonly challenge = this.challengeService.activeChallenge;
    protected readonly starStatus = this.challengeService.starStatus;

    protected readonly allowedTypes = computed(() => {
        return this.challenge()?.availableServiceTypes ?? null;
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
            conditions: star.conditions.map((c) => c.label),
        }));
    });

    protected readonly hasNextLevel = computed(() => {
        const defs = this.challengeService.getDefinitions();
        const current = this.challenge();
        if (!current) return false;
        const idx = defs.findIndex((d) => d.id === current.id);
        return idx < defs.length - 1;
    });

    // ── Victory detection ──────────────────────────────────────────────
    private victoryCheckInterval: ReturnType<typeof setInterval> | null = null;

    // ── Lifecycle ──────────────────────────────────────────────────────
    ngOnInit(): void {
        const id = this.route.snapshot.paramMap.get('id');
        if (id) {
            this.challengeService.loadChallenge(id);
            if (!this.challenge()) {
                this.router.navigate(['/challenges']);
            }
        }

        // Poll star status for victory (star 1 earned = victory)
        this.victoryCheckInterval = setInterval(() => {
            if (this.starStatus()[0] && !this.showVictory() && !this.showBriefing()) {
                this.showVictory.set(true);
                this.tickEngine.stop();
                this.challengeService.saveProgress();
            }
        }, 200);
    }

    ngOnDestroy(): void {
        if (this.victoryCheckInterval) {
            clearInterval(this.victoryCheckInterval);
        }
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

    protected onRetry(): void {
        this.showVictory.set(false);
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
}
