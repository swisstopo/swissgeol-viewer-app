# karma-longest-reporter
A Karma plugin to report which specs take the longest.

## Why
Some of your specs are taking a long time and you want to know which ones.

## Usage
Just install this module and add 'longest' to the reporters array in your Karma config.
```
    ...
    reporters: [ 'progress', 'coverage', 'longest' ],
    ...
```

## Options
By default, this plugin prints the 10 longest specs. You can change that number by setting longestSpecsToReport in your Karma config.

## Alternatives
The built-in Karma base reporter can warn about specs that take longer a given amount of time. You can use this by adding 'base' to the reporters array and setting reportSlowerThan to a amount of time in your Karma config.
