// ReactDOM.createRoot(root).render(<App />);

import {
	createContainer,
	updateContainer
} from 'react-reconciler/src/fiberReconciler';
import { Container } from './hostConfig';
import { ReactElementType } from 'shared/ReactTypes';
import { initEvent } from './SyntheticEvent';

export function createRoot(container: Container) {
	const root = createContainer(container);

	return {
		render(element: ReactElementType) {
			// container: 挂载在 container 上
			initEvent(container, 'click');
			return updateContainer(element, root);
		}
	};
}
