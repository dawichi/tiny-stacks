import { Component } from '@angular/core';
import { GameBoardComponent } from './features/board/game-board.component';
import { ServiceInspectorComponent } from './features/inspector/service-inspector.component';
import { ServicePaletteComponent } from './features/palette/service-palette.component';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [GameBoardComponent, ServicePaletteComponent, ServiceInspectorComponent],
    template: `
    <main class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 p-8">
      <header class="max-w-4xl mx-auto mb-6">
        <h1 class="text-3xl font-bold text-slate-800">tiny-stacks</h1>
        <p class="text-slate-600">The Factorio of DevOps</p>
      </header>

      <div class="flex justify-center">
        <app-game-board />
      </div>

      <app-service-palette />
      <app-service-inspector />
    </main>
  `,
})
export class App {}
