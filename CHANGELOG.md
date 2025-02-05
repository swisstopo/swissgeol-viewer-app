# Changelog

## [1.0.0]

### Added
- Add `PG_SSL_MODE` environment variable to allow SSL connections between the API and database.

- The application's frontend is now built on [Vite](https://vite.dev/),
  enabling faster development and easier configuration.

- The application's deployment, including Kubernetes configuration,
  is now managed via GitHub Actions.


### Changed
- Values for "Height", "Angle", "Pitch", and coordinates are now input fields. Users can adjust values using arrow keys.

- The range for height has been increased to 700'000m.

- Config is loaded from the frontend at runtime now.

- The main search input now supports selection of results
  via direct enter, as well as keyboard navigation.

- The header and side navigation has been updated to the new design.

- The layers sidebar has been updated to the new design.
  Some parts of it, namely the catalog and the selected layers,
  have been left in the old design and will be changed
  in an upcoming release. 

- The disclaimer has been changed to a required, blocking pop-up.

### Fixed
