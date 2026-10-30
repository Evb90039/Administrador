import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Producto, ProductosService, precioReal } from '../../services/productos';
import { Usuario, UsuariosService } from '../../services/usuarios';
import { Venta, VentasService, repartoGanancia } from '../../services/ventas';
import { Loader } from '../../shared/loader/loader';

type Periodo = 'mes' | 'mes-anterior' | 'anio' | 'todo';

interface VentaDetalle {
  venta: Venta;
  producto: Producto | null;
  costo: number;
  /** Tu parte de la ganancia (ya descontada la comisión del vendedor). */
  ganancia: number | null;
  /** Parte del vendedor cuando no es Admin. */
  comision: number | null;
}

interface ResumenUsuario {
  usuario: Usuario;
  ventas: VentaDetalle[];
  total: number;
  ganancia: number;
  comision: number;
  ultimaVenta: string;
  sinPrecio: number;
}

// Fecha local en formato YYYY-MM-DD.
const iso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Rango [desde, hasta) de cada período, comparable con fecha_venta (texto YYYY-MM-DD).
const rango = (periodo: Periodo): [string, string] | null => {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = hoy.getMonth();
  switch (periodo) {
    case 'mes':
      return [iso(new Date(y, m, 1)), iso(new Date(y, m + 1, 1))];
    case 'mes-anterior':
      return [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 1))];
    case 'anio':
      return [iso(new Date(y, 0, 1)), iso(new Date(y + 1, 0, 1))];
    default:
      return null;
  }
};

const AVATAR_COLORS = ['avatar-blue', 'avatar-green', 'avatar-amber', 'avatar-violet', 'avatar-rose', 'avatar-cyan'];

@Component({
  imports: [CurrencyPipe, DatePipe, Loader],
  selector: 'app-finanzas',
  styleUrl: './finanzas.css',
  templateUrl: './finanzas.html',
})
export class Finanzas implements OnInit {
  private readonly ventasService = inject(VentasService);
  private readonly productosService = inject(ProductosService);
  private readonly usuariosService = inject(UsuariosService);

  protected readonly periodos: { id: Periodo; label: string }[] = [
    { id: 'mes', label: 'Este mes' },
    { id: 'mes-anterior', label: 'Mes anterior' },
    { id: 'anio', label: 'Este año' },
    { id: 'todo', label: 'Todo' },
  ];

  protected readonly ventas = signal<Venta[]>([]);
  protected readonly productos = signal<Producto[]>([]);
  protected readonly usuarios = signal<Usuario[]>([]);

  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly periodo = signal<Periodo>('mes');
  protected readonly expandido = signal<number | null>(null);

  private readonly productoPorId = computed(() => new Map(this.productos().map((p) => [p.id, p])));
  private readonly usuarioPorId = computed(() => new Map(this.usuarios().map((u) => [u.id, u])));

  protected readonly ventasPeriodo = computed<VentaDetalle[]>(() => {
    const r = rango(this.periodo());
    const productos = this.productoPorId();
    const usuarios = this.usuarioPorId();
    return this.ventas()
      .filter((v) => !r || (v.fecha_venta >= r[0] && v.fecha_venta < r[1]))
      .map((venta) => {
        const producto = productos.get(venta.producto_id) ?? null;
        const costo = producto ? (precioReal(producto) ?? producto.precio_compra) : 0;
        const reparto =
          venta.precio_final == null
            ? null
            : repartoGanancia(venta.precio_final, costo, usuarios.get(venta.usuario_id)?.rol);
        return {
          venta,
          producto,
          costo,
          ganancia: reparto?.tuParte ?? null,
          comision: reparto?.vendedor ?? null,
        };
      })
      .sort((a, b) => b.venta.fecha_venta.localeCompare(a.venta.fecha_venta));
  });

  // Ranking de usuarios por total vendido en el período.
  protected readonly resumen = computed<ResumenUsuario[]>(() => {
    const porUsuario = new Map<number, VentaDetalle[]>();
    for (const d of this.ventasPeriodo()) {
      porUsuario.set(d.venta.usuario_id, [...(porUsuario.get(d.venta.usuario_id) ?? []), d]);
    }
    return this.usuarios()
      .filter((u) => porUsuario.has(u.id))
      .map((usuario) => {
        const ventas = porUsuario.get(usuario.id)!;
        return {
          usuario,
          ventas,
          total: ventas.reduce((s, d) => s + (d.venta.precio_final ?? 0), 0),
          ganancia: ventas.reduce((s, d) => s + (d.ganancia ?? 0), 0),
          comision: ventas.reduce((s, d) => s + (d.comision ?? 0), 0),
          ultimaVenta: ventas[0].venta.fecha_venta,
          sinPrecio: ventas.filter((d) => d.venta.precio_final == null).length,
        };
      })
      .sort((a, b) => b.total - a.total || b.ventas.length - a.ventas.length);
  });

  protected readonly totales = computed(() => {
    const ventas = this.ventasPeriodo();
    const ingresos = ventas.reduce((s, d) => s + (d.venta.precio_final ?? 0), 0);
    const conPrecio = ventas.filter((d) => d.venta.precio_final != null).length;
    return {
      cantidad: ventas.length,
      ingresos,
      ganancia: ventas.reduce((s, d) => s + (d.ganancia ?? 0), 0),
      comisiones: ventas.reduce((s, d) => s + (d.comision ?? 0), 0),
      promedio: conPrecio ? ingresos / conPrecio : 0,
      sinPrecio: ventas.length - conPrecio,
      vendedores: this.resumen().length,
    };
  });

  // Mayor total del período: sirve para dibujar la barra de cada usuario.
  protected readonly maxTotal = computed(() => Math.max(1, ...this.resumen().map((r) => r.total)));

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const [ventas, productos, usuarios] = await Promise.all([
        this.ventasService.list(),
        this.productosService.list(),
        this.usuariosService.list(),
      ]);
      this.ventas.set(ventas);
      this.productos.set(productos);
      this.usuarios.set(usuarios);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  cambiarPeriodo(p: Periodo): void {
    this.periodo.set(p);
    this.expandido.set(null);
  }

  toggle(usuarioId: number): void {
    this.expandido.update((id) => (id === usuarioId ? null : usuarioId));
  }

  protected initials(nombre: string): string {
    return (
      nombre
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0].toUpperCase())
        .join('') || '?'
    );
  }

  protected avatarColor(id: number): string {
    return AVATAR_COLORS[id % AVATAR_COLORS.length];
  }
}
