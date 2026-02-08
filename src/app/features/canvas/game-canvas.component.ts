import {
  Component,
  ElementRef,
  OnInit,
  OnDestroy,
  ViewChild,
  AfterViewInit,
  HostListener,
  ChangeDetectionStrategy,
} from '@angular/core';
import { GameEngineService } from '../../core/engine/game-engine.service';

@Component({
  selector: 'app-game-canvas',
  standalone: true,
  template: `
    <div
      #canvasContainer
      class="w-full h-full absolute inset-0"
    ></div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      position: relative;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GameCanvasComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer', { static: true })
  canvasContainer!: ElementRef<HTMLElement>;

  constructor(private gameEngine: GameEngineService) {}

  ngAfterViewInit(): void {
    // Initialize the game engine with our canvas container
    this.gameEngine.initialize(this.canvasContainer.nativeElement);
  }

  ngOnDestroy(): void {
    this.gameEngine.dispose();
  }

  @HostListener('window:resize')
  onResize(): void {
    const container = this.canvasContainer.nativeElement;
    this.gameEngine.onResize(container.clientWidth, container.clientHeight);
  }
}
