import { booleanAttribute, Component, input } from '@angular/core';

// Spinner reutilizable. Uso:
// <app-loader />                    → spinner solo
// <app-loader text="Cargando…" />   → con texto al lado
// <app-loader size="lg" />          → tamaño: 'sm' | 'md' | 'lg'
// <app-loader overlay />            → cubre al padre (position: relative) con velo + tarjeta
@Component({
  selector: 'app-loader',
  host: { '[class.loader-overlay]': 'overlay()' },
  templateUrl: './loader.html',
  styleUrl: './loader.css',
})
export class Loader {
  readonly text = input('');
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly overlay = input(false, { transform: booleanAttribute });
}
