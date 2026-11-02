import { CurrencyPipe, DecimalPipe, isPlatformBrowser } from '@angular/common';
import { Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChartComponent } from 'ng-apexcharts';
import { Producto, ProductosService, precioReal } from '../../services/productos';
import { Usuario, UsuariosService } from '../../services/usuarios';
import { Venta, VentasService, repartoGanancia } from '../../services/ventas';
import { Loader } from '../../shared/loader/loader';

// Nombres cortos de los meses para los ejes/labels.
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const MONTHS_HISTORY = 6; // cuántos meses mostramos en la gráfica

interface MesData {
  key: string; // "2026-10"
  label: string; // "Oct"
  totalVentas: number; // suma de precio_final
  ganancia: number; // suma de ganancia (precio_final − precio_real)
  count: number; // cantidad de ventas
}

interface TopVendedor {
  usuario: Usuario;
  ventas: number;
  comision: number;
}

@Component({
  imports: [RouterLink, CurrencyPipe, DecimalPipe, Loader, ChartComponent],
  selector: 'app-dashboard',
  styleUrl: './dashboard.css',
  templateUrl: './dashboard.html',
})
export class Dashboard implements OnInit {
  private readonly productosService = inject(ProductosService);
  private readonly ventasService = inject(VentasService);
  private readonly usuariosService = inject(UsuariosService);
  protected readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly productos = signal<Producto[]>([]);
  protected readonly ventas = signal<Venta[]>([]);
  protected readonly usuarios = signal<Usuario[]>([]);

  protected readonly loading = signal(true);
  protected readonly error = signal('');

  // ===== Índices útiles =====
  private readonly productoMap = computed(() => new Map(this.productos().map((p) => [p.id, p])));
  private readonly usuarioMap = computed(() => new Map(this.usuarios().map((u) => [u.id, u])));

  // ===== KPIs principales =====
  protected readonly stats = computed(() => {
    const list = this.productos();
    const invertido = list.reduce((s, p) => s + (precioReal(p) ?? p.precio_compra), 0);
    const disponibles = list.filter((p) => p.disponibilidad === 'Disponible').length;
    const vendidos = list.filter((p) => p.disponibilidad === 'Vendido').length;
    const reembolsado = list.reduce((s, p) => s + (p.dinero_reembolsado ?? 0), 0);

    let gananciaTotal = 0;
    for (const v of this.ventas()) {
      if (v.precio_final == null) continue;
      const prod = this.productoMap().get(v.producto_id);
      if (!prod) continue;
      const costo = precioReal(prod) ?? prod.precio_compra;
      gananciaTotal += v.precio_final - costo;
    }

    return {
      invertido,
      reembolsado,
      disponibles,
      vendidos,
      total: list.length,
      ganancia: gananciaTotal,
      pctVendidos: list.length ? Math.round((vendidos / list.length) * 100) : 0,
    };
  });

  // ===== Serie mensual =====
  // Agrupa las ventas por mes (clave "YYYY-MM") en los últimos N meses.
  private readonly mesesSerie = computed<MesData[]>(() => {
    const now = new Date();
    const months: MesData[] = [];
    for (let i = MONTHS_HISTORY - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push({ key, label: MESES[d.getMonth()], totalVentas: 0, ganancia: 0, count: 0 });
    }
    const index = new Map(months.map((m, i) => [m.key, i]));

    for (const v of this.ventas()) {
      if (v.precio_final == null) continue;
      const key = v.fecha_venta.slice(0, 7); // "YYYY-MM"
      const i = index.get(key);
      if (i === undefined) continue;
      const prod = this.productoMap().get(v.producto_id);
      if (!prod) continue;
      const costo = precioReal(prod) ?? prod.precio_compra;
      months[i].totalVentas += v.precio_final;
      months[i].ganancia += v.precio_final - costo;
      months[i].count += 1;
    }
    return months;
  });

  // ===== Comparativa mes actual vs mes anterior =====
  protected readonly mesActual = computed(() => this.mesesSerie().at(-1)!);
  protected readonly mesAnterior = computed(() => this.mesesSerie().at(-2) ?? this.mesActual());

  protected readonly cambioMes = computed(() => {
    const actual = this.mesActual().totalVentas;
    const previo = this.mesAnterior().totalVentas;
    if (!previo) return actual > 0 ? 100 : 0;
    return Math.round(((actual - previo) / previo) * 100);
  });

