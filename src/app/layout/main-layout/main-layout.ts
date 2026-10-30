import { Component, HostListener, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Auth } from '../../services/auth';

interface MenuItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  selector: 'app-main-layout',
  styleUrl: './main-layout.css',
  templateUrl: './main-layout.html',
})
export class MainLayout {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  // En móvil arranca cerrado; en escritorio, abierto.
  protected readonly sidebarOpen = signal(
    typeof window === 'undefined' || window.innerWidth > 768,
  );

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

  closeSidebarOnMobile(): void {
    if (window.innerWidth <= 768) this.sidebarOpen.set(false);
  }

  async logout(): Promise<void> {
    await this.auth.signOut();
    this.router.navigateByUrl('/login');
  }
}
