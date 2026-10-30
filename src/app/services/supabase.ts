import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class Supabase {
  private readonly platformId = inject(PLATFORM_ID);
  private instance: SupabaseClient | null = null;

  // En SSR no hay localStorage: el cliente solo se crea en el navegador.
  get client(): SupabaseClient | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    this.instance ??= createClient(environment.supabaseUrl, environment.supabaseAnonKey);
    return this.instance;
  }
}
