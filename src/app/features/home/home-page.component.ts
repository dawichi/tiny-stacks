import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BookOpen, Hammer, Lock, LucideAngularModule, Trophy } from 'lucide-angular';
import { TutorialService } from '../../core/tutorial/tutorial.service';

@Component({
    selector: 'app-home-page',
    standalone: true,
    imports: [RouterLink, LucideAngularModule],
    template: `
    <div class="page">
      <div class="dot-grid"></div>

      <div class="relative z-10 flex flex-col items-center justify-center min-h-screen p-8">
        <header class="text-center mb-12">
          <h1 class="text-5xl font-bold text-slate-800 tracking-tight mb-3">tiny-stacks</h1>
          <p class="text-lg text-slate-500 leading-relaxed">
            Place services. Connect them. Watch the traffic flow.
          </p>
        </header>

      <div class="flex gap-8 flex-wrap justify-center">

        <!-- Tutorial card (always available) -->
        <a routerLink="/tutorial" class="mode-card group">
          <div class="icon-circle bg-emerald-100 text-emerald-600 group-hover:bg-emerald-200">
            <lucide-icon [img]="BookOpenIcon" [size]="32" />
          </div>
          <h2 class="text-xl font-semibold text-slate-800 mt-4">Tutorial</h2>
          <p class="text-sm text-slate-500 mt-2 text-center leading-relaxed">
            @if (tutorial.isTutorialComplete()) {
              Learn the mechanics again. 5 interactive steps.
            } @else {
              Start here. Learn the 4 core mechanics in 5 steps.
            }
          </p>
          @if (tutorial.isTutorialComplete()) {
            <span class="mt-3 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              Completed
            </span>
          } @else {
            <span class="mt-3 text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              Start here
            </span>
          }
        </a>

        <!-- Sandbox card -->
        @if (tutorial.isTutorialComplete()) {
          <a routerLink="/sandbox" class="mode-card group">
            <div class="icon-circle bg-sky-100 text-sky-600 group-hover:bg-sky-200">
              <lucide-icon [img]="HammerIcon" [size]="32" />
            </div>
            <h2 class="text-xl font-semibold text-slate-800 mt-4">Sandbox</h2>
            <p class="text-sm text-slate-500 mt-2 text-center leading-relaxed">
              Build freely. No limits, no goals — just pure architecture.
            </p>
          </a>
        } @else {
          <div class="mode-card mode-card--locked" title="Complete the tutorial first">
            <div class="icon-circle bg-slate-100 text-slate-400">
              <lucide-icon [img]="LockIcon" [size]="32" />
            </div>
            <h2 class="text-xl font-semibold text-slate-400 mt-4">Sandbox</h2>
            <p class="text-sm text-slate-400 mt-2 text-center leading-relaxed">
              Complete the tutorial to unlock.
            </p>
          </div>
        }

        <!-- Challenges card -->
        @if (tutorial.isTutorialComplete()) {
          <a routerLink="/challenges" class="mode-card group">
            <div class="icon-circle bg-amber-100 text-amber-600 group-hover:bg-amber-200">
              <lucide-icon [img]="TrophyIcon" [size]="32" />
            </div>
            <h2 class="text-xl font-semibold text-slate-800 mt-4">Challenges</h2>
            <p class="text-sm text-slate-500 mt-2 text-center leading-relaxed">
              Progressive puzzles. Solve real DevOps problems. Earn stars.
            </p>
          </a>
        } @else {
          <div class="mode-card mode-card--locked" title="Complete the tutorial first">
            <div class="icon-circle bg-slate-100 text-slate-400">
              <lucide-icon [img]="LockIcon" [size]="32" />
            </div>
            <h2 class="text-xl font-semibold text-slate-400 mt-4">Challenges</h2>
            <p class="text-sm text-slate-400 mt-2 text-center leading-relaxed">
              Complete the tutorial to unlock.
            </p>
          </div>
        }

        </div>
      </div>
    </div>
  `,
    styles: [
        `
    .page {
      position: relative;
      min-height: 100vh;
      overflow: hidden;
      background: linear-gradient(135deg, #f8fafc 0%, #e9eef5 50%, #dde5f0 100%);
    }

    .dot-grid {
      position: absolute;
      inset: 0;
      pointer-events: none;
      background-image: radial-gradient(circle, rgba(100, 116, 139, 0.22) 1.5px, transparent 1.5px);
      background-size: 24px 24px;
      animation: dot-drift 30s linear infinite;
    }

    @keyframes dot-drift {
      from { background-position: 0 0; }
      to   { background-position: 24px 24px; }
    }

    .mode-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 2rem 2.5rem;
      width: 240px;
      border-radius: 1rem;
      background: rgba(255, 255, 255, 0.65);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.85);
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.07);
      transition: transform 200ms ease, box-shadow 200ms ease;
      cursor: pointer;
      text-decoration: none;
    }
    .mode-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.11);
    }
    .mode-card--locked {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .mode-card--locked:hover {
      transform: none;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.07);
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
    protected readonly tutorial = inject(TutorialService);

    protected readonly BookOpenIcon = BookOpen;
    protected readonly HammerIcon = Hammer;
    protected readonly TrophyIcon = Trophy;
    protected readonly LockIcon = Lock;
}
