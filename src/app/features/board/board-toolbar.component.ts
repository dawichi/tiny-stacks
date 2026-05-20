import { Component, inject, signal } from '@angular/core';
import { GameStateService } from '../../core/game/game-state.service';
import { TickEngineService } from '../../core/game/tick-engine.service';

@Component({
    selector: 'app-board-toolbar',
    standalone: true,
    host: { class: 'absolute top-3 right-3 z-10 flex items-center gap-1.5' },
    templateUrl: './board-toolbar.component.html',
})
export class BoardToolbarComponent {
    protected readonly gameState = inject(GameStateService);
    protected readonly simulation = inject(TickEngineService);

    protected readonly speedOptions = [0.5, 1, 2];
    protected readonly debugCopied = signal(false);

    protected formatNumber(value: number): string {
        return Math.round(value).toString();
    }

    protected onCopyDebug(): void {
        const snapshot = this.simulation.debugSnapshot();
        navigator.clipboard.writeText(snapshot);
        this.debugCopied.set(true);
        setTimeout(() => this.debugCopied.set(false), 1500);
    }

    protected onLoadExample(): void {
        if (this.simulation.running()) this.simulation.stop();
        this.gameState.loadExampleSetup();
    }

    protected onLoadStressTest(): void {
        if (this.simulation.running()) this.simulation.stop();
        this.gameState.loadStressTestSetup();
    }
}
