import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BookOpen, Hammer, LucideAngularModule, Trophy } from 'lucide-angular';
import { TutorialService } from '../../core/tutorial/tutorial.service';

@Component({
    selector: 'app-home-page',
    standalone: true,
    imports: [RouterLink, LucideAngularModule],
    template: `
    <div class="page">
      <div class="dot-grid"></div>

      <svg class="background-network" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <!-- port-to-port wire paths used by animateMotion -->
          <path id="p-ab" d="M 70 100 C 180 90 230 50 310 50"/>
          <path id="p-bc" d="M 350 50 C 530 20 710 20 890 50"/>
          <path id="p-cd" d="M 930 50 C 1010 50 1130 130 1150 200"/>
          <path id="p-de" d="M 1150 220 C 1160 370 1140 460 1110 565"/>
          <path id="p-ef" d="M 1080 595 C 950 640 800 740 620 760"/>
          <path id="p-fg" d="M 580 760 C 420 770 250 710 120 590"/>
          <path id="p-ga" d="M 100 570 C 90 430 70 280 60 110"/>
        </defs>

        <!-- Wires -->
        <path d="M 70 100 C 180 90 230 50 310 50" fill="none" stroke="#94a3b8" stroke-width="1.5"/>
        <path d="M 350 50 C 530 20 710 20 890 50" fill="none" stroke="#94a3b8" stroke-width="1.5"/>
        <path d="M 930 50 C 1010 50 1130 130 1150 200" fill="none" stroke="#94a3b8" stroke-width="1.5"/>
        <path d="M 1150 220 C 1160 370 1140 460 1110 565" fill="none" stroke="#94a3b8" stroke-width="1.5"/>
        <path d="M 1080 595 C 950 640 800 740 620 760" fill="none" stroke="#94a3b8" stroke-width="1.5"/>
        <path d="M 580 760 C 420 770 250 710 120 590" fill="none" stroke="#94a3b8" stroke-width="1.5"/>
        <path d="M 100 570 C 90 430 70 280 60 110" fill="none" stroke="#94a3b8" stroke-width="1.5"/>

        <!-- A: Origin 1×1 (20×20, coral),outputs right, receives bottom -->
        <rect x="50" y="90" width="20" height="20" rx="4" fill="#FF8B8B" stroke="#94a3b8" stroke-width="1"/>
        <circle cx="60" cy="100" r="4" fill="#FF6B6B" fill-opacity="0.35"/>
        <circle cx="70" cy="100" r="3" fill="#3b82f6"/>
        <circle cx="60" cy="110" r="3" fill="#22c55e"/>

        <!-- B: REST 2×2 (40×40, sky),receives left, outputs right -->
        <rect x="310" y="30" width="40" height="40" rx="6" fill="#87CEEB" stroke="#94a3b8" stroke-width="1"/>
        <circle cx="330" cy="50" r="9" fill="#5bb8e8" fill-opacity="0.3"/>
        <circle cx="310" cy="50" r="3" fill="#22c55e"/>
        <circle cx="350" cy="50" r="3" fill="#3b82f6"/>

        <!-- C: LB 2×2 (40×40, gold),receives left, outputs right -->
        <rect x="890" y="30" width="40" height="40" rx="6" fill="#FFE5A0" stroke="#94a3b8" stroke-width="1"/>
        <circle cx="910" cy="50" r="9" fill="#f5c842" fill-opacity="0.3"/>
        <circle cx="890" cy="50" r="3" fill="#22c55e"/>
        <circle cx="930" cy="50" r="3" fill="#3b82f6"/>

        <!-- D: Cache 2×1 (40×20, mint),receives top, outputs bottom -->
        <rect x="1130" y="200" width="40" height="20" rx="4" fill="#A8E6CF" stroke="#94a3b8" stroke-width="1"/>
        <circle cx="1150" cy="210" r="5" fill="#6fcfad" fill-opacity="0.3"/>
        <circle cx="1150" cy="200" r="3" fill="#22c55e"/>
        <circle cx="1150" cy="220" r="3" fill="#3b82f6"/>

        <!-- E: DB 3×3 (60×60, lavender),receives top, outputs left -->
        <rect x="1080" y="565" width="60" height="60" rx="6" fill="#D4A5FF" stroke="#94a3b8" stroke-width="1"/>
        <circle cx="1110" cy="595" r="13" fill="#b06aee" fill-opacity="0.25"/>
        <circle cx="1110" cy="565" r="3" fill="#22c55e"/>
        <circle cx="1080" cy="595" r="3" fill="#3b82f6"/>

        <!-- F: MQ 2×3 (40×60, peach),receives right, outputs left -->
        <rect x="580" y="730" width="40" height="60" rx="6" fill="#FFCBA4" stroke="#94a3b8" stroke-width="1"/>
        <circle cx="600" cy="760" r="9" fill="#f5a261" fill-opacity="0.3"/>
        <circle cx="620" cy="760" r="3" fill="#22c55e"/>
        <circle cx="580" cy="760" r="3" fill="#3b82f6"/>

        <!-- G: REST 2×2 (40×40, sky),receives right, outputs top -->
        <rect x="80" y="570" width="40" height="40" rx="6" fill="#87CEEB" stroke="#94a3b8" stroke-width="1"/>
        <circle cx="100" cy="590" r="9" fill="#5bb8e8" fill-opacity="0.3"/>
        <circle cx="120" cy="590" r="3" fill="#22c55e"/>
        <circle cx="100" cy="570" r="3" fill="#3b82f6"/>

        <!-- Packets -->
        <circle r="4.5" fill="#87CEEB"><animateMotion dur="5s" repeatCount="indefinite" begin="0s"><mpath href="#p-ab"/></animateMotion></circle>
        <circle r="4.5" fill="#87CEEB"><animateMotion dur="5s" repeatCount="indefinite" begin="2.5s"><mpath href="#p-ab"/></animateMotion></circle>
        <circle r="4.5" fill="#87CEEB"><animateMotion dur="8s" repeatCount="indefinite" begin="1s"><mpath href="#p-bc"/></animateMotion></circle>
        <circle r="4.5" fill="#87CEEB"><animateMotion dur="8s" repeatCount="indefinite" begin="5s"><mpath href="#p-bc"/></animateMotion></circle>
        <circle r="4.5" fill="#FFE5A0"><animateMotion dur="5s" repeatCount="indefinite" begin="0.5s"><mpath href="#p-cd"/></animateMotion></circle>
        <circle r="4.5" fill="#FFE5A0"><animateMotion dur="5s" repeatCount="indefinite" begin="3s"><mpath href="#p-cd"/></animateMotion></circle>
        <circle r="4.5" fill="#A8E6CF"><animateMotion dur="6s" repeatCount="indefinite" begin="0s"><mpath href="#p-de"/></animateMotion></circle>
        <circle r="4.5" fill="#A8E6CF"><animateMotion dur="6s" repeatCount="indefinite" begin="3s"><mpath href="#p-de"/></animateMotion></circle>
        <circle r="4.5" fill="#FFCBA4"><animateMotion dur="7s" repeatCount="indefinite" begin="0s"><mpath href="#p-ef"/></animateMotion></circle>
        <circle r="4.5" fill="#FFCBA4"><animateMotion dur="7s" repeatCount="indefinite" begin="3.5s"><mpath href="#p-ef"/></animateMotion></circle>
        <circle r="4.5" fill="#A8E6CF"><animateMotion dur="6s" repeatCount="indefinite" begin="2s"><mpath href="#p-fg"/></animateMotion></circle>
        <circle r="4.5" fill="#FF8B8B"><animateMotion dur="7s" repeatCount="indefinite" begin="0s"><mpath href="#p-ga"/></animateMotion></circle>
        <circle r="4.5" fill="#FF8B8B"><animateMotion dur="7s" repeatCount="indefinite" begin="3.5s"><mpath href="#p-ga"/></animateMotion></circle>
      </svg>

      <div class="relative z-10 flex flex-col items-center justify-center min-h-screen px-8 pt-8 pb-32">
        <header class="text-center mb-12">
          <div class="flex justify-center mb-4">
            <img src="logo.svg" width="56" height="56" alt="tiny-stacks logo">
          </div>
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
          <h2 class="text-xl font-semibold text-slate-800 mt-4">Learn the basics</h2>
          <p class="text-sm text-slate-500 mt-2 text-center leading-relaxed">
            A short, interactive introduction to building and routing a service stack.
          </p>
          @if (tutorial.isTutorialComplete()) {
            <span class="mt-3 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              Completed
            </span>
          } @else {
            <span class="mt-3 text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              Recommended
            </span>
          }
        </a>

        <!-- Sandbox card -->
        <a routerLink="/sandbox" class="mode-card group">
          <div class="icon-circle bg-sky-100 text-sky-600 group-hover:bg-sky-200">
            <lucide-icon [img]="HammerIcon" [size]="32" />
          </div>
          <h2 class="text-xl font-semibold text-slate-800 mt-4">Sandbox</h2>
          <p class="text-sm text-slate-500 mt-2 text-center leading-relaxed">
            Build freely. No limits, no goals. Just pure architecture.
          </p>
        </a>

        <!-- Challenges card -->
        <a routerLink="/challenges" class="mode-card group">
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
    }

    .background-network {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      opacity: 0.2;
      pointer-events: none;
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
}
