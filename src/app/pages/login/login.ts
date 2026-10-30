import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Auth } from '../../services/auth';

@Component({
  imports: [FormsModule],
  selector: 'app-login',
  styleUrl: './login.css',
  templateUrl: './login.html',
})
export class Login {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  protected email = '';
  protected password = '';
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal('');

  async onSubmit(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');

    const error = await this.auth.signIn(this.email, this.password);

    this.loading.set(false);

    if (error) {
      this.errorMessage.set(
        error === 'Invalid login credentials'
          ? 'Correo o contraseña incorrectos'
          : error,
      );
      return;
    }

    this.router.navigateByUrl('/dashboard');
  }
}
