import { Component, computed, effect, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ArrowLeft, CheckCircle, LucideAngularModule, Trophy } from 'lucide-angular';
import { TickEngineService } from '../../core/game/tick-engine.service';
import { TutorialService } from '../../core/tutorial/tutorial.service';
import { GameBoardComponent } from '../board/game-board.component';
import { ServiceInspectorComponent } from '../inspector/service-inspector.component';
import { ServicePaletteComponent } from '../palette/service-palette.component';
import { ScreenGuardComponent } from '../screen-guard/screen-guard.component';

@Component({
    selector: 'app-tutorial-page',
    standalone: true,
    imports: [
        RouterLink,
        LucideAngularModule,
        GameBoardComponent,
        ServicePaletteComponent,
        ServiceInspectorComponent,
        ScreenGuardComponent,
    ],
    templateUrl: './tutorial-page.component.html',
    styles: [
        `
    :host { display: block; }

    @keyframes step-in {
      from { opacity: 0; transform: translateY(-6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .step-in { animation: step-in 300ms ease-out; }

    @keyframes celebration-in {
      from { opacity: 0; transform: scale(0.92); }
      to   { opacity: 1; transform: scale(1); }
    }
    .celebration-in { animation: celebration-in 400ms cubic-bezier(0.34, 1.56, 0.64, 1); }
  `,
    ],
})
export class TutorialPageComponent implements OnInit, OnDestroy {
    private readonly router = inject(Router);
    private readonly simulation = inject(TickEngineService);
    protected readonly tutorial = inject(TutorialService);

    protected readonly ArrowLeftIcon = ArrowLeft;
    protected readonly CheckCircleIcon = CheckCircle;
    protected readonly TrophyIcon = Trophy;

    protected readonly showCelebration = signal(false);

    // Snapshot taken before init() so we don't trigger celebration on re-entry
    private _initiallyComplete = false;

    protected readonly currentStep = computed(() => {
        const idx = this.tutorial.currentStepIndex();
        return idx < this.tutorial.steps.length ? this.tutorial.steps[idx] : null;
    });

    protected readonly stepProgress = computed(() => this.tutorial.currentStepIndex() + 1);

    constructor() {
        effect(() => {
            if (this.tutorial.isComplete() && !this._initiallyComplete) {
                this.tutorial.complete();
                this.showCelebration.set(true);
            }
        });
    }

    ngOnInit(): void {
        this._initiallyComplete = this.tutorial.isComplete();
        this.tutorial.init();
        this.simulation.start();
    }

    ngOnDestroy(): void {
        this.simulation.stop();
        this.tutorial.cleanup();
    }

    protected goToSandbox(): void {
        this.router.navigate(['/sandbox']);
    }

    protected goToChallenges(): void {
        this.router.navigate(['/challenges']);
    }
}
