import { Component, inject } from '@angular/core';
import { GameStateService } from '../../core/game/game-state.service';

@Component({
    selector: 'app-board-toolbar',
    standalone: true,
    host: { class: 'absolute top-3 right-3 z-10 flex items-center gap-1.5' },
    templateUrl: './board-toolbar.component.html',
})
export class BoardToolbarComponent {
    protected readonly gameState = inject(GameStateService);
}
