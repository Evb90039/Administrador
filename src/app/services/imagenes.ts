import { Injectable, inject } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { toDbError } from './db-error';
import { Supabase } from './supabase';

export interface ProductoImagen {
  id: number;
  producto_id: number;
  path: string;
  orden: number;
  url: string | null;
}

// Opciones de transformación on-the-fly de Supabase Storage.
// Requiere "Image Transformations" habilitado en el proyecto (plan Pro / self-hosted).
export interface ImagenTransform {
  width?: number;
  height?: number;
  resize?: 'cover' | 'contain' | 'fill';
  quality?: number;
}

const BUCKET = 'productos';
const TABLE = 'producto_imagenes';
const COLUMNS = 'id, producto_id, path, orden';

export const MAX_IMAGENES = 6;
export const MAX_IMAGEN_BYTES = 5 * 1024 * 1024;
const EXTENSIONES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
export const TIPOS_IMAGEN = Object.keys(EXTENSIONES);

const MESSAGES: Record<string, string> = {
  '42P01': 'Falta la tabla producto_imagenes (ejecuta imagenes.sql)',
  PGRST205: 'Falta la tabla producto_imagenes (ejecuta imagenes.sql)',
};

@Injectable({ providedIn: 'root' })
export class ImagenesService {
  private readonly supabase = inject(Supabase);

  async list(transform?: ImagenTransform): Promise<ProductoImagen[]> {
    const { data, error } = await this.db().from(TABLE).select(COLUMNS).order('orden');
    if (error) throw toDbError(error, MESSAGES);
    return this.withUrls(data, transform);
  }

  // Imágenes solo de los productos indicados (evita firmar enlaces que no se van a mostrar).
  // Si se pasa `transform`, Supabase sirve una versión redimensionada en WebP
  // (mucho más ligera que la original) via Image Transformations.
  async listFor(productoIds: number[], transform?: ImagenTransform): Promise<ProductoImagen[]> {
    if (!productoIds.length) return [];
    const { data, error } = await this.db()
      .from(TABLE)
      .select(COLUMNS)
      .in('producto_id', productoIds)
      .order('orden');
    if (error) throw toDbError(error, MESSAGES);
    return this.withUrls(data, transform);
  }

  async upload(productoId: number, files: File[], startOrden: number): Promise<ProductoImagen[]> {
    const db = this.db();
    const paths: string[] = [];
    try {
      for (const file of files) {
        const path = `${productoId}/${crypto.randomUUID()}.${EXTENSIONES[file.type] ?? 'img'}`;
        const { error } = await db.storage
          .from(BUCKET)
          // cacheControl de 1 año: los paths usan UUID único, nunca se reemplazan.
          .upload(path, file, { contentType: file.type, upsert: false, cacheControl: '31536000' });
        if (error) throw new Error(`No se pudo subir "${file.name}": ${error.message}`);
        paths.push(path);
      }

      const rows = paths.map((path, i) => ({ producto_id: productoId, path, orden: startOrden + i }));
      const { data, error } = await db.from(TABLE).insert(rows).select(COLUMNS);
      if (error) throw toDbError(error, MESSAGES);
      return this.withUrls(data);
    } catch (e) {
      // Si algo falla, no se dejan archivos sueltos en Storage.
      if (paths.length) await db.storage.from(BUCKET).remove(paths);
      throw e;
    }
  }

  async remove(imagenes: ProductoImagen[]): Promise<void> {
    if (!imagenes.length) return;
    const db = this.db();
    const { error } = await db.from(TABLE).delete().in('id', imagenes.map((i) => i.id));
    if (error) throw toDbError(error, MESSAGES);
    await this.removeFiles(imagenes.map((i) => i.path));
  }

  // Borra solo los archivos (las filas ya se eliminaron en cascada con el producto).
  async removeFiles(paths: string[]): Promise<void> {
    if (paths.length) await this.db().storage.from(BUCKET).remove(paths);
  }

  private async withUrls(
    rows: Omit<ProductoImagen, 'url'>[],
    transform?: ImagenTransform,
  ): Promise<ProductoImagen[]> {
    if (!rows.length) return [];
    const bucket = this.db().storage.from(BUCKET);

    // Bucket público: URLs estáticas, síncronas, cacheables por el navegador.
    // No requiere round-trip para firmar.
    return rows.map((r) => {
      const { data } = bucket.getPublicUrl(r.path, transform ? { transform } : undefined);
      return { ...r, url: data?.publicUrl ?? null };
    });
  }

  private db(): SupabaseClient {
    const client = this.supabase.client;
    if (!client) throw new Error('El cliente de Supabase no está disponible');
    return client;
  }
}
