import { Component, computed, input, model } from '@angular/core';

// Paginación del lado del cliente. Uso:
// <app-paginator [total]="lista().length" [(page)]="page" [(pageSize)]="pageSize" />
@Component({
  selector: 'app-paginator',
  templateUrl: './paginator.html',
  styleUrl: './paginator.css',
})
export class Paginator {
  readonly total = input.required<number>();
  readonly page = model(1);
  readonly pageSize = model(10);
  readonly pageSizes = input<number[]>([8, 15, 30]);

  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
  protected readonly current = computed(() => Math.min(this.page(), this.totalPages()));
  protected readonly from = computed(() => (this.total() ? (this.current() - 1) * this.pageSize() + 1 : 0));
  protected readonly to = computed(() => Math.min(this.current() * this.pageSize(), this.total()));

  // Números visibles: 1 … 4 5 6 … 12 (null = puntos suspensivos).
  protected readonly pages = computed<(number | null)[]>(() => {
    const total = this.totalPages();
    const cur = this.current();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const start = Math.max(2, Math.min(cur - 1, total - 4));
    const end = Math.min(total - 1, Math.max(cur + 1, 5));
    return [
      1,
      ...(start > 2 ? [null] : []),
      ...Array.from({ length: end - start + 1 }, (_, i) => start + i),
      ...(end < total - 1 ? [null] : []),
      total,
    ];
  });

  goTo(p: number): void {
    this.page.set(Math.min(Math.max(1, p), this.totalPages()));
  }

  changeSize(value: string): void {
    const first = this.from();
    this.pageSize.set(Number(value));
    // Mantiene visible el primer elemento que se estaba viendo.
    this.page.set(Math.max(1, Math.ceil(first / Number(value))));
  }
}
