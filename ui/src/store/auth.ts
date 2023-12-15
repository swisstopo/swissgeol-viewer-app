import {BehaviorSubject} from 'rxjs';
import type {AuthUser} from '../auth';

export default class AuthStore {
  private static userSubject = new BehaviorSubject<AuthUser | null>(null);

  static get user(): BehaviorSubject<AuthUser | null> {
    return this.userSubject;
  }

  static setUser(user: AuthUser | null): void {
    this.userSubject.next(user);
  }

  static get userEmail(): string | undefined {
    // FIXME: extract from claims
    return this.user?.value?.username.split('_')[1];
  }
}
