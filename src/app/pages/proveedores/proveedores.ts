import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Proveedor, ProveedorInput, ProveedoresService } from '../../services/proveedores';
import { Paginator } from '../../shared/paginator/paginator';
import { normalizePhone, whatsappUrl } from '../../shared/phone';
import { Loader } from '../../shared/loader/loader';

const emptyForm = (): ProveedorInput => ({ nombre: '', telefono: '' });

const normalize = (s: string): string =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

// Paleta para los avatares: el color depende del id, así cada proveedor conserva el suyo.
const AVATAR_COLORS = ['avatar-blue', 'avatar-green', 'avatar-amber', 'avatar-violet', 'avatar-rose', 'avatar-cyan'];

@Component({
  imports: [FormsModule, Paginator, Loader],
  selector: 'app-proveedores',
  styleUrl: './proveedores.css',
  templateUrl: './proveedores.html',
  host: { '(document:keydown.escape)': 'closeModals()' },
})
export class Proveedores implements OnInit {
  private readonly service = inject(ProveedoresService);

  protected readonly whatsappUrl = whatsappUrl;

  protected readonly proveedores = signal<Proveedor[]>([]);
  protected readonly busqueda = signal('');
  protected readonly filtrados = computed(() => {
    const q = normalize(this.busqueda());
    const qPhone = q.replace(/\D/g, '');
    return q
      ? this.proveedores().filter(
          (p) => normalize(p.nombre).includes(q) || (!!qPhone && p.telefono.includes(qPhone)),
        )
      : this.proveedores();
  });

  // ===== Paginación =====
  protected readonly page = signal(1);
  protected readonly pageSize = signal(8);
  protected readonly paginados = computed(() => {
    const size = this.pageSize();
    const totalPages = Math.max(1, Math.ceil(this.filtrados().length / size));
    // Si se borran elementos de la última página, se queda en la última que exista.
    const page = Math.min(this.page(), totalPages);
    return this.filtrados().slice((page - 1) * size, page * size);
  });

  buscar(value: string): void {
    this.busqueda.set(value);
    this.page.set(1);
  }

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly formError = signal('');

  protected readonly modalOpen = signal(false);
  protected readonly editingId = signal<number | null>(null);
  protected readonly toDelete = signal<Proveedor | null>(null);
  protected form = emptyForm();

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      this.proveedores.set(await this.service.list());
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

  openEdit(p: Proveedor): void {
    const { id, ...data } = p;
    this.form = { ...data };
    this.editingId.set(id);
    this.formError.set('');
    this.modalOpen.set(true);
  }

  async save(f: NgForm): Promise<void> {
    if (f.invalid) return;

    this.saving.set(true);
    this.formError.set('');
    const data: ProveedorInput = {
      nombre: this.form.nombre.trim(),
      telefono: normalizePhone(this.form.telefono),
    };

    try {
      const id = this.editingId();
      if (id === null) {
        const created = await this.service.create(data);
        this.proveedores.update((list) => [...list, created]);
        // Lleva a la última página para ver el proveedor recién creado.
        this.busqueda.set('');
        this.page.set(Math.ceil(this.proveedores().length / this.pageSize()));
      } else {
        const updated = await this.service.update(id, data);
        this.proveedores.update((list) => list.map((p) => (p.id === id ? updated : p)));
      }
      this.modalOpen.set(false);
    } catch (e) {
      this.formError.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  async confirmDelete(): Promise<void> {
    const proveedor = this.toDelete();
    if (!proveedor) return;

    this.saving.set(true);
    try {
      await this.service.remove(proveedor.id);
      this.proveedores.update((list) => list.filter((p) => p.id !== proveedor.id));
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
    const letters = nombre
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('');
    return letters || '?';
  }

  protected avatarColor(id: number): string {
    return AVATAR_COLORS[id % AVATAR_COLORS.length];
  }
}
