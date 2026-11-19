import { CurrencyPipe, isPlatformBrowser } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  PLATFORM_ID,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ImagenesService, ProductoImagen } from '../../services/imagenes';
import {
  Categoria,
  ProductoCatalogo,
  ProductosService,
  precioReal,
} from '../../services/productos';
import { repartoGanancia } from '../../services/ventas';
import { Loader } from '../../shared/loader/loader';
import { Paginator } from '../../shared/paginator/paginator';

type Orden = 'recientes' | 'precio-asc' | 'precio-desc' | 'nombre';

const normalize = (s: string): string =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

// Mínimo de productos a mostrar por página. Mantenemos 2 (1 fila de 2 cols en
// móvil) para que el paginador nunca se auto-adapte a 0 en viewports chicos,
// pero sin forzar 4 cuando solo caben 2 → evita cortar la última fila.
const MIN_PAGE_SIZE = 2;

// Mapeo de palabras clave en el nombre de la categoría al icono de Bootstrap
// Icons más representativo. Se recorre en orden: la primera coincidencia gana.
// Permite que nuevas categorías "obvias" hereden el icono automáticamente.
const CATEGORIA_ICONOS: { readonly match: string; readonly icon: string }[] = [
  { match: 'automo', icon: 'bi-car-front-fill' },
  { match: 'motocicleta', icon: 'bi-bicycle' },
  { match: 'moto', icon: 'bi-bicycle' },
  { match: 'belleza', icon: 'bi-palette-fill' },
  { match: 'cuidado personal', icon: 'bi-droplet-half' },
  { match: 'salud', icon: 'bi-heart-pulse-fill' },
  { match: 'computac', icon: 'bi-pc-display' },
  { match: 'electronic', icon: 'bi-tv-fill' },
  { match: 'celular', icon: 'bi-phone-fill' },
  { match: 'telefon', icon: 'bi-phone-fill' },
  { match: 'audio', icon: 'bi-music-note-beamed' },
  { match: 'instrument', icon: 'bi-music-note' },
  { match: 'herramienta', icon: 'bi-tools' },
  { match: 'construcc', icon: 'bi-bricks' },
  { match: 'hogar', icon: 'bi-house-door-fill' },
  { match: 'cocina', icon: 'bi-cup-hot-fill' },
  { match: 'jardin', icon: 'bi-flower1' },
  { match: 'limpieza', icon: 'bi-droplet-fill' },
  { match: 'joy', icon: 'bi-gem' },
  { match: 'reloj', icon: 'bi-watch' },
  { match: 'juguete', icon: 'bi-puzzle-fill' },
  { match: 'niño', icon: 'bi-balloon-heart-fill' },
  { match: 'bebe', icon: 'bi-balloon-heart-fill' },
  { match: 'deport', icon: 'bi-trophy-fill' },
  { match: 'fitness', icon: 'bi-bicycle' },
  { match: 'ropa', icon: 'bi-handbag-fill' },
  { match: 'calzado', icon: 'bi-bag-fill' },
  { match: 'zapato', icon: 'bi-bag-fill' },
  { match: 'moda', icon: 'bi-handbag-fill' },
  { match: 'accesorio', icon: 'bi-bag-heart-fill' },
  { match: 'libro', icon: 'bi-book-fill' },
  { match: 'papeler', icon: 'bi-journal-text' },
  { match: 'oficina', icon: 'bi-briefcase-fill' },
  { match: 'mascota', icon: 'bi-github' },
  { match: 'alimento', icon: 'bi-basket-fill' },
  { match: 'comida', icon: 'bi-basket-fill' },
  { match: 'bebida', icon: 'bi-cup-straw' },
  { match: 'videojuego', icon: 'bi-controller' },
  { match: 'gaming', icon: 'bi-controller' },
  { match: 'seguridad', icon: 'bi-camera-video-fill' },
  { match: 'camara', icon: 'bi-camera-fill' },
  { match: 'foto', icon: 'bi-camera-fill' },
  { match: 'iluminac', icon: 'bi-lightbulb-fill' },
  { match: 'luz', icon: 'bi-lightbulb-fill' },
  { match: 'led', icon: 'bi-lightbulb-fill' },
];

export function iconoDeCategoria(nombre: string): string {
  const n = nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return CATEGORIA_ICONOS.find((c) => n.includes(c.match))?.icon ?? 'bi-tag-fill';
}

