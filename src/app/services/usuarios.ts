import { Injectable, inject } from '@angular/core';
import { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { toDbError } from './db-error';
import { Supabase } from './supabase';

export const ROLES = ['Admin', 'Usuario', 'Invitado'] as const;
export type Rol = (typeof ROLES)[number];

export interface Usuario {
  id: number;
  nombre: string;
  telefono: string;
  rol: Rol;
}

export type UsuarioInput = Omit<Usuario, 'id'>;

const TABLE = 'usuarios';
const COLUMNS = 'id, nombre, telefono, rol';

@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private readonly supabase = inject(Supabase);

  async list(): Promise<Usuario[]> {
    const { data, error } = await this.db().from(TABLE).select(COLUMNS).order('id');
    if (error) throw toError(error);
    return data;
  }

  async create(input: UsuarioInput): Promise<Usuario> {
    const { data, error } = await this.db().from(TABLE).insert(input).select(COLUMNS).single();
    if (error) throw toError(error);
    return data;
  }

  async update(id: number, input: UsuarioInput): Promise<Usuario> {
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

const MESSAGES: Record<string, string> = {
  '23503': 'No se puede eliminar: este usuario tiene ventas registradas',
  '23505': 'Ya existe un usuario con ese número telefónico',
  '23514': 'Algún dato no es válido (revisa el teléfono y el rol)',
};

const toError = (error: PostgrestError): Error => toDbError(error, MESSAGES);
