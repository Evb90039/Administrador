import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '../services/auth';

export const authGuard: CanActivateFn = async () => {
  // En el servidor no hay sesión en localStorage; la verificación real ocurre en el navegador.
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return true;

  const auth = inject(Auth);
  const router = inject(Router);

  const session = await auth.getSession();
  return session ? true : router.createUrlTree(['/login']);
};

export const guestGuard: CanActivateFn = async () => {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return true;

  const auth = inject(Auth);
  const router = inject(Router);

  const session = await auth.getSession();
  return session ? router.createUrlTree(['/dashboard']) : true;
};
