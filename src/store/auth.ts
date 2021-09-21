import {BehaviorSubject} from 'rxjs';
import {AuthUser} from '../auth';

export default class AuthStore {
  static user = new BehaviorSubject<AuthUser | null>(null);

  static getUser(): BehaviorSubject<AuthUser | null> {
    return this.user;
  }

  static setUser(user: AuthUser | null): void {
    this.user.next(user);
  }
}
