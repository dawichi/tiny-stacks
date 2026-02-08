import { Component, inject, OnInit } from '@angular/core';
import { GameStateService } from './core/game/game-state.service';
import { GameBoardComponent } from './features/board/game-board.component';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [GameBoardComponent],
    template: `
    <main class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 p-8">
      <header class="max-w-4xl mx-auto mb-6">
        <h1 class="text-3xl font-bold text-slate-800">tiny-stacks</h1>
        <p class="text-slate-600">The Factorio of DevOps</p>
      </header>

      <div class="flex justify-center">
        <app-game-board />
      </div>
    </main>
  `,
})
export class App implements OnInit {
    private readonly gameState = inject(GameStateService);

    ngOnInit(): void {
        // Add demo services on startup
        this.gameState.addDemoServices();
    }
}
