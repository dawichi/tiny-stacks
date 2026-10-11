import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GameStateService } from '../../core/game/game-state.service';
import { ServiceType } from '../../core/game/service-types.config';
import { TickEngineService } from '../../core/game/tick-engine.service';
import { StorageKeys } from '../../core/storage/storage.service';
import { SandboxPageComponent } from './sandbox-page.component';

function requiredElement<T extends Element>(element: T | null, label: string): T {
    if (!element) throw new Error(`Test setup: ${label} not found`);
    return element;
}

describe('SandboxPage keyboard journey', () => {
    let fixture: ComponentFixture<SandboxPageComponent>;
    let gameState: GameStateService;
    let tickEngine: TickEngineService;

    beforeEach(() => {
        localStorage.clear();
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
        TestBed.configureTestingModule({
            imports: [SandboxPageComponent],
            providers: [provideRouter([])],
        });

        fixture = TestBed.createComponent(SandboxPageComponent);
        gameState = TestBed.inject(GameStateService);
        tickEngine = TestBed.inject(TickEngineService);
        fixture.detectChanges();
        tickEngine.stop();
        gameState.loadBoard({ services: [], connections: [] });
        fixture.detectChanges();
    });

    afterEach(() => {
        fixture.destroy();
        TestBed.resetTestingModule();
        localStorage.clear();
    });

    it('places, moves, and connects services by keyboard, then persists the edited board', () => {
        const root = fixture.nativeElement as HTMLElement;
        const chooseService = (name: string): void => {
            const button = requiredElement(
                root.querySelector<HTMLButtonElement>(`button[aria-label^="Choose ${name} for placement"]`),
                `${name} palette button`,
            );
            button.click();
            fixture.detectChanges();
        };
        const press = (key: string): void => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
            fixture.detectChanges();
        };

        chooseService('Origin');
        for (let step = 0; step < 3; step++) press('ArrowDown');
        press('Enter');

        chooseService('REST Service');
        for (let step = 0; step < 4; step++) press('ArrowRight');
        for (let step = 0; step < 3; step++) press('ArrowDown');
        press('Enter');

        const origin = gameState.services().find((service) => service.type === ServiceType.ORIGIN);
        const rest = gameState.services().find((service) => service.type === ServiceType.REST_SERVICE);
        expect(origin?.gridX).toBe(0);
        expect(origin?.gridY).toBe(3);
        expect(rest?.gridX).toBe(4);
        expect(rest?.gridY).toBe(3);
        if (!origin || !rest) throw new Error('Test setup: placed services missing');

        const originNode = requiredElement(
            root.querySelector<HTMLElement>(`[aria-label^="Origin. Column 1, row 4"]`),
            'Origin service node',
        );
        originNode.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
        fixture.detectChanges();
        expect(gameState.services().find((service) => service.id === origin.id)?.gridX).toBe(1);

        const originPort = requiredElement(
            root.querySelector<HTMLButtonElement>('button[aria-label="Origin output port 1"]'),
            'Origin output port',
        );
        const restPort = requiredElement(
            root.querySelector<HTMLButtonElement>('button[aria-label="REST Service input port 1"]'),
            'REST input port',
        );
        originPort.click();
        fixture.detectChanges();
        restPort.click();
        fixture.detectChanges();

        expect(gameState.connections()).toHaveLength(1);
        expect(gameState.connections()[0]?.source.serviceId).toBe(origin.id);
        expect(gameState.connections()[0]?.target.serviceId).toBe(rest.id);

        const saved = localStorage.getItem(StorageKeys.GAME_STATE);
        expect(saved).not.toBeNull();
        const parsed = JSON.parse(saved ?? '{}') as { services?: unknown[]; connections?: unknown[] };
        expect(parsed.services).toHaveLength(2);
        expect(parsed.connections).toHaveLength(1);

        press('Delete');
        expect(gameState.connections()).toHaveLength(0);
        expect(root.querySelector('[role="status"]')?.textContent?.trim()).toBe('Connection removed.');
    });
});
