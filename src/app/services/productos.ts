import { Injectable, inject } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { toDbError } from './db-error';
import { Supabase } from './supabase';

export const TIENDAS = ['Amazon', 'Mercado Libre'] as const;
export const REEMBOLSO_VIAS = ['Transferencia', 'PayPal'] as const;

// Tarjetas disponibles. Se guarda "<nombre> <terminación>", p. ej. "BBVA 9154".
export const TARJETAS = [
  { nombre: 'BBVA', terminacion: '9154' },
  { nombre: 'Bsmart', terminacion: '859' },
  { nombre: 'Clasica', terminacion: '680' },
  { nombre: 'Santander Like U', terminacion: '9966' },
  { nombre: 'Mercadolibre', terminacion: '5584' },
  { nombre: 'HomeDepot', terminacion: '344' },
].map((t) => ({ ...t, value: `${t.nombre} ${t.terminacion}` }));
export const DISPONIBILIDADES = ['Disponible', 'Apartado', 'Regalado', 'Vendido'] as const;
export type Disponibilidad = (typeof DISPONIBILIDADES)[number];

export interface Categoria {
  id: number;
  nombre: string;
}

export interface Producto {
  id: number;
  fecha_compra: string;
  nombre: string;
  enlace: string | null;
  tienda: string;
  categoria_id: number;
  tarjeta: string | null;
  precio_compra: number;
  dinero_reembolsado: number | null;
  reembolso_via: string | null;
  resenado: boolean;
  disponibilidad: Disponibilidad;
  imagen_principal_id: number | null;
  proveedor_id: number | null;
  precio_venta: number | null;
}

export type ProductoInput = Omit<Producto, 'id' | 'imagen_principal_id'>;

const COLUMNS =
  'id, fecha_compra, nombre, enlace, tienda, categoria_id, tarjeta, precio_compra, dinero_reembolsado, reembolso_via, resenado, disponibilidad, imagen_principal_id, proveedor_id, precio_venta';

const MESSAGES: Record<string, string> = {
  '23503': 'La categoría o el proveedor seleccionado ya no existe',
  '23514': 'Algún dato no es válido (revisa la tienda, el enlace, el estado y que el reembolso no supere el precio)',
  '42703': 'Faltan columnas en la tabla productos (ejecuta los scripts SQL pendientes)',
  PGRST204: 'Faltan columnas en la tabla productos (ejecuta los scripts SQL pendientes)',
};

// Precio real = lo pagado menos lo reembolsado. Solo existe si hubo reembolso.
export const precioReal = (p: Pick<Producto, 'precio_compra' | 'dinero_reembolsado'>): number | null =>
  p.dinero_reembolsado ? p.precio_compra - p.dinero_reembolsado : null;

// Ganancia esperada = precio de venta − lo que realmente costó. Null si no hay precio de venta.
export const gananciaEsperada = (
  p: Pick<Producto, 'precio_compra' | 'dinero_reembolsado' | 'precio_venta'>,
): number | null =>
  p.precio_venta == null ? null : p.precio_venta - (precioReal(p) ?? p.precio_compra);

@Injectable({ providedIn: 'root' })
export class ProductosService {
  private readonly supabase = inject(Supabase);

  async listCategorias(): Promise<Categoria[]> {
    const { data, error } = await this.db().from('categorias').select('id, nombre').order('nombre');
    if (error) throw toDbError(error, MESSAGES);
    return data;
  }

  async list(): Promise<Producto[]> {
    const { data, error } = await this.db()
      .from('productos')
      .select(COLUMNS)
      .order('fecha_compra', { ascending: false })
      .order('id', { ascending: false });
    if (error) throw toDbError(error, MESSAGES);
    return data;
  }

  // Solo los productos que se pueden vender (estado "Disponible").
  async listDisponibles(): Promise<Producto[]> {
    const { data, error } = await this.db()
      .from('productos')
      .select(COLUMNS)
      .eq('disponibilidad', 'Disponible')
      .order('fecha_compra', { ascending: false })
      .order('id', { ascending: false });
    if (error) throw toDbError(error, MESSAGES);
    return data;
  }

  async create(input: ProductoInput): Promise<Producto> {
    const { data, error } = await this.db().from('productos').insert(input).select(COLUMNS).single();
    if (error) throw toDbError(error, MESSAGES);
    return data;
  }

  async update(id: number, input: ProductoInput): Promise<Producto> {
    const { data, error } = await this.db()
      .from('productos')
      .update(input)
      .eq('id', id)
      .select(COLUMNS)
      .single();
    if (error) throw toDbError(error, MESSAGES);
    return data;
  }

  async setImagenPrincipal(id: number, imagenId: number | null): Promise<void> {
    const { error } = await this.db()
      .from('productos')
      .update({ imagen_principal_id: imagenId })
      .eq('id', id);
    if (error) throw toDbError(error, MESSAGES);
  }

  async remove(id: number): Promise<void> {
    const { error } = await this.db().from('productos').delete().eq('id', id);
    if (error) throw toDbError(error, MESSAGES);
  }

  private db(): SupabaseClient {
    const client = this.supabase.client;
    if (!client) throw new Error('El cliente de Supabase no está disponible');
    return client;
  }
}
