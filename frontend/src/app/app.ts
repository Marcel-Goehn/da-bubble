import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Toaster } from './core/errors/toaster';

@Component({
  imports: [RouterOutlet, Toaster],
  selector: 'app-root',
  templateUrl: './app.html',
})
export class App {}
