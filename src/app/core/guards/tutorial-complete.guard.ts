import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { StorageKeys, StorageService } from '../storage/storage.service';

export const tutorialCompleteGuard = () => {
    const storage = inject(StorageService);
    const router = inject(Router);

    if (storage.getItem(StorageKeys.TUTORIAL_COMPLETE)) {
        return true;
    }
    return router.createUrlTree(['/']);
};
