import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  forwardRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface SelectOption<T> {
  value: T;
  label: string;
}

// Compara sin acentos ni mayúsculas: "electronica" encuentra "Electrónica".
const normalize = (s: string): string =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

let nextId = 0;

@Component({
  selector: 'app-search-select',
  templateUrl: './search-select.html',
  styleUrl: './search-select.css',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SearchSelect), multi: true },
  ],
  // pointerdown (no click): los modales detienen la propagación del click.
  host: { '(document:pointerdown)': 'onDocumentPointerDown($event)' },
})
export class SearchSelect<T> implements ControlValueAccessor {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly options = input<SelectOption<T>[]>([]);
  readonly placeholder = input('Selecciona una opción');
  readonly searchPlaceholder = input('Buscar…');
  readonly inputId = input(`search-select-${nextId++}`);

  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('search');
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly list = viewChild<ElementRef<HTMLElement>>('list');

  protected readonly value = signal<T | null>(null);
  protected readonly open = signal(false);
  protected readonly dropUp = signal(false);
  protected readonly query = signal('');
  protected readonly active = signal(0);
  protected readonly disabled = signal(false);

  protected readonly selected = computed(
    () => this.options().find((o) => o.value === this.value()) ?? null,
  );
  protected readonly filtered = computed(() => {
    const q = normalize(this.query());
    return q ? this.options().filter((o) => normalize(o.label).includes(q)) : this.options();
  });

  private onChange: (value: T | null) => void = () => {};
  private onTouched: () => void = () => {};

  toggle(): void {
    if (this.open()) {
      this.close();
      return;
    }
    if (this.disabled()) return;

    // Si no hay espacio abajo, el panel se abre hacia arriba.
    const rect = this.host.nativeElement.getBoundingClientRect();
    this.dropUp.set(window.innerHeight - rect.bottom < 300 && rect.top > 300);

    this.query.set('');
    const index = this.filtered().findIndex((o) => o.value === this.value());
    this.active.set(Math.max(index, 0));
    this.open.set(true);

    afterNextRender(
      () => {
        this.searchInput()?.nativeElement.focus();
        this.scrollActiveIntoView();
      },
      { injector: this.injector },
    );
  }

  close(focusTrigger = false): void {
    if (!this.open()) return;
    this.open.set(false);
    this.onTouched();
    if (focusTrigger) this.trigger().nativeElement.focus();
  }

  select(option: SelectOption<T>): void {
    this.value.set(option.value);
    this.onChange(option.value);
    this.close(true);
  }

  onSearch(value: string): void {
    this.query.set(value);
    this.active.set(0);
  }

  onTriggerKeydown(event: KeyboardEvent): void {
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && !this.open()) {
      event.preventDefault();
      this.toggle();
    }
  }

  onSearchKeydown(event: KeyboardEvent): void {
    const total = this.filtered().length;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        event.preventDefault();
        if (!total) return;
        this.active.update((i) => (i + (event.key === 'ArrowDown' ? 1 : -1) + total) % total);
        afterNextRender(() => this.scrollActiveIntoView(), { injector: this.injector });
        break;
      case 'Enter':
        // Evita que Enter envíe el formulario del modal.
        event.preventDefault();
        if (total) this.select(this.filtered()[this.active()]);
        break;
      case 'Escape':
        // Cierra solo el panel, no el modal.
        event.preventDefault();
        event.stopPropagation();
        this.close(true);
        break;
      case 'Tab':
        this.close();
        break;
    }
  }

  onDocumentPointerDown(event: PointerEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.close();
  }

  private scrollActiveIntoView(): void {
    this.list()?.nativeElement.querySelector('.active')?.scrollIntoView({ block: 'nearest' });
  }

  writeValue(value: T | null): void {
    this.value.set(value ?? null);
  }

  registerOnChange(fn: (value: T | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }
}