  // ===== Top vendedores (ventas que no son del Admin, mostrando su comisión) =====
  protected readonly topVendedores = computed<TopVendedor[]>(() => {
    const agg = new Map<number, { ventas: number; comision: number }>();
    for (const v of this.ventas()) {
      if (v.precio_final == null) continue;
      const usuario = this.usuarioMap().get(v.usuario_id);
      if (!usuario) continue;
      const prod = this.productoMap().get(v.producto_id);
      if (!prod) continue;
      const costo = precioReal(prod) ?? prod.precio_compra;
      const { vendedor } = repartoGanancia(v.precio_final, costo, usuario.rol);
      const current = agg.get(usuario.id) ?? { ventas: 0, comision: 0 };
      current.ventas += 1;
      current.comision += vendedor;
      agg.set(usuario.id, current);
    }

    return [...agg.entries()]
      .map(([id, data]) => ({ usuario: this.usuarioMap().get(id)!, ...data }))
      .sort((a, b) => b.comision - a.comision || b.ventas - a.ventas)
      .slice(0, 5);
  });

  protected readonly comisionesTotales = computed(() =>
    this.topVendedores().reduce((s, v) => s + v.comision, 0),
  );

  // ===== Opciones de ApexCharts =====
  // Series y options son computed para que cambien automáticamente al cargar.
  protected readonly chartSeries = computed(() => [
    { name: 'Ventas', data: this.mesesSerie().map((m) => Math.round(m.totalVentas)) },
    { name: 'Ganancia', data: this.mesesSerie().map((m) => Math.round(m.ganancia)) },
  ]);

  protected readonly chartOptions = computed(() => ({
    type: 'area' as const,
    height: '100%' as const,
    toolbar: { show: false },
    animations: { enabled: true, speed: 400 },
    fontFamily: 'Inter, system-ui, sans-serif',
    zoom: { enabled: false },
    parentHeightOffset: 0,
  }));

  protected readonly chartXaxis = computed(() => ({
    categories: this.mesesSerie().map((m) => m.label),
    axisBorder: { show: false },
    axisTicks: { show: false },
    labels: { style: { colors: '#6b7280', fontSize: '12px' } },
  }));

  protected readonly chartYaxis = computed(() => ({
    labels: {
      style: { colors: '#6b7280', fontSize: '12px' },
      formatter: (v: number) =>
        v >= 1000 ? `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `$${v.toFixed(0)}`,
    },
  }));

  protected readonly chartStroke = { curve: 'smooth' as const, width: 2.5 };
  protected readonly chartColors = ['#2563eb', '#10b981'];
  protected readonly chartDataLabels = { enabled: false };
  protected readonly chartLegend = {
    position: 'top' as const,
    horizontalAlign: 'right' as const,
    fontSize: '13px',
    markers: { size: 6 },
    itemMargin: { horizontal: 12 },
  };
  protected readonly chartGrid = {
    strokeDashArray: 4,
    borderColor: '#e5e7eb',
    padding: { left: 10, right: 10 },
  };
  protected readonly chartTooltip = {
    y: { formatter: (v: number) => `$${v.toLocaleString('es-MX')}` },
  };
  protected readonly chartFill = {
    type: 'gradient',
    gradient: { shadeIntensity: 0.6, opacityFrom: 0.35, opacityTo: 0.05, stops: [0, 100] },
  };

  // ===== Mini sparkline del card "Ventas del mes" =====
  protected readonly sparkSeries = computed(() => [
    { name: 'Ventas', data: this.mesesSerie().map((m) => Math.round(m.totalVentas)) },
  ]);
  protected readonly sparkOptions = {
    type: 'area' as const,
    height: 70,
    sparkline: { enabled: true },
    animations: { enabled: true, speed: 400 },
  };
  protected readonly sparkStroke = { curve: 'smooth' as const, width: 2 };
  protected readonly sparkColors = ['#2563eb'];
  protected readonly sparkFill = {
    type: 'gradient',
    gradient: { opacityFrom: 0.4, opacityTo: 0 },
  };
  protected readonly sparkTooltip = {
    y: { formatter: (v: number) => `$${v.toLocaleString('es-MX')}` },
    x: { show: false },
    marker: { show: false },
  };

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const [productos, ventas, usuarios] = await Promise.all([
        this.productosService.list(),
        this.ventasService.list(),
        this.usuariosService.list(),
      ]);
      this.productos.set(productos);
      this.ventas.set(ventas);
      this.usuarios.set(usuarios);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  // Iniciales del usuario para el avatar.
  protected iniciales(nombre: string): string {
    return nombre
      .split(' ')
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
}
