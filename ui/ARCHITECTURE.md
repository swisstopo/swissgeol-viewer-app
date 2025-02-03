# Architecture
The following details how to the UI's source code should be structured.
Many of these are not yet (fully) applied to the files,
but should serve as a general guideline on how to structure things
going forward.

- If possible, files are separated by feature under `src/features/{feature-name}`.
  > Note that currently, the `features` folder is still called `components`.
  
- Features are singular names. They represent general data types or categories,
  and group any functionality that deals with the same general concept.

- Files are prefixed by the type of their content, if applicable.
  Examples: `.component.ts`, `.service.ts`, `.model.ts`.

- Reusable things are saved in the `core` features.
  It contains the very foundation of the UI system,
  and should be thought as domain-independent.
  
- Domain-specific base types (e.g. an abstract base type, shared models)
  are to be stored in `src/{content}` (e.g. `src/services`, `src/models`).
  
