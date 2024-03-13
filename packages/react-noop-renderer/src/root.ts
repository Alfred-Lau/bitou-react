import {
	createContainer,
	updateContainer
} from 'react-reconciler/src/fiberReconciler';
import { Container } from './hostConfig';
import { ReactElementType } from 'shared/ReactTypes';
import { Instance } from 'hostConfig';

let idCounter = 0;
export function createRoot() {
	const container: Container = {
		rootID: idCounter++,
		children: []
	};

	// @ts-ignore
	const root = createContainer(container);

	function getChildren(parent: Container | Instance) {
		if (parent) {
			return parent.children;
		}
		return null;
	}

	return {
		render(element: ReactElementType) {
			// container: 挂载在 container 上
			return updateContainer(element, root);
		},
		getChildren() {
			return getChildren(container);
		}
	};
}
