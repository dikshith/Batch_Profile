import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-user-info',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-info.html',
  styleUrls: ['./user-info.scss'],
})
export class UserInfoComponent implements OnInit {
  userService = inject(UserService);

  // Tab selection
  selectedTab = signal<'info' | 'credentials' | 'create'>('info');

  // Form data for user creation
  createUsername = signal<string>('');
  createPassword = signal<string>('');
  createConfirmPassword = signal<string>('');
  createError = signal<string | null>(null);
  createSuccess = signal<string | null>(null);

  // Form data for credentials update
  newUsername = signal<string>('');
  newPassword = signal<string>('');
  confirmPassword = signal<string>('');

  // Local state
  credentialsError = signal<string | null>(null);
  credentialsSuccess = signal<string | null>(null);

  ngOnInit() {
    this.loadUserInfo();
  }

  setTab(tab: 'info' | 'credentials' | 'create') {
    this.selectedTab.set(tab);
    this.clearMessages();
  }

  async loadUserInfo() {
    await this.userService.loadCurrentUser();
  }

  async updateCredentials() {
    this.clearMessages();

    // Validate passwords match
    if (this.newPassword() !== this.confirmPassword()) {
      this.credentialsError.set('Passwords do not match');
      return;
    }

    // Validate form
    if (!this.isCredentialsFormValid()) {
      this.credentialsError.set('Please fill in all fields correctly');
      return;
    }

    const result = await this.userService.updateCredentials(
      this.newUsername(),
      this.newPassword()
    );

    if (result.success) {
      this.credentialsSuccess.set('Credentials updated successfully!');
      this.resetCredentialsForm();
    } else {
      this.credentialsError.set(result.error || 'Failed to update credentials');
    }
  }

  isCredentialsFormValid(): boolean {
    return !!(
      this.newUsername().trim() &&
      this.newPassword().trim() &&
      this.confirmPassword().trim() &&
      this.newPassword() === this.confirmPassword()
    );
  }

  resetCredentialsForm() {
    this.newUsername.set('');
    this.newPassword.set('');
    this.confirmPassword.set('');
  }

  clearMessages() {
    this.credentialsError.set(null);
    this.credentialsSuccess.set(null);
    this.createError.set(null);
    this.createSuccess.set(null);
    this.userService.clearError();
  }

  async createNewUser() {
    this.clearMessages();

    // Validate passwords match
    if (this.createPassword() !== this.createConfirmPassword()) {
      this.createError.set('Passwords do not match');
      return;
    }

    // Validate form
    if (!this.isCreateFormValid()) {
      this.createError.set('Please fill in all fields correctly');
      return;
    }

    try {
      const result = await this.userService.createUser(
        this.createUsername(),
        this.createPassword()
      );

      if (result) {
        this.createSuccess.set(result.message || 'User created successfully!');
        this.resetCreateForm();
      }
    } catch (error: any) {
      console.log(error);
      this.createError.set(error.error?.error || 'Failed to create user');
    }
  }

  isCreateFormValid(): boolean {
    return !!(
      this.createUsername().trim() &&
      this.createPassword().trim() &&
      this.createConfirmPassword().trim() &&
      this.createPassword() === this.createConfirmPassword()
    );
  }

  resetCreateForm() {
    this.createUsername.set('');
    this.createPassword.set('');
    this.createConfirmPassword.set('');
  }
}
