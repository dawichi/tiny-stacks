import type { Routes } from '@angular/router';
import { ChallengesPageComponent } from './features/challenges/challenges-page.component';
import { HomePageComponent } from './features/home/home-page.component';
import { SandboxPageComponent } from './features/sandbox/sandbox-page.component';

export const routes: Routes = [
    { path: '', component: HomePageComponent },
    { path: 'sandbox', component: SandboxPageComponent },
    { path: 'challenges', component: ChallengesPageComponent },
    { path: '**', redirectTo: '' },
];
