import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Hammer, LucideAngularModule, Trophy } from 'lucide-angular';

@Component({
    selector: 'app-home-page',
    standalone: true,
    imports: [RouterLink, LucideAngularModule],
    template: `
    <div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 flex flex-col items-center justify-center p-8">
      <header class="text-center mb-12">
        <h1 class="text-5xl font-bold text-slate-800 tracking-tight">tiny-stacks</h1>
        <p class="text-lg text-slate-500 mt-2">The Factorio of DevOps</p>
      </header>

      <div class="flex gap-8 flex-wrap justify-center">
        <!-- Sandbox card -->
        <a
          routerLink="/sandbox"
          class="mode-card group"
        >
          <div class="icon-circle bg-sky-100 text-sky-600 group-hover:bg-sky-200">
            <lucide-icon [img]="HammerIcon" [size]="32" />
          </div>
          <h2 class="text-xl font-semibold text-slate-800 mt-4">Sandbox</h2>
          <p class="text-sm text-slate-500 mt-2 text-center leading-relaxed">
            Build freely. No limits, no goals — just pure architecture.
          </p>
        </a>

        <!-- Challenges card -->
        <a
          routerLink="/challenges"
          class="mode-card group"
        >
          <div class="icon-circle bg-amber-100 text-amber-600 group-hover:bg-amber-200">
            <lucide-icon [img]="TrophyIcon" [size]="32" />
          </div>
          <h2 class="text-xl font-semibold text-slate-800 mt-4">Challenges</h2>
          <p class="text-sm text-slate-500 mt-2 text-center leading-relaxed">
            Progressive puzzles. Solve real DevOps problems. Earn stars.
          </p>
        </a>
      </div>
    </div>
  `,
    styles: [
        `
    .mode-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 2rem 2.5rem;
      width: 280px;
      border-radius: 1rem;
      background: rgba(255, 255, 255, 0.6);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.8);
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
      transition: transform 200ms ease, box-shadow 200ms ease;
      cursor: pointer;
      text-decoration: none;
    }
    .mode-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    }
    .icon-circle {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color 200ms ease;
    }
  `,
    ],
})
export class HomePageComponent {
    protected readonly HammerIcon = Hammer;
    protected readonly TrophyIcon = Trophy;
}
