import { getPackageJson, resolvePkgPath, getBaseRollupPlugins } from './utils';
import generatePackageJson from 'rollup-plugin-generate-package-json';
import alias from '@rollup/plugin-alias';
const { name, module, peerDependencies } = getPackageJson('react-dom');
// react-dom 包的路径
const pkgPath = resolvePkgPath(name);
const pagDistPath = resolvePkgPath(name, true);

export default [
	// react-dom
	{
		input: `${pkgPath}/${module}`,
		output: [
			{
				file: `${pagDistPath}/index.js`,
				name: 'ReactDOM',
				sourcemap: true,
				format: 'umd'
			},
			// 兼容 react18 react-dom/client
			{
				file: `${pagDistPath}/client.js`,
				name: 'client',
				sourcemap: true,
				format: 'umd'
			}
		],
		externals: [...Object.keys(peerDependencies)], // 外部依赖
		plugins: [
			...getBaseRollupPlugins(),
			alias({
				entries: [
					// { find: 'react', replacement: resolvePkgPath('react', true) },
					// { find: 'react-dom', replacement: resolvePkgPath('react-dom', true) }
					{ find: 'hostConfig', replacement: `${pkgPath}/src/hostConfig.ts` }
				]
			}),
			generatePackageJson({
				inputFolder: pkgPath,
				outputFolder: pagDistPath,
				baseContents: ({ name, description, version }) => {
					return {
						name,
						description,
						version,
						peerDependencies: {
							react: version
						},
						main: 'index.js'
					};
				}
			})
		]
	},
	// react-test-utils
	{
		input: `${pkgPath}/test-utils.ts`,
		output: [
			{
				file: `${pagDistPath}/test-utils.js`,
				name: 'testUtils',
				// sourcemap: true,
				format: 'umd'
			}
		],
		externals: ['react-dom', 'react'], // 外部依赖
		plugins: getBaseRollupPlugins()
	}
];
