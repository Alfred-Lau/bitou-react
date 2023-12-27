import fs from 'fs';
import path from 'path';
import ts from 'rollup-plugin-typescript2';
import commonjs from '@rollup/plugin-commonjs';
import replace from '@rollup/plugin-replace';
const pkgPath = path.resolve(__dirname, '../../packages');
// 选用 node_modules 作为 dist 的根目录
const distPath = path.resolve(__dirname, '../../dist/node_modules');

function resolvePkgPath(pkgName, isDist) {
	if (isDist) {
		return `${distPath}/${pkgName}`;
	}
	return `${pkgPath}/${pkgName}`;
}

function getPackageJson(pkgName) {
	const path = `${resolvePkgPath(pkgName)}/package.json`;
	const str = fs.readFileSync(path, 'utf-8');
	return JSON.parse(str);
}

function getBaseRollupPlugins({
	typescript = {},
	alias = { __DEV__: true, preventAssignment: true }
} = {}) {
	return [replace(alias), commonjs(), ts(typescript)];
}

export { resolvePkgPath, getPackageJson, getBaseRollupPlugins };
