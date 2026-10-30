import { Injectable, inject } from '@angular/core';
import { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { toDbError } from './db-error';
import { Supabase } from './supabase';

export interface Venta {
  id: number;
  producto_id: number;
  usuario_id: number;
  fecha_venta: string;
  precio_final: number | null;
}

const COLUMNS = 'id, producto_id, usuario_id, fecha_venta, precio_final';

export interface RepartoGanancia {
  /** Precio final − precio real. */
  total: number;
  /** Lo que te queda a ti (el Admin). */
  tuParte: number;
  /** Lo que le corresponde al vendedor (0 si vendió un Admin). */
  vendedor: number;
  dividida: boolean;
}

// Regla de reparto: si vendió un Admin la ganancia es completa;
// si vendió otro rol, (precio final − precio real) se divide entre 2.
export const repartoGanancia = (
  precioFinal: number,
  precioReal: number,
  rolVendedor: string | null | undefined,
): RepartoGanancia => {
  const total = precioFinal - precioReal;
  const dividida = rolVendedor !== 'Admin';
  const vendedor = dividida ? total / 2 : 0;
  return { total, tuParte: total - vendedor, vendedor, dividida };
};

const MESSAGES: Record<string, string> = {
  '23503': 'El producto o el usuario ya no existe',
  '23505': 'Este producto ya fue registrado como vendido',
  '23514': 'El precio final no es válido',
  '42703': 'Falta la columna precio_final en ventas (ejecuta ventas_precio_final.sql)',
  '42883': 'Falta la función registrar_venta actualizada (ejecuta ventas_precio_final.sql)',
  PGRST202: 'Falta la función registrar_venta actualizada (ejecuta ventas_precio_final.sql)',
};

const toError = (error: PostgrestError): Error => toDbError(error, MESSAGES);

@Injectable({ providedIn: 'root' })
export class VentasService {
  private readonly supabase = inject(Supabase);

  async list(): Promise<Venta[]> {
    const { data, error } = await this.db().from('ventas').select(COLUMNS);
    if (error) throw toError(error);
    return data;
  }

  // Inserta la venta y marca el producto como "Vendido" en una sola transacción (función SQL).
  async registrar(
    productoId: number,
    usuarioId: number,
    fechaVenta: string,
    precioFinal: number | null,
  ): Promise<Venta> {
    const { data, error } = await this.db().rpc('registrar_venta', {
      p_producto_id: productoId,
      p_usuario_id: usuarioId,
      p_fecha_venta: fechaVenta,
      p_precio_final: precioFinal,
    });
    if (error) throw toError(error);
    return data as Venta;
  }

  private db(): SupabaseClient {
    const client = this.supabase.client;
    if (!client) throw new Error('El cliente de Supabase no está disponible');
    return client;
  }
}
