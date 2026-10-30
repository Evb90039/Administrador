import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import {
  Categoria,
  DISPONIBILIDADES,
  Disponibilidad,
  Producto,
  ProductoInput,
  ProductosService,
  REEMBOLSO_VIAS,
  TARJETAS,
  TIENDAS,
  gananciaEsperada,
  precioReal,
} from '../../services/productos';
import {
  ImagenesService,
  MAX_IMAGENES,
  MAX_IMAGEN_BYTES,
  ProductoImagen,
  TIPOS_IMAGEN,
} from '../../services/imagenes';
import { Proveedor, ProveedoresService } from '../../services/proveedores';
import { Usuario, UsuariosService } from '../../services/usuarios';
import { RepartoGanancia, Venta, VentasService, repartoGanancia } from '../../services/ventas';
import { SearchSelect, SelectOption } from '../../shared/search-select/search-select';

interface ProductoForm {
  fecha_compra: string;
  nombre: string;
  enlace: string;
  tienda: string;
  categoria_id: number | null;
  proveedor_id: number | null;
  tarjeta: string;
  precio_compra: number | null;
  dinero_reembolsado: number | null;
  reembolso_via: string;
  precio_venta: number | null;
  resenado: boolean;
  disponibilidad: Disponibilidad;
}

interface NuevaImagen {
  file: File;
  preview: string;
}

// Cada pestaña agrupa sus campos con ngModelGroup usando este id.
const TABS = [
  { id: 'general', label: 'Datos generales', icon: 'bi-info-circle' },
  { id: 'tienda', label: 'Tienda', icon: 'bi-shop' },
  { id: 'compra', label: 'Compra', icon: 'bi-credit-card' },
  { id: 'estado', label: 'Estado', icon: 'bi-clipboard-check' },
] as const;

const DISPONIBILIDAD_STYLES: Record<Disponibilidad, { icon: string; css: string }> = {
  Disponible: { icon: 'bi-check-circle', css: 'estado-disponible' },
  Apartado: { icon: 'bi-bookmark', css: 'estado-apartado' },
  Regalado: { icon: 'bi-gift', css: 'estado-regalado' },
  Vendido: { icon: 'bi-cash-coin', css: 'estado-vendido' },
};

// Compara sin acentos ni mayúsculas.
const normalize = (s: string): string =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();


// Fecha local en formato YYYY-MM-DD (lo que usa <input type="date"> y la columna date de Postgres).
const today = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const emptyForm = (): ProductoForm => ({
  fecha_compra: today(),
  nombre: '',
  enlace: '',
  tienda: '',
  categoria_id: null,
  proveedor_id: null,
  tarjeta: '',
  precio_compra: null,
  dinero_reembolsado: null,
  reembolso_via: '',
  precio_venta: null,
  resenado: false,
  disponibilidad: 'Disponible',
});

@Component({
  imports: [FormsModule, DatePipe, CurrencyPipe, DecimalPipe, SearchSelect],
  selector: 'app-productos',
  styleUrl: './productos.css',
  templateUrl: './productos.html',
  host: { '(document:keydown.escape)': 'closeModals()' },
})
export class Productos implements OnInit {
  private readonly service = inject(ProductosService);
  private readonly ventasService = inject(VentasService);
  private readonly usuariosService = inject(UsuariosService);
  private readonly imagenesService = inject(ImagenesService);
  private readonly proveedoresService = inject(ProveedoresService);

  protected readonly tabs = TABS;
  protected readonly tiendas = TIENDAS;
  protected readonly reembolsoVias = REEMBOLSO_VIAS;
  protected readonly disponibilidades = DISPONIBILIDADES;
  protected readonly disponibilidadStyles = DISPONIBILIDAD_STYLES;
  protected readonly maxDate = today();
  protected readonly precioReal = precioReal;

