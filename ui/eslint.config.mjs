import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import js from '@eslint/js';
import {FlatCompat} from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
});

const sharedConfig = {
    ignores: [
        'node_modules/**',
        'dist/**',
    ],
    languageOptions: {
        globals: globals.browser,
        ecmaVersion: 2018,
        sourceType: 'module',
        parser: tsParser,
    },
    rules: {
        'array-bracket-spacing': 'error',
        'comma-spacing': 'error',
        'eqeqeq': ['error', 'always', {'null': 'ignore'}],
        'key-spacing': 'error',
        'keyword-spacing': 'error',
        'no-duplicate-imports': 'off',
        'no-multi-spaces': 'error',
        'no-multiple-empty-lines': 'error',
        'no-trailing-spaces': 'error',
        'no-var': 'error',
        'object-curly-spacing': 'error',
        'object-shorthand': 'off',
        'prefer-arrow-callback': 'error',
        'prefer-const': 'error',

        quotes: ['error', 'single', {
            avoidEscape: true,
        }],

        semi: 'error',
        'space-before-blocks': 'error',
        'space-in-parens': 'error',
        'space-infix-ops': 'error',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-empty-function': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',

        '@typescript-eslint/no-unused-vars': ['error', {
            vars: 'all',
            varsIgnorePattern: '^_',
            args: 'after-used',
            argsIgnorePattern: '^_',
            caughtErrors: 'all',
            caughtErrorsIgnorePattern: '^_',
        }],

        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/ban-ts-comment': 'off',

        // TODO enable this. It is disabled because we haven't gotten to fixing its issues.
        '@typescript-eslint/no-unused-expressions': 'off',
    }
};

const baseConfigs = compat.extends(
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
).map((config) => ({
    ...config,
    ignores: sharedConfig.ignores,
    languageOptions: {
        globals: {
            ...globals.node,
        },
    },
}));

export default [
    {
        ignores: ['dist/**'],
    },
    ...baseConfigs.map((config) => ({
        ...config,
        ignores: [
            ...sharedConfig.ignores,
            'src/**',
            'cypress/**',
        ],
        languageOptions: {
            ...config.languageOptions,
            globals: {
                ...globals.node,
            },
        },
        rules: {
            ...config.rules,
            ...sharedConfig.rules,
        }
    })),
    ...baseConfigs.map((config) => ({
        ...config,
        files: ['src/**/*.ts', 'src/**/*.js'],
        ignores: [
            ...sharedConfig.ignores,
            'src/test/**',
        ],
        languageOptions: {
            ...config.languageOptions,
            globals: {
                ...globals.browser,
            },
        },
        rules: {
            ...config.rules,
            ...sharedConfig.rules,
        }
    })),
    ...baseConfigs.map((config) => ({
        ...config,
        files: ['src/test/**/*.ts', 'src/test/**/*.js'],
        languageOptions: {
            ...config.languageOptions,
            globals: {
                ...globals.mocha,
            },
        },
    })),
    {
        ...sharedConfig,
        files: ['src/**/*.ts', 'src/**/*.js'],
        languageOptions: {
            ...sharedConfig.languageOptions,
            parserOptions: {
                project: './tsconfig.json',
            },
        },
    },
    {
        ...sharedConfig,
        files: ['src/test/**/*.ts', 'src/test/**/*.js'],
        languageOptions: {
            ...sharedConfig.languageOptions,
            parserOptions: {
                project: './tsconfig.test.json',
            },
            globals: {
                ...globals.mocha,
            },
        },
    },
];