import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArrowLeft, Lock, LucideAngularModule, Star } from 'lucide-angular';

interface ChallengeLevel {
    id: number;
    name: string;
    description: string;
    unlocked: boolean;
}

@Component({
    selector: 'app-challenges-page',
    standalone: true,
    imports: [RouterLink, LucideAngularModule],
    template: `
    <div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 p-8">
      <header class="max-w-4xl mx-auto mb-8 flex items-center gap-4">
        <a routerLink="/" class="text-slate-400 hover:text-slate-600 transition-colors">
          <lucide-icon [img]="ArrowLeftIcon" [size]="20" />
        </a>
        <div>
          <h1 class="text-3xl font-bold text-slate-800">Challenges</h1>
          <p class="text-slate-600">Progressive puzzles to master DevOps architecture</p>
        </div>
      </header>

      <div class="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        @for (level of levels; track level.id) {
          <div
            class="challenge-card"
            [class.locked]="!level.unlocked"
            [class.unlocked]="level.unlocked"
          >
            <div class="flex items-center justify-between mb-3">
              <span class="text-sm font-medium text-slate-400">Level {{ level.id }}</span>
              @if (!level.unlocked) {
                <lucide-icon [img]="LockIcon" [size]="16" class="text-slate-300" />
              } @else {
                <div class="flex gap-0.5">
                  <lucide-icon [img]="StarIcon" [size]="14" class="text-slate-300" />
                  <lucide-icon [img]="StarIcon" [size]="14" class="text-slate-300" />
                  <lucide-icon [img]="StarIcon" [size]="14" class="text-slate-300" />
                </div>
              }
            </div>
            <h3 class="text-lg font-semibold" [class.text-slate-800]="level.unlocked" [class.text-slate-400]="!level.unlocked">
              {{ level.name }}
            </h3>
            <p class="text-sm mt-1" [class.text-slate-500]="level.unlocked" [class.text-slate-300]="!level.unlocked">
              {{ level.description }}
            </p>
          </div>
        }
      </div>
    </div>
  `,
    styles: [
        `
    .challenge-card {
      padding: 1.5rem;
      border-radius: 1rem;
      background: rgba(255, 255, 255, 0.6);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.8);
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
      transition: transform 200ms ease, box-shadow 200ms ease;
    }
    .challenge-card.unlocked {
      cursor: pointer;
    }
    .challenge-card.unlocked:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    }
    .challenge-card.locked {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `,
    ],
})
export class ChallengesPageComponent {
    protected readonly ArrowLeftIcon = ArrowLeft;
    protected readonly LockIcon = Lock;
    protected readonly StarIcon = Star;

    protected readonly levels: ChallengeLevel[] = [
        {
            id: 1,
            name: 'Hello, Backend',
            description: 'Connect a REST service to a Database and handle basic traffic.',
            unlocked: true,
        },
        {
            id: 2,
            name: 'Cache It',
            description: 'The DB is overloaded — add a cache to reduce read load.',
            unlocked: false,
        },
        {
            id: 3,
            name: 'Scale Out',
            description: "A single REST service can't keep up — scale horizontally with a Load Balancer.",
            unlocked: false,
        },
        {
            id: 4,
            name: 'Buffer the Storm',
            description: 'Traffic spikes are crashing the system — buffer with a Message Queue.',
            unlocked: false,
        },
        {
            id: 5,
            name: 'Route It Right',
            description: 'Multiple endpoints need routing to different backends via an API Gateway.',
            unlocked: false,
        },
        {
            id: 6,
            name: 'Full Stack',
            description: 'Design a complete architecture handling mixed traffic at scale.',
            unlocked: false,
        },
    ];
}
