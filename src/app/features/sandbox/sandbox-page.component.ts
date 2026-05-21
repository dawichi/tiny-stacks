import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArrowLeft, LucideAngularModule } from 'lucide-angular';
import { GameBoardComponent } from '../board/game-board.component';
import { ServiceInspectorComponent } from '../inspector/service-inspector.component';
import { ServicePaletteComponent } from '../palette/service-palette.component';
import { ScreenGuardComponent } from '../screen-guard/screen-guard.component';

@Component({
    selector: 'app-sandbox-page',
    standalone: true,
    imports: [
        RouterLink,
        LucideAngularModule,
        GameBoardComponent,
        ServicePaletteComponent,
        ServiceInspectorComponent,
        ScreenGuardComponent,
    ],
    template: `
    <main class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 p-8">
      <header class="max-w-4xl mx-auto mb-6 flex items-center gap-4">
        <a routerLink="/" class="text-slate-400 hover:text-slate-600 transition-colors">
          <lucide-icon [img]="ArrowLeftIcon" [size]="20" />
        </a>
        <div>
          <h1 class="text-3xl font-bold text-slate-800">tiny-stacks</h1>
          <p class="text-slate-600">Sandbox</p>
        </div>
      </header>

      <div class="flex justify-center">
        <app-game-board />
      </div>

      <app-service-palette />
      <app-service-inspector />
      <app-screen-guard />
    </main>
  `,
})
export class SandboxPageComponent {
    protected readonly ArrowLeftIcon = ArrowLeft;
}
