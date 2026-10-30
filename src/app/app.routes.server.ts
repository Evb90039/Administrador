import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'login',
    renderMode: RenderMode.Prerender
  },
  {
    // Las rutas protegidas dependen de la sesión del navegador: no se pre-renderizan en el servidor.
    path: '**',
    renderMode: RenderMode.Client
  }
];
