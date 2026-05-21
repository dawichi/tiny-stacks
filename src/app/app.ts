import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SettingsComponent } from './features/settings/settings.component';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterOutlet, SettingsComponent],
    template: `
        <router-outlet />
        <app-settings />
    `,
})
export class App {}
