import { Injectable, inject } from '@angular/core';
import { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { toDbError } from './db-error';
import { Supabase } from './supabase';

export interface Proveedor {
  id: number;
  nombre: string;
  telefono: string;
}

export type ProveedorInput = Omit<Proveedor, 'id'>;

const TABLE = 'proveedores';
const COLUMNS = 'id, nombre, telefono';

const MESSAGES: Record<string, string> = {
  '23503': 'No se puede eliminar: este proveedor tiene productos registrados',
  '23505': 'Ya existe un proveedor con ese número telefónico',
  '23514': 'Algún dato no es válido (revisa el teléfono)',
  '42P01': 'La tabla "proveedores" no existe en Supabase (ejecuta proveedores.sql)',
  PGRST205: 'La tabla "proveedores" no existe en Supabase (ejecuta proveedores.sql)',
};

const toError = (error: PostgrestError): Error => toDbError(error, MESSAGES);

@Injectable({ providedIn: 'root' })
export class ProveedoresService {
  private readonly supabase = inject(Supabase);

  async list(): Promise<Proveedor[]> {
    const { data, error } = await this.db().from(TABLE).select(COLUMNS).order('id');
    if (error) throw toError(error);
    return data;
  }

  async create(input: ProveedorInput): Promise<Proveedor> {
    const { data, error } = await this.db().from(TABLE).insert(input).select(COLUMNS).single();
    if (error) throw toError(error);
    return data;
  }

  async update(id: number, input: ProveedorInput): Promise<Proveedor> {
    const { data, error } = await this.db()
      .from(TABLE)
      .update(input)
      .eq('id', id)
      .select(COLUMNS)
      .single();
    if (error) throw toError(error);
    return data;
  }

  async remove(id: number): Promise<void> {
    const { error } = await this.db().from(TABLE).delete().eq('id', id);
    if (error) throw toError(error);
  }

  private db(): SupabaseClient {
    const client = this.supabase.client;
    if (!client) throw new Error('El cliente de Supabase no está disponible');
    return client;
  }
}
