import { Component, inject, signal } from '@angular/core';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { Auth } from '../../services/auth';
import { Loader } from '../../shared/loader/loader';

interface MenuItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  imports: [Loader, RouterLink, RouterLinkActive, RouterOutlet],
  selector: 'app-main-layout',
  styleUrl: './main-layout.css',
  templateUrl: './main-layout.html',
})
export class MainLayout {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  protected readonly sidebarOpen = signal(true);
  protected readonly navigating = signal(false);

  private navStartedAt = 0;
  private hideTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        clearTimeout(this.hideTimer);
        this.navStartedAt = Date.now();
        this.navigating.set(true);
      } else if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        // Mínimo 350ms visible para que no parpadee en navegaciones instantáneas
        const remaining = Math.max(0, 350 - (Date.now() - this.navStartedAt));
        this.hideTimer = setTimeout(() => this.navigating.set(false), remaining);
      }
    });
  }

  protected readonly menuItems: MenuItem[] = [
    { label: 'Dashboard', icon: 'bi-speedometer2', route: '/dashboard' },
    { label: 'Usuarios', icon: 'bi-people', route: '/usuarios' },
    { label: 'Proveedores', icon: 'bi-truck', route: '/proveedores' },
    { label: 'Productos', icon: 'bi-box-seam', route: '/productos' },
    { label: 'Catálogo', icon: 'bi-shop-window', route: '/catalogo' },
    { label: 'Finanzas', icon: 'bi-cash-stack', route: '/finanzas' },
    { label: 'Reportes', icon: 'bi-graph-up', route: '/reportes' },
    { label: 'Ajustes', icon: 'bi-gear', route: '/ajustes' },
  ];

  toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }

  async logout(): Promise<void> {
    await this.auth.signOut();
    this.router.navigateByUrl('/login');
  }
}
