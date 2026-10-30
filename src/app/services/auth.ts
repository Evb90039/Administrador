import { Injectable, inject, signal } from '@angular/core';
import { User } from '@supabase/supabase-js';
import { Supabase } from './supabase';

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly supabase = inject(Supabase);

  readonly user = signal<User | null>(null);

  async signIn(email: string, password: string): Promise<string | null> {
    const client = this.supabase.client;
    if (!client) return 'El cliente de autenticación no está disponible';

    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) return error.message;

    this.user.set(data.user);
    return null;
  }

  async signOut(): Promise<void> {
    await this.supabase.client?.auth.signOut();
    this.user.set(null);
  }

  async getSession() {
    const client = this.supabase.client;
    if (!client) return null;

    const { data } = await client.auth.getSession();
    this.user.set(data.session?.user ?? null);
    return data.session;
  }
}
