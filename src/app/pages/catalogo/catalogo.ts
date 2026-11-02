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
import { Categoria, Producto, ProductosService, precioReal } from '../../services/productos';
import { repartoGanancia } from '../../services/ventas';
import { Loader } from '../../shared/loader/loader';
import { Paginator } from '../../shared/paginator/paginator';

type Orden = 'recientes' | 'precio-asc' | 'precio-desc' | 'nombre';

const normalize = (s: string): string =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

// Mínimo de productos a mostrar por página para evitar páginas casi vacías.
const MIN_PAGE_SIZE = 4;

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

  protected readonly productos = signal<Producto[]>([]);
  protected readonly categorias = signal<Categoria[]>([]);
  protected readonly imagenes = signal<ProductoImagen[]>([]);

  protected readonly loading = signal(true);
  protected readonly error = signal('');

  // ===== Filtros =====
  protected readonly busqueda = signal('');
  protected readonly categoriaId = signal<number | null>(null);
  protected readonly orden = signal<Orden>('recientes');

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
    const porPrecio = (dir: 1 | -1) => (a: Producto, b: Producto) =>
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
  protected readonly detalle = signal<Producto | null>(null);
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

  private setupAutoPageSize(): void {
    const update = () => {
      const wrapper = this.gridWrapper()?.nativeElement;
      if (!wrapper) return;

      const grid = wrapper.querySelector('.grid') as HTMLElement | null;
      const rect = (grid ?? wrapper).getBoundingClientRect();
      if (rect.width < 1) return;

      const style = window.getComputedStyle(grid ?? wrapper);
      const gap = parseFloat(style.rowGap || style.gap || '20') || 20;

      // Lee las columnas reales que calculó el browser (respeta media queries,
      // auto-fill, etc.) en vez de hardcodear anchos mínimos.
      const cols = Math.max(
        1,
        (style.gridTemplateColumns || '').split(' ').filter(Boolean).length,
      );

      // Mide la altura real de un card renderizado; si no hay cards todavía,
      // estima: ancho de columna (imagen cuadrada) + cuerpo + footer.
      const sampleCard = grid?.querySelector('.item') as HTMLElement | null;
      const colWidth = (rect.width - (cols - 1) * gap) / cols;
      const cardHeight = sampleCard?.getBoundingClientRect().height || colWidth + 140;

      // Alto disponible = del top del grid hasta el fondo del viewport,
      // reservando ~56 px para el paginador y un margen.
      const available = window.innerHeight - rect.top - 56 - 12;
      const rows = Math.max(1, Math.floor((available + gap) / (cardHeight + gap)));

      const size = Math.max(MIN_PAGE_SIZE, cols * rows);
      if (size !== this.pageSize()) this.pageSize.set(size);
    };

    // Dos pasadas: la primera estima; la segunda, tras renderizar, usa la altura real.
    update();
    requestAnimationFrame(update);

    const ro = new ResizeObserver(() => update());
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
        this.productosService.listDisponibles(),
        this.productosService.listCategorias(),
      ]);
      this.productos.set(productos);
      this.categorias.set(categorias);
      this.imagenes.set(await this.imagenesService.listFor(productos.map((p) => p.id)));
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  // Lo que ganaría un vendedor que no es Admin al venderlo al precio de venta:
  // (precio de venta − precio real) ÷ 2, y qué porcentaje del precio de venta representa.
  protected comision(p: Producto): { monto: number; porcentaje: number } | null {
    if (p.precio_venta == null) return null;
    const { vendedor } = repartoGanancia(p.precio_venta, precioReal(p) ?? p.precio_compra, null);
    if (vendedor <= 0) return { monto: 0, porcentaje: 0 };
    return {
      monto: vendedor,
      porcentaje: p.precio_venta ? Math.round((vendedor / p.precio_venta) * 100) : 0,
    };
  }

  // La principal primero y luego el resto en su orden.
  protected imagenesOrdenadas(p: Producto): ProductoImagen[] {
    const imgs = this.imagenesPorProducto().get(p.id) ?? [];
    const principal = imgs.find((i) => i.id === p.imagen_principal_id);
    return principal ? [principal, ...imgs.filter((i) => i !== principal)] : imgs;
  }

  limpiarFiltros(): void {
    this.busqueda.set('');
    this.categoriaId.set(null);
  }

  abrirDetalle(p: Producto): void {
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