  // Ganancia esperada del formulario (se recalcula en cada cambio de detección).
  protected gananciaForm(): number | null {
    const { precio_compra, precio_venta, dinero_reembolsado } = this.form;
    if (precio_compra == null) return null;
    return gananciaEsperada({ precio_compra, precio_venta, dinero_reembolsado });
  }

  protected gananciaPct(): number | null {
    const g = this.gananciaForm();
    const { precio_compra, dinero_reembolsado } = this.form;
    const costo = precio_compra == null ? 0 : (precioReal({ precio_compra, dinero_reembolsado }) ?? precio_compra);
    return g === null || !costo ? null : Math.round((g / costo) * 100);
  }

  // Ganancia real de la venta que se está registrando, según quién la vende.
  protected gananciaVenta(p: Producto): RepartoGanancia | null {
    const final = this.ventaForm.precio_final;
    if (final == null) return null;
    const vendedor = this.usuarios().find((u) => u.id === this.ventaForm.usuario_id);
    // Sin vendedor elegido todavía se muestra la ganancia completa.
    return repartoGanancia(final, precioReal(p) ?? p.precio_compra, vendedor ? vendedor.rol : 'Admin');
  }

  protected costoReal(p: Producto): number {
    return precioReal(p) ?? p.precio_compra;
  }

  protected vendedorNombre(): string {
    return this.usuarios().find((u) => u.id === this.ventaForm.usuario_id)?.nombre ?? 'el vendedor';
  }

  protected readonly productos = signal<Producto[]>([]);
  protected readonly tarjetas = TARJETAS;

  // "Santander Like U 9966" → "Santander Like U •••• 9966"
  protected tarjetaLabel(value: string): string {
    const t = TARJETAS.find((t) => t.value === value);
    return t ? `${t.nombre} •••• ${t.terminacion}` : value;
  }

  protected readonly categorias = signal<Categoria[]>([]);
  protected readonly categoriaOptions = computed<SelectOption<number>[]>(() =>
    this.categorias().map((c) => ({ value: c.id, label: c.nombre })),
  );
  protected readonly categoriaNombre = computed(
    () => new Map(this.categorias().map((c) => [c.id, c.nombre])),
  );

  protected readonly proveedores = signal<Proveedor[]>([]);
  protected readonly proveedorOptions = computed<SelectOption<number>[]>(() =>
    this.proveedores().map((p) => ({ value: p.id, label: `${p.nombre} · ${p.telefono}` })),
  );
  protected readonly proveedorNombre = computed(
    () => new Map(this.proveedores().map((p) => [p.id, p.nombre])),
  );

  protected readonly usuarios = signal<Usuario[]>([]);
  protected readonly usuarioOptions = computed<SelectOption<number>[]>(() =>
    this.usuarios().map((u) => ({ value: u.id, label: `${u.nombre} · ${u.telefono}` })),
  );
  protected readonly usuarioNombre = computed(
    () => new Map(this.usuarios().map((u) => [u.id, u.nombre])),
  );

  protected readonly ventas = signal<Venta[]>([]);
  protected readonly ventaPorProducto = computed(
    () => new Map(this.ventas().map((v) => [v.producto_id, v])),
  );
  // Venta del producto que se está editando (si tiene, su estado queda fijo en "Vendido").
  protected readonly editingVenta = computed(() => {
    const id = this.editingId();
    return id === null ? null : (this.ventaPorProducto().get(id) ?? null);
  });

  // ===== Filtros =====
  protected readonly busqueda = signal('');
  protected readonly filtroEstado = signal<Disponibilidad | 'todos'>('todos');
  protected readonly filtroResena = signal<'todos' | 'si' | 'no'>('todos');
  protected readonly filtroTienda = signal<string>('todos');

  protected readonly hayFiltros = computed(
    () =>
      !!this.busqueda().trim() ||
      this.filtroEstado() !== 'todos' ||
      this.filtroResena() !== 'todos' ||
      this.filtroTienda() !== 'todos',
  );

