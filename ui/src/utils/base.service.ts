import {Context, createContext} from '@lit/context';
const classToContext = new Map<typeof BaseService, ServiceContext<BaseService>>();

export type ServiceContext<T extends BaseService> = Context<AnyBaseServiceType<T>, T>;

export type AnyBaseServiceType<T extends BaseService = BaseService> = typeof BaseService & (new (...args: unknown[]) => T)


export abstract class BaseService {
  static context<T extends BaseService>(this: AnyBaseServiceType<T>): ServiceContext<T> {
    const existingContext = classToContext.get(this);
    if (existingContext != null) {
      return existingContext as ServiceContext<T>;
    }

    const context = createContext<T, typeof this>(this) as unknown as ServiceContext<T>;
    classToContext.set(this, context);
    return context;
  }
}
