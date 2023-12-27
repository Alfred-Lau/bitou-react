import { getPackageJson, resolvePkgPath, getBaseRollupPlugins } from './utils';
import generatePackageJson from 'rollup-plugin-generate-package-json';
import alias from '@rollup/plugin-alias';
const { name, module } = getPackageJson('react-dom');
// react-dom 包的路径
const pkgPath = resolvePkgPath(name);
const pagDistPath = resolvePkgPath(name, true);

export default [
	// react
	{
		input: `${pkgPath}/${module}`,
		output: [
			{
				file: `${pagDistPath}/index.js`,
				name: 'index.js',
				sourcemap: true,
				format: 'umd'
			},
			// 兼容 react18 react-dom/client
			{
				file: `${pagDistPath}/client.js`,
				name: 'client.js',
				sourcemap: true,
				format: 'umd'
			}
		],
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
	}
];
