import type { Routes } from '@angular/router';
import { tutorialCompleteGuard } from './core/guards/tutorial-complete.guard';
import { ChallengePageComponent } from './features/challenges/challenge-page.component';
import { ChallengesPageComponent } from './features/challenges/challenges-page.component';
import { HomePageComponent } from './features/home/home-page.component';
import { SandboxPageComponent } from './features/sandbox/sandbox-page.component';
import { TutorialPageComponent } from './features/tutorial/tutorial-page.component';

export const routes: Routes = [
    { path: '', component: HomePageComponent },
    { path: 'tutorial', component: TutorialPageComponent },
    { path: 'sandbox', canActivate: [tutorialCompleteGuard], component: SandboxPageComponent },
    { path: 'challenges', canActivate: [tutorialCompleteGuard], component: ChallengesPageComponent },
    { path: 'challenges/:id', canActivate: [tutorialCompleteGuard], component: ChallengePageComponent },
    { path: '**', redirectTo: '' },
];
