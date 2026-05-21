import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { LucideAngularModule, Monitor } from 'lucide-angular';

@Component({
    selector: 'app-screen-guard',
    standalone: true,
    imports: [LucideAngularModule],
    template: `
        @if (tooNarrow()) {
            <div class="fixed inset-0 z-[300] flex items-center justify-center p-8
                        bg-slate-900/96 backdrop-blur-sm">
                <div class="text-center max-w-xs">
                    <lucide-icon [img]="MonitorIcon" [size]="48" class="text-slate-400 mx-auto mb-5" />
                    <h2 class="text-xl font-bold text-white mb-3">Desktop only</h2>
                    <p class="text-slate-400 text-sm leading-relaxed">
                        tiny-stacks is a grid-based builder that needs a mouse and a larger screen.
                        Open it on a laptop or desktop to play.
                    </p>
                </div>
            </div>
        }
    `,
})
export class ScreenGuardComponent implements OnInit, OnDestroy {
    protected readonly tooNarrow = signal(false);
    protected readonly MonitorIcon = Monitor;

    private readonly onResize = () => this.tooNarrow.set(window.innerWidth < 768);

    ngOnInit(): void {
        this.onResize();
        window.addEventListener('resize', this.onResize);
    }

    ngOnDestroy(): void {
        window.removeEventListener('resize', this.onResize);
    }
}
