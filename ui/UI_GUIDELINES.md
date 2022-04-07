# UI principles and guidelines


# Pure Typescript

We complement EcmaScript with types defined with Typescript. It allows code completion and provides some level of checking at compilation time.

To write good pure typescript it is important to reasonabily separate business logics from the UI code.
Typically, we should not have business logics depends on CSS or UI libraries.


## Web components

Modern browsers support custom elements natively. We rely on `lit2`, a small wrapper above the standard.
To get started with it, see https://lit.dev/docs/getting-started/

To design good components it is important to:
- reduce the dependencies;
- think about the inputs and the outputs (attributes, properties, events, ...);
- avoid internal state;


## Reactive state

The base of modern application is the state, from which the whole UI is created. When the state evolves, the application is updated accordingly. We rely on `rxjs` for storing and the state and listening for changes.
Individual states are exposed as ES6 modules constants. See https://rxjs.dev/guide/overview for a quick start.
