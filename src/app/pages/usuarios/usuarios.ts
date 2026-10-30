import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ROLES, Rol, Usuario, UsuarioInput, UsuariosService } from '../../services/usuarios';
import { normalizePhone } from '../../shared/phone';
import { Loader } from '../../shared/loader/loader';

const ROL_STYLES: Record<Rol, { badge: string; avatar: string }> = {
  Admin: { badge: 'text-bg-primary', avatar: 'bg-primary-soft text-primary' },
  Usuario: { badge: 'text-bg-success', avatar: 'bg-success-soft text-success' },
  Invitado: { badge: 'text-bg-secondary', avatar: 'bg-info-soft text-info' },
};

const emptyForm = (): UsuarioInput => ({ nombre: '', telefono: '', rol: 'Usuario' });

@Component({
  imports: [FormsModule, Loader],
  selector: 'app-usuarios',
  styleUrl: './usuarios.css',
  templateUrl: './usuarios.html',
  host: { '(document:keydown.escape)': 'closeModals()' },
})
export class Usuarios implements OnInit {
  private readonly service = inject(UsuariosService);

  protected readonly roles = ROLES;
  protected readonly rolStyles = ROL_STYLES;

  protected readonly usuarios = signal<Usuario[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly formError = signal('');

  protected readonly modalOpen = signal(false);
  protected readonly editingId = signal<number | null>(null);
  protected readonly toDelete = signal<Usuario | null>(null);
  protected form = emptyForm();

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      this.usuarios.set(await this.service.list());
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  openCreate(): void {
    this.form = emptyForm();
    this.editingId.set(null);
    this.formError.set('');
    this.modalOpen.set(true);
  }

  openEdit(usuario: Usuario): void {
    const { id, ...data } = usuario;
    this.form = { ...data };
    this.editingId.set(id);
    this.formError.set('');
    this.modalOpen.set(true);
  }

  async save(f: NgForm): Promise<void> {
    if (f.invalid) return;

    this.saving.set(true);
    this.formError.set('');
    const data: UsuarioInput = {
      nombre: this.form.nombre.trim(),
      telefono: normalizePhone(this.form.telefono),
      rol: this.form.rol,
    };

    try {
      const id = this.editingId();
      if (id === null) {
        const created = await this.service.create(data);
        this.usuarios.update((list) => [...list, created]);
      } else {
        const updated = await this.service.update(id, data);
        this.usuarios.update((list) => list.map((u) => (u.id === id ? updated : u)));
      }
      this.modalOpen.set(false);
    } catch (e) {
      this.formError.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  async confirmDelete(): Promise<void> {
    const usuario = this.toDelete();
    if (!usuario) return;

    this.saving.set(true);
    try {
      await this.service.remove(usuario.id);
      this.usuarios.update((list) => list.filter((u) => u.id !== usuario.id));
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
      this.toDelete.set(null);
    }
  }

  closeModals(): void {
    if (this.saving()) return;
    this.modalOpen.set(false);
    this.toDelete.set(null);
  }

  protected initials(nombre: string): string {
    return nombre
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('');
  }
}
