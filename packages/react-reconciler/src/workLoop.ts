import { beginWork } from './beginWork';
import { FiberNode } from './fiber';

let workInProgress: FiberNode | null = null;

function renderRoot(root: FibderNode) {
	// 初始化
	prepareFreshStack(root);

	do {
		try {
			workLoop();
			break;
		} catch (e) {
			console.log(e);
		}
	} while (true);
}

function workLoop() {
	while (workInProgress === null) {
		performUnitOfWork(workInProgress);
	}
}

function performUnitOfWork(fiber: FiberNode) {
	const next = beginWork(fiber);
}

function preareFreshStack(fiber: FiberNode) {
	workInProgress = fiber;
}
