module.exports = {
	env: {
		es6: true,
		jest: true,
	},
	extends: ['airbnb', 'prettier'],
	globals: {
		Atomics: 'readonly',
		SharedArrayBuffer: 'readonly',
		__DEV__: 'readonly',
		fetch: false,
	},
	parser: '@babel/eslint-parser',
	parserOptions: {
		ecmaFeatures: {
			jsx: true,
		},
		ecmaVersion: 2018,
		sourceType: 'module',
		requireConfigFile: false,
	},
	plugins: ['react', 'prettier'],
	rules: {
		'prettier/prettier': 'error',
		'react/jsx-filename-extension': [
			'off',
			{
				extensions: ['.jsx', '.js'],
			},
		],
		'import/prefer-default-export': 'off',
		'react/no-array-index-key': 'off',
		'react/state-in-constructor': 'off',
		'react/static-property-placement': 'off',
		'react/jsx-props-no-spreading': 'off',
		'no-param-reassign': 'off',
		'no-console': 'off',
		'no-underscore-dangle': ['error', {allowAfterThis: true}],
		'import/no-cycle': [
			'error',
			{
				maxDepth: 2,
				ignoreExternal: true,
			},
		],
		// Reglas para permitir funciones de flecha
		'func-style': 'off',
		'prefer-arrow-callback': 'off',
		'arrow-body-style': 'off',
		'prefer-const': 'error',
		'no-var': 'error',
		'consistent-return': 'error',
		// Reglas específicas para React
		'react/function-component-definition': [
			'error',
			{
				namedComponents: 'arrow-function',
				unnamedComponents: 'arrow-function',
			},
		],
		// Desactivar validaciones de PropTypes
		'react/prop-types': 'off',
		'react/require-default-props': 'off',
		'react/default-props-match-prop-types': 'off',
	},
	settings: {
		'import/resolver': {
			node: {},
		},
	},
};
