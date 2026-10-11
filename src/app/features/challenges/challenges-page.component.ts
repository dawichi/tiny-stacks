import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArrowLeft, Lock, LucideAngularModule, Star } from 'lucide-angular';
import { ChallengeService } from '../../core/challenges/challenge.service';

@Component({
    selector: 'app-challenges-page',
    standalone: true,
    imports: [RouterLink, LucideAngularModule],
    template: `
    <main class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 p-8">
      <header class="max-w-4xl mx-auto mb-8 flex items-center gap-4">
        <a routerLink="/" class="text-slate-600 hover:text-slate-700 transition-colors" aria-label="Back to home">
          <lucide-icon [img]="ArrowLeftIcon" [size]="20" />
        </a>
        <div>
          <h1 class="text-3xl font-bold text-slate-800">Challenges</h1>
          <p class="text-slate-600">Progressive puzzles to master DevOps architecture</p>
        </div>
      </header>

      <div class="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        @for (level of levels(); track level.id) {
          @if (level.unlocked) {
            <a
              [routerLink]="['/challenges', level.id]"
              class="challenge-card unlocked"
            >
              <div class="flex items-center justify-between mb-3">
                <span class="text-sm font-medium text-slate-700">{{ level.name }}</span>
                <div class="flex gap-0.5">
                  @for (i of [0, 1, 2]; track i) {
                    <lucide-icon
                      [img]="StarIcon"
                      [size]="14"
                      [class]="i < level.starsEarned ? 'star-filled text-amber-400' : 'text-slate-300'"
                      aria-hidden="true"
                    />
                  }
                  <span class="sr-only">{{ level.starsEarned }} of 3 stars earned</span>
                </div>
              </div>
              <p class="text-sm text-slate-600">{{ level.description }}</p>
            </a>
          } @else {
            <div class="challenge-card locked">
              <div class="flex items-center justify-between mb-3">
                <span class="text-sm font-medium text-slate-700">{{ level.name }}</span>
                <lucide-icon [img]="LockIcon" [size]="16" class="text-slate-500" aria-hidden="true" />
              </div>
              <p class="text-sm text-slate-600">{{ level.description }}</p>
            </div>
          }
        }
      </div>
    </main>
  `,
    styles: [
        `
    .challenge-card {
      display: block;
      padding: 1.5rem;
      border-radius: 1rem;
      background: rgba(255, 255, 255, 0.6);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.8);
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
      transition: transform 200ms ease, box-shadow 200ms ease;
      text-decoration: none;
    }
    .challenge-card.unlocked {
      cursor: pointer;
    }
    .challenge-card.unlocked:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    }
    .challenge-card.locked {
      cursor: not-allowed;
    }
  `,
    ],
})
export class ChallengesPageComponent {
    // ── Injected Services ──────────────────────────────────────────────
    private readonly challengeService = inject(ChallengeService);

    // ── Icon references ────────────────────────────────────────────────
    protected readonly ArrowLeftIcon = ArrowLeft;
    protected readonly LockIcon = Lock;
    protected readonly StarIcon = Star;

    // ── Computed ────────────────────────────────────────────────────────
    protected readonly levels = computed(() => {
        const defs = this.challengeService.getDefinitions();
        const progress = this.challengeService.progress();

        return defs.map((def) => ({
            id: def.id,
            name: def.name,
            description: def.description,
            unlocked: this.challengeService.isUnlocked(def.id),
            starsEarned: progress[def.id]?.starsEarned ?? 0,
        }));
    });
}