  protected readonly conteoEstado = computed(() => {
    const counts = Object.fromEntries(DISPONIBILIDADES.map((d) => [d, 0])) as Record<Disponibilidad, number>;
    for (const p of this.productos()) if (p.disponibilidad in counts) counts[p.disponibilidad]++;
    return counts;
  });

  protected readonly productosFiltrados = computed(() => {
    const q = normalize(this.busqueda());
    const estado = this.filtroEstado();
    const resena = this.filtroResena();
    const tienda = this.filtroTienda();
    return this.productos().filter(
      (p) =>
        (estado === 'todos' || p.disponibilidad === estado) &&
        (resena === 'todos' || p.resenado === (resena === 'si')) &&
        (tienda === 'todos' || p.tienda === tienda) &&
        (!q ||
          normalize(p.nombre).includes(q) ||
          normalize(this.categoriaNombre().get(p.categoria_id) ?? '').includes(q) ||
          normalize(this.proveedorNombre().get(p.proveedor_id ?? -1) ?? '').includes(q)),
    );
  });

  protected readonly stats = computed(() => {
    const list = this.productos();
    const { Disponible: disponibles, Vendido: vendidos } = this.conteoEstado();
    return {
      total: list.length,
      disponibles,
      vendidos,
      pctVendidos: list.length ? Math.round((vendidos / list.length) * 100) : 0,
      invertido: list.reduce((sum, p) => sum + (precioReal(p) ?? p.precio_compra), 0),
      reembolsado: list.reduce((sum, p) => sum + (p.dinero_reembolsado ?? 0), 0),
      conReembolso: list.filter((p) => p.dinero_reembolsado).length,
    };
  });

  limpiarFiltros(): void {
    this.busqueda.set('');
    this.filtroEstado.set('todos');
    this.filtroResena.set('todos');
    this.filtroTienda.set('todos');
  }

  // ===== Imágenes =====
  protected readonly maxImagenes = MAX_IMAGENES;
  protected readonly tiposImagen = TIPOS_IMAGEN.join(',');
  protected readonly imagenes = signal<ProductoImagen[]>([]);
  protected readonly imagenesPorProducto = computed(() => {
    const map = new Map<number, ProductoImagen[]>();
    for (const img of this.imagenes()) map.set(img.producto_id, [...(map.get(img.producto_id) ?? []), img]);
    map.forEach((list) => list.sort((a, b) => a.orden - b.orden));
    return map;
  });
  protected readonly imagenesExistentes = signal<ProductoImagen[]>([]);
  protected readonly nuevasImagenes = signal<NuevaImagen[]>([]);
  protected readonly totalImagenesForm = computed(
    () => this.imagenesExistentes().length + this.nuevasImagenes().length,
  );
  protected readonly principalKey = signal<string | null>(null);
  protected readonly imgError = signal('');
  protected readonly dragOver = signal(false);
  protected readonly savingLabel = signal('Guardando…');
  private imagenesQuitadas: ProductoImagen[] = [];

  protected readonly toSell = signal<Producto | null>(null);
  protected readonly sellError = signal('');
  protected ventaForm = {
    usuario_id: null as number | null,
    fecha_venta: today(),
    precio_final: null as number | null,
  };

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly formError = signal('');

  protected readonly modalOpen = signal(false);
  protected readonly step = signal(0);
  protected readonly editingId = signal<number | null>(null);
  protected readonly toDelete = signal<Producto | null>(null);
  protected form = emptyForm();

  // Guarda los últimos valores visibles para que el recuadro no quede vacío mientras se oculta.
  private lastPreview = { precio: 0, reembolso: 0, real: 0 };