@Component({
  imports: [CurrencyPipe, Loader, Paginator],
  selector: 'app-catalogo',
  styleUrl: './catalogo.css',
  templateUrl: './catalogo.html',
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class Catalogo implements OnInit {
  private readonly productosService = inject(ProductosService);
  private readonly imagenesService = inject(ImagenesService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly productos = signal<ProductoCatalogo[]>([]);
  protected readonly categorias = signal<Categoria[]>([]);
  protected readonly imagenes = signal<ProductoImagen[]>([]);

  protected readonly loading = signal(true);
  protected readonly error = signal('');

  // ===== Filtros =====
  protected readonly busqueda = signal('');
  protected readonly categoriaId = signal<number | null>(null);
  protected readonly orden = signal<Orden>('recientes');

  // Controla el bottom sheet de categorías en móvil (patrón e-commerce).
  protected readonly menuCategoriasAbierto = signal(false);

  protected readonly categoriaActivaNombre = computed(() => {
    const id = this.categoriaId();
    if (id === null) return 'Todas las categorías';
    return this.categoriaNombre().get(id) ?? 'Categoría';
  });

  protected readonly conteoVisible = computed(() => {
    const id = this.categoriaId();
    if (id === null) return this.productos().length;
    return this.categoriasConProductos().find((c) => c.id === id)?.total ?? 0;
  });

  protected abrirMenuCategorias(): void {
    this.menuCategoriasAbierto.set(true);
  }

  protected cerrarMenuCategorias(): void {
    this.menuCategoriasAbierto.set(false);
  }

  protected seleccionarCategoria(id: number | null): void {
    this.categoriaId.set(id);
    this.cerrarMenuCategorias();
  }

  protected iconoCategoria(nombre: string): string {
    return iconoDeCategoria(nombre);
  }

  protected readonly categoriaNombre = computed(
    () => new Map(this.categorias().map((c) => [c.id, c.nombre])),
  );
  protected readonly imagenesPorProducto = computed(() => {
    const map = new Map<number, ProductoImagen[]>();
    for (const img of this.imagenes()) map.set(img.producto_id, [...(map.get(img.producto_id) ?? []), img]);
    return map;
  });

  // Solo las categorías que tienen productos disponibles, con su cantidad.
  protected readonly categoriasConProductos = computed(() => {
    const counts = new Map<number, number>();
    for (const p of this.productos()) counts.set(p.categoria_id, (counts.get(p.categoria_id) ?? 0) + 1);
    return this.categorias()
      .filter((c) => counts.has(c.id))
      .map((c) => ({ ...c, total: counts.get(c.id)! }));
  });

  protected readonly visibles = computed(() => {
    const q = normalize(this.busqueda());
    const cat = this.categoriaId();
    const list = this.productos().filter(
      (p) =>
        (cat === null || p.categoria_id === cat) &&
        (!q ||
          normalize(p.nombre).includes(q) ||
          normalize(this.categoriaNombre().get(p.categoria_id) ?? '').includes(q)),
    );
    // Ordena por precio de venta; los que no tienen precio van al final.
    const porPrecio = (dir: 1 | -1) => (a: ProductoCatalogo, b: ProductoCatalogo) =>
      a.precio_venta == null ? 1 : b.precio_venta == null ? -1 : (a.precio_venta - b.precio_venta) * dir;
    switch (this.orden()) {
      case 'precio-asc':
        return [...list].sort(porPrecio(1));
      case 'precio-desc':
        return [...list].sort(porPrecio(-1));
      case 'nombre':
        return [...list].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      default:
        return list;
    }
  });

  // ===== Paginación =====
  // pageSize se calcula dinámicamente para llenar justo el espacio disponible
  // sin generar scroll (filas × columnas visibles en el viewport).
  protected readonly page = signal(1);
  protected readonly pageSize = signal(12);
  protected readonly visiblesPaginadas = computed(() => {
    const size = this.pageSize();
    const list = this.visibles();
    const page = Math.min(this.page(), Math.max(1, Math.ceil(list.length / size)));
    return list.slice((page - 1) * size, page * size);
  });

  private readonly gridWrapper = viewChild<ElementRef<HTMLElement>>('gridWrapper');

  // ===== Detalle =====
  protected readonly detalle = signal<ProductoCatalogo | null>(null);
  protected readonly imagenActiva = signal(0);
  protected readonly detalleImagenes = computed(() => {
    const p = this.detalle();
    return p ? this.imagenesOrdenadas(p) : [];
  });

  constructor() {
    // Reset de página al cambiar cualquier filtro.
    effect(() => {
      this.busqueda();
      this.categoriaId();
      this.orden();
      this.page.set(1);
    });

    // Ajuste automático del tamaño de página según el espacio disponible.
    if (this.isBrowser) {
      afterNextRender(() => this.setupAutoPageSize());
    }
  }

  private recalcPageSize = (): void => {
    const wrapper = this.gridWrapper()?.nativeElement;
    if (!wrapper) return;

    const grid = wrapper.querySelector('.grid') as HTMLElement | null;
    if (!grid) return;

    // clientHeight del wrapper = espacio REAL disponible para el grid
    // (el flex layout ya descontó topbar y paginador).
    const available = wrapper.clientHeight;
    if (available < 1) return;

    const style = window.getComputedStyle(grid);
    const gap = parseFloat(style.rowGap || style.gap || '12') || 12;
    const cols = Math.max(
      1,
      (style.gridTemplateColumns || '').split(' ').filter(Boolean).length,
    );

    // Mide un card REAL (button.item), no los skeletons (div.item) que son
    // más bajos. Si solo hay skeletons, esperamos a la siguiente pasada.
    const sampleCard = grid.querySelector('button.item') as HTMLElement | null;
    if (!sampleCard) return;
    const cardHeight = sampleCard.getBoundingClientRect().height;
    if (cardHeight < 1) return;

    // Buffer de 8px para evitar que el redondeo meta una fila que se corta.
    const rows = Math.max(1, Math.floor((available - 8 + gap) / (cardHeight + gap)));
    const size = Math.max(MIN_PAGE_SIZE, cols * rows);
    if (size !== this.pageSize()) this.pageSize.set(size);
  };

  private setupAutoPageSize(): void {
    // Pasada inicial + una tras el primer render de cards reales.
    this.recalcPageSize();
    requestAnimationFrame(this.recalcPageSize);

    const ro = new ResizeObserver(() => this.recalcPageSize());
    ro.observe(document.body);
    this.destroyRef.onDestroy(() => ro.disconnect());
  }

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const [productos, categorias] = await Promise.all([
        this.productosService.listCatalogoPublico(),
        this.productosService.listCategorias(),
      ]);
      this.productos.set(productos);
      this.categorias.set(categorias);
      this.imagenes.set(await this.imagenesService.listFor(productos.map((p) => p.id)));
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.loading.set(false);
      // Recalcula el pageSize con las cards reales (no los skeletons) ya en DOM.
      if (this.isBrowser) {
        requestAnimationFrame(() => this.recalcPageSize());
        setTimeout(() => this.recalcPageSize(), 300);
      }
    }
  }

  // Lo que ganaría un vendedor que no es Admin al venderlo al precio de venta:
  // (precio de venta − precio real) ÷ 2, y qué porcentaje del precio de venta representa.
  protected comision(p: ProductoCatalogo): { monto: number; porcentaje: number } | null {
    if (p.precio_venta == null) return null;
    const { vendedor } = repartoGanancia(p.precio_venta, precioReal(p) ?? p.precio_compra, null);
    if (vendedor <= 0) return { monto: 0, porcentaje: 0 };
    return {
      monto: vendedor,
      porcentaje: p.precio_venta ? Math.round((vendedor / p.precio_venta) * 100) : 0,
    };
  }

  // La principal primero y luego el resto en su orden.
  protected imagenesOrdenadas(p: ProductoCatalogo): ProductoImagen[] {
    const imgs = this.imagenesPorProducto().get(p.id) ?? [];
    const principal = imgs.find((i) => i.id === p.imagen_principal_id);
    return principal ? [principal, ...imgs.filter((i) => i !== principal)] : imgs;
  }

  limpiarFiltros(): void {
    this.busqueda.set('');
    this.categoriaId.set(null);
  }

  abrirDetalle(p: ProductoCatalogo): void {
    this.imagenActiva.set(0);
    this.detalle.set(p);
  }

  cerrarDetalle(): void {
    this.detalle.set(null);
  }

  moverImagen(delta: number): void {
    const total = this.detalleImagenes().length;
    if (total > 1) this.imagenActiva.update((i) => (i + delta + total) % total);
  }

  onKeydown(event: KeyboardEvent): void {
    if (!this.detalle()) return;
    if (event.key === 'Escape') this.cerrarDetalle();
    else if (event.key === 'ArrowRight') this.moverImagen(1);
    else if (event.key === 'ArrowLeft') this.moverImagen(-1);
  }
}
