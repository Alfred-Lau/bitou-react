import { getPackageJson, resolvePkgPath, getBaseRollupPlugins } from './utils';
import generatePackageJson from 'rollup-plugin-generate-package-json';
const { name, module } = getPackageJson('react');
// react 包的路径
const pkgPath = resolvePkgPath(name);
const pagDistPath = resolvePkgPath(name, true);

export default [
	// react
	{
		input: `${pkgPath}/${module}`,
		output: {
			file: `${pagDistPath}/index.js`,
			name: 'React',
			sourcemap: true,
			format: 'umd'
		},
		plugins: [
			...getBaseRollupPlugins(),
			generatePackageJson({
				inputFolder: pkgPath,
				outputFolder: pagDistPath,
				baseContents: ({ name, description, version }) => {
					return {
						name,
						description,
						version,
						main: 'index.js'
					};
				}
			})
		]
	},

	// jsx-runtime
	{
		input: `${pkgPath}/src/jsx.ts`,
		output: [
			{
				file: `${pagDistPath}/jsx-runtime.js`,
				name: 'jsx-runtime',
				sourcemap: true,

				format: 'umd'
			},
			{
				file: `${pagDistPath}/jsx-dev-runtime.js`,
				name: 'jsx-dev-runtime',
				sourcemap: true,

				format: 'umd'
			}
		],
		plugins: getBaseRollupPlugins()
	}
];