  protected precioRealPreview(reembolsoValid: boolean | null) {
    const { precio_compra: precio, dinero_reembolsado: reembolso } = this.form;
    const real =
      precio != null && reembolsoValid
        ? precioReal({ precio_compra: precio, dinero_reembolsado: reembolso })
        : null;
    if (real !== null) this.lastPreview = { precio: precio!, reembolso: reembolso!, real };
    return { visible: real !== null, ...this.lastPreview };
  }

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const [categorias, productos, usuarios, ventas, imagenes, proveedores] = await Promise.all([
        this.service.listCategorias(),
        this.service.list(),
        this.usuariosService.list(),
        this.ventasService.list(),
        this.imagenesService.list(),
        this.proveedoresService.list(),
      ]);
      this.proveedores.set(proveedores);
      this.categorias.set(categorias);
      this.productos.set(productos);
      this.usuarios.set(usuarios);
      this.ventas.set(ventas);
      this.imagenes.set(imagenes);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  openCreate(): void {
    this.openModal(null, emptyForm());
  }

  openEdit(p: Producto): void {
    const { id, enlace, tarjeta, reembolso_via, tienda, imagen_principal_id: _, ...rest } = p;
    this.openModal(id, {
      ...rest,
      // Productos antiguos con otra tienda: se obliga a elegir una válida.
      tienda: (TIENDAS as readonly string[]).includes(tienda) ? tienda : '',
      enlace: enlace ?? '',
      // Tarjetas antiguas que ya no están en la lista quedan como "Sin tarjeta".
      tarjeta: TARJETAS.some((t) => t.value === tarjeta) ? tarjeta! : '',
      reembolso_via: (REEMBOLSO_VIAS as readonly string[]).includes(reembolso_via ?? '') ? reembolso_via! : '',
    });
  }

  private openModal(id: number | null, form: ProductoForm): void {
    this.form = form;
    this.editingId.set(id);
    this.step.set(0);
    this.formError.set('');
    const producto = id === null ? null : this.productos().find((p) => p.id === id);
    this.resetImagenesForm(
      id === null ? [] : (this.imagenesPorProducto().get(id) ?? []),
      producto?.imagen_principal_id ?? null,
    );
    this.modalOpen.set(true);
  }

  // ===== Imágenes del formulario =====
  // La principal se identifica con "e:<id>" (ya guardada) o "n:<preview>" (nueva, aún sin id).
  private resetImagenesForm(existentes: ProductoImagen[], principalId: number | null = null): void {
    this.nuevasImagenes().forEach((n) => URL.revokeObjectURL(n.preview));
    this.imagenesExistentes.set(existentes);
    this.imagenesQuitadas = [];
    this.nuevasImagenes.set([]);
    this.imgError.set('');
    const principal = existentes.find((i) => i.id === principalId) ?? existentes[0];
    this.principalKey.set(principal ? `e:${principal.id}` : null);
  }

  private primeraKey(): string | null {
    const existente = this.imagenesExistentes()[0];
    if (existente) return `e:${existente.id}`;
    const nueva = this.nuevasImagenes()[0];
    return nueva ? `n:${nueva.preview}` : null;
  }

  marcarPrincipal(key: string): void {
    this.principalKey.set(key);
  }

  // Imagen que se muestra en la tabla: la elegida como principal o, si no hay, la primera.
  protected imagenPrincipal(p: Producto): ProductoImagen | null {
    const imgs = this.imagenesPorProducto().get(p.id) ?? [];
    return imgs.find((i) => i.id === p.imagen_principal_id) ?? imgs[0] ?? null;
  }

  addImagenes(files: FileList | null | undefined): void {
    if (!files?.length) return;
    this.imgError.set('');
    const disponibles = MAX_IMAGENES - this.totalImagenesForm();
    const validas: NuevaImagen[] = [];
    const rechazadas: string[] = [];

    for (const file of Array.from(files)) {
      if (!TIPOS_IMAGEN.includes(file.type)) rechazadas.push(`"${file.name}" no es JPG, PNG, WEBP o GIF`);
      else if (file.size > MAX_IMAGEN_BYTES) rechazadas.push(`"${file.name}" pesa más de 5 MB`);
      else if (validas.length >= disponibles) rechazadas.push(`Máximo ${MAX_IMAGENES} imágenes por producto`);
      else validas.push({ file, preview: URL.createObjectURL(file) });
    }

    this.nuevasImagenes.update((list) => [...list, ...validas]);
    if (!this.principalKey()) this.principalKey.set(this.primeraKey());
    if (rechazadas.length) this.imgError.set([...new Set(rechazadas)].join(' · '));
  }

  onImagenesInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.addImagenes(input.files);
    input.value = ''; // permite volver a elegir el mismo archivo
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    this.addImagenes(event.dataTransfer?.files);
  }

  quitarNueva(index: number): void {
    const img = this.nuevasImagenes()[index];
    if (!img) return;
    URL.revokeObjectURL(img.preview);
    this.nuevasImagenes.update((list) => list.filter((_, i) => i !== index));
    if (this.principalKey() === `n:${img.preview}`) this.principalKey.set(this.primeraKey());
  }

  quitarExistente(img: ProductoImagen): void {
    this.imagenesQuitadas.push(img);
    this.imagenesExistentes.update((list) => list.filter((i) => i.id !== img.id));
    if (this.principalKey() === `e:${img.id}`) this.principalKey.set(this.primeraKey());
  }

  // Borra las imágenes quitadas y sube las nuevas del producto guardado.
  private async guardarImagenes(productoId: number): Promise<void> {
    if (this.imagenesQuitadas.length) {
      const quitadas = this.imagenesQuitadas;
      await this.imagenesService.remove(quitadas);
      this.imagenesQuitadas = [];
      const ids = new Set(quitadas.map((i) => i.id));
      this.imagenes.update((list) => list.filter((i) => !ids.has(i.id)));
    }

    const nuevas = this.nuevasImagenes();
    if (nuevas.length) {
      const startOrden = Math.max(-1, ...this.imagenesExistentes().map((i) => i.orden)) + 1;
      const subidas = await this.imagenesService.upload(productoId, nuevas.map((n) => n.file), startOrden);
      // Si la principal era una imagen nueva, ahora ya tiene id.
      const idx = nuevas.findIndex((n) => this.principalKey() === `n:${n.preview}`);
      if (idx >= 0 && subidas[idx]) this.principalKey.set(`e:${subidas[idx].id}`);
      nuevas.forEach((n) => URL.revokeObjectURL(n.preview));
      this.nuevasImagenes.set([]);
      this.imagenesExistentes.update((list) => [...list, ...subidas]);
      this.imagenes.update((list) => [...list, ...subidas]);
    }

    const key = this.principalKey();
    const principalId = key?.startsWith('e:') ? Number(key.slice(2)) : null;
    const actual = this.productos().find((p) => p.id === productoId)?.imagen_principal_id ?? null;
    if (principalId !== actual) {
      await this.service.setImagenPrincipal(productoId, principalId);
      this.productos.update((list) =>
        list.map((p) => (p.id === productoId ? { ...p, imagen_principal_id: principalId } : p)),
      );
    }
  }

  // Avanza hasta la pestaña indicada, deteniéndose en la primera que tenga errores.
  goTo(target: number, f: NgForm): void {
    for (let i = this.step(); i < target; i++) {
      const group = f.form.get(TABS[i].id);
      if (group?.invalid) {
        group.markAllAsTouched();
        this.step.set(i);
        return;
      }
    }
    this.step.set(target);
  }

  // Enter en cualquier campo: avanza de pestaña, o guarda si es la última.
  submit(f: NgForm): void {
    if (this.step() < TABS.length - 1) {
      this.goTo(this.step() + 1, f);
      return;
    }
    this.goTo(TABS.length - 1, f);
    if (f.invalid) {
      const firstInvalid = TABS.findIndex((t) => f.form.get(t.id)?.invalid);
      f.form.markAllAsTouched();
      if (firstInvalid >= 0) this.step.set(firstInvalid);
      return;
    }
    this.save();
  }

  private async save(): Promise<void> {
    this.saving.set(true);
    this.formError.set('');
    const data: ProductoInput = {
      fecha_compra: this.form.fecha_compra,
      nombre: this.form.nombre.trim(),
      enlace: this.form.enlace.trim() || null,
      tienda: this.form.tienda,
      categoria_id: this.form.categoria_id!,
      proveedor_id: this.form.proveedor_id!,
      tarjeta: this.form.tarjeta || null,
      precio_compra: this.form.precio_compra!,
      precio_venta: this.form.precio_venta ?? null,
      dinero_reembolsado: this.form.dinero_reembolsado ?? null,
      reembolso_via: this.form.reembolso_via || null,
      resenado: this.form.resenado,
      disponibilidad: this.editingVenta() ? 'Vendido' : this.form.disponibilidad,
    };

    let productoId = this.editingId();
    try {
      if (productoId === null) {
        const created = await this.service.create(data);
        this.productos.update((list) => [created, ...list]);
        productoId = created.id;
        // Si luego fallan las imágenes, reintentar actualiza este producto en vez de duplicarlo.
        this.editingId.set(productoId);
      } else {
        const id = productoId;
        const updated = await this.service.update(id, data);
        this.productos.update((list) => list.map((p) => (p.id === id ? updated : p)));
      }
    } catch (e) {
      this.formError.set((e as Error).message);
      this.saving.set(false);
      return;
    }

    try {
      this.savingLabel.set('Subiendo imágenes…');
      await this.guardarImagenes(productoId);
      this.modalOpen.set(false);
    } catch (e) {
      this.step.set(0);
      this.formError.set(`El producto se guardó, pero hubo un problema con las imágenes: ${(e as Error).message}`);
    } finally {
      this.saving.set(false);
      this.savingLabel.set('Guardando…');
    }
  }

  async confirmDelete(): Promise<void> {
    const producto = this.toDelete();
    if (!producto) return;

    this.saving.set(true);
    try {
      const imagenes = this.imagenesPorProducto().get(producto.id) ?? [];
      await this.service.remove(producto.id);
      this.productos.update((list) => list.filter((p) => p.id !== producto.id));
      // La venta y las filas de imágenes se borran en cascada en la base de datos.
      this.ventas.update((list) => list.filter((v) => v.producto_id !== producto.id));
      this.imagenes.update((list) => list.filter((i) => i.producto_id !== producto.id));
      // Los archivos de Storage no se borran en cascada: se eliminan aquí.
      await this.imagenesService.removeFiles(imagenes.map((i) => i.path)).catch(() => {});
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
      this.toDelete.set(null);
    }
  }

  openSell(p: Producto): void {
    // El precio final empieza con el precio de venta; se ajusta si hubo descuento.
    this.ventaForm = { usuario_id: null, fecha_venta: today(), precio_final: p.precio_venta };
    this.sellError.set('');
    this.toSell.set(p);
  }

  async confirmSell(f: NgForm): Promise<void> {
    const producto = this.toSell();
    if (!producto || f.invalid) {
      f.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.sellError.set('');
    try {
      const venta = await this.ventasService.registrar(
        producto.id,
        this.ventaForm.usuario_id!,
        this.ventaForm.fecha_venta,
        this.ventaForm.precio_final ?? null,
      );
      this.ventas.update((list) => [...list, venta]);
      this.productos.update((list) =>
        list.map((p) => (p.id === producto.id ? { ...p, disponibilidad: 'Vendido' } : p)),
      );
      this.toSell.set(null);
    } catch (e) {
      this.sellError.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  closeModals(): void {
    if (this.saving()) return;
    if (this.modalOpen()) this.resetImagenesForm([]);
    this.modalOpen.set(false);
    this.toDelete.set(null);
    this.toSell.set(null);
  }
}
