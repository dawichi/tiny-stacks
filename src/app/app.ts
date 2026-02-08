import { Component } from '@angular/core';
import { GameCanvasComponent } from './features/canvas/game-canvas.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [GameCanvasComponent],
  template: `
    <main class="w-screen h-screen overflow-hidden">
      <app-game-canvas />
    </main>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
  `],
})
export class App {}
