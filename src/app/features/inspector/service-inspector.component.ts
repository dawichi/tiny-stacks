import { Component } from '@angular/core';
import { ConnectionPanelComponent } from './connection-panel.component';
import { ServicePanelComponent } from './service-panel.component';

@Component({
    selector: 'app-service-inspector',
    standalone: true,
    imports: [ServicePanelComponent, ConnectionPanelComponent],
    template: `
        <app-service-panel />
        <app-connection-panel />
    `,
})
export class ServiceInspectorComponent {}
