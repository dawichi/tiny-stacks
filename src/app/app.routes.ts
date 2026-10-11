import type { Routes } from '@angular/router';
import { ChallengePageComponent } from './features/challenges/challenge-page.component';
import { ChallengesPageComponent } from './features/challenges/challenges-page.component';
import { HomePageComponent } from './features/home/home-page.component';
import { SandboxPageComponent } from './features/sandbox/sandbox-page.component';
import { TutorialPageComponent } from './features/tutorial/tutorial-page.component';

export const routes: Routes = [
    { path: '', component: HomePageComponent },
    { path: 'tutorial', component: TutorialPageComponent },
    { path: 'sandbox', component: SandboxPageComponent },
    { path: 'challenges', component: ChallengesPageComponent },
    { path: 'challenges/:id', component: ChallengePageComponent },
    { path: '**', redirectTo: '' },
];
