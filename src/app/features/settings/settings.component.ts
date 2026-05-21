import { Component, inject, signal } from '@angular/core';
import { LucideAngularModule, Settings, X } from 'lucide-angular';
import { StorageKeys, StorageService } from '../../core/storage/storage.service';

@Component({
    selector: 'app-settings',
    standalone: true,
    imports: [LucideAngularModule],
    template: `
        <button class="settings-btn" (click)="open.set(true)" title="Settings">
            <lucide-icon [img]="SettingsIcon" [size]="18" />
        </button>

        @if (open()) {
            <div class="overlay" (click)="close()">
                <div class="modal" (click)="$event.stopPropagation()">
                    <div class="modal-header">
                        <h2>Settings</h2>
                        <button class="close-btn" (click)="close()">
                            <lucide-icon [img]="XIcon" [size]="16" />
                        </button>
                    </div>

                    <div class="modal-body">
                        <p class="section-label dev-label">Dev tools</p>
                        <div class="dev-row">
                            <div>
                                <p class="danger-title">Skip tutorial</p>
                                <p class="danger-desc">Marks tutorial complete and unlocks Sandbox + Challenges.</p>
                            </div>
                            <div class="danger-actions">
                                <button class="btn-dev" (click)="skipTutorial()">Unlock all</button>
                            </div>
                        </div>

                        <p class="section-label" style="margin-top: 1rem">Danger Zone</p>
                        <div class="danger-row">
                            <div>
                                <p class="danger-title">Reset all progress</p>
                                <p class="danger-desc">Clears the board, tutorial, and all challenge progress.</p>
                            </div>
                            <div class="danger-actions">
                                @if (confirming()) {
                                    <span class="confirm-label">Sure?</span>
                                    <button class="btn-confirm" (click)="reset()">Yes, reset</button>
                                    <button class="btn-cancel" (click)="confirming.set(false)">Cancel</button>
                                } @else {
                                    <button class="btn-danger" (click)="confirming.set(true)">Reset</button>
                                }
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        }
    `,
    styles: [
        `
        .settings-btn {
            position: fixed;
            bottom: 1rem;
            right: 1rem;
            z-index: 50;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.7);
            backdrop-filter: blur(8px);
            border: 1px solid rgba(255, 255, 255, 0.9);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #94a3b8;
            cursor: pointer;
            transition: background 150ms ease, color 150ms ease, box-shadow 150ms ease;
        }
        .settings-btn:hover {
            background: rgba(255, 255, 255, 0.95);
            color: #475569;
            box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
        }

        .overlay {
            position: fixed;
            inset: 0;
            z-index: 200;
            background: rgba(15, 23, 42, 0.35);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .modal {
            background: rgba(255, 255, 255, 0.97);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.9);
            border-radius: 1rem;
            box-shadow: 0 8px 40px rgba(0, 0, 0, 0.14);
            width: 420px;
            max-width: calc(100vw - 2rem);
        }

        .modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 1.125rem 1.5rem;
            border-bottom: 1px solid #e2e8f0;
        }
        .modal-header h2 {
            font-size: 1rem;
            font-weight: 600;
            color: #1e293b;
            margin: 0;
        }

        .close-btn {
            width: 26px;
            height: 26px;
            border-radius: 6px;
            border: none;
            background: transparent;
            color: #94a3b8;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 150ms ease, color 150ms ease;
        }
        .close-btn:hover {
            background: #f1f5f9;
            color: #475569;
        }

        .modal-body {
            padding: 1.25rem 1.5rem;
        }

        .section-label {
            font-size: 0.7rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.07em;
            color: #ef4444;
            margin: 0 0 0.625rem;
        }
        .dev-label {
            color: #3b82f6;
        }

        .dev-row {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
            padding: 0.875rem 1rem;
            border: 1px solid #bfdbfe;
            border-radius: 0.5rem;
            background: #eff6ff;
        }

        .btn-dev {
            flex-shrink: 0;
            padding: 0.375rem 0.875rem;
            border-radius: 0.375rem;
            border: 1px solid #93c5fd;
            background: white;
            color: #3b82f6;
            font-size: 0.8rem;
            font-weight: 500;
            cursor: pointer;
            transition: background 150ms ease, border-color 150ms ease;
        }
        .btn-dev:hover {
            background: #dbeafe;
            border-color: #3b82f6;
        }

        .danger-row {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
            padding: 0.875rem 1rem;
            border: 1px solid #fecaca;
            border-radius: 0.5rem;
            background: #fff5f5;
        }

        .danger-actions {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 0.5rem;
        }

        .danger-title {
            font-size: 0.875rem;
            font-weight: 500;
            color: #1e293b;
            margin: 0 0 0.2rem;
        }
        .danger-desc {
            font-size: 0.75rem;
            color: #94a3b8;
            margin: 0;
        }

        .btn-danger {
            flex-shrink: 0;
            padding: 0.375rem 0.875rem;
            border-radius: 0.375rem;
            border: 1px solid #fca5a5;
            background: white;
            color: #ef4444;
            font-size: 0.8rem;
            font-weight: 500;
            cursor: pointer;
            transition: background 150ms ease, border-color 150ms ease;
        }
        .btn-danger:hover {
            background: #fee2e2;
            border-color: #ef4444;
        }

        .confirm-label {
            font-size: 0.8rem;
            color: #64748b;
            white-space: nowrap;
        }

        .btn-confirm {
            padding: 0.375rem 0.75rem;
            border-radius: 0.375rem;
            border: none;
            background: #ef4444;
            color: white;
            font-size: 0.8rem;
            font-weight: 500;
            cursor: pointer;
            transition: background 150ms ease;
        }
        .btn-confirm:hover {
            background: #dc2626;
        }

        .btn-cancel {
            padding: 0.375rem 0.75rem;
            border-radius: 0.375rem;
            border: 1px solid #e2e8f0;
            background: white;
            color: #64748b;
            font-size: 0.8rem;
            font-weight: 500;
            cursor: pointer;
            transition: background 150ms ease;
        }
        .btn-cancel:hover {
            background: #f8fafc;
        }
    `,
    ],
})
export class SettingsComponent {
    protected readonly SettingsIcon = Settings;
    protected readonly XIcon = X;

    protected readonly open = signal(false);
    protected readonly confirming = signal(false);

    private readonly storage = inject(StorageService);

    protected close(): void {
        this.open.set(false);
        this.confirming.set(false);
    }

    protected skipTutorial(): void {
        this.storage.setItem(StorageKeys.TUTORIAL_COMPLETE, true);
        window.location.href = '/';
    }

    protected reset(): void {
        this.storage.clearAll();
        window.location.href = '/';
    }
}
