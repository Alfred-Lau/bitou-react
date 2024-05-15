import { Container } from 'hostConfig';
import {
  unstable_ImmediatePriority,
  unstable_runWithPriority,
} from 'scheduler';
import { ReactElementType } from 'shared/ReactTypes';

import {
  FiberNode,
  FiberRootNode,
} from './fiber';
import { requestUpdateLane } from './fiberLanes';
import {
  createUpdate,
  createUpdateQueue,
  enqueueUpdate,
  UpdateQueue,
} from './updateQueue';
import { scheduleUpdateOnFiber } from './workLoop';
import { HostRoot } from './workTags';

export function createContainer(container: Container) {
	const hostRootFiber = new FiberNode(HostRoot, {}, null);
	const root = new FiberRootNode(container, hostRootFiber);
	hostRootFiber.updateQueue = createUpdateQueue();
	return root;
}

export function updateContainer(
	element: ReactElementType | null,
	root: FiberRootNode
) {
	// 首屏渲染同步执行
	unstable_runWithPriority(unstable_ImmediatePriority, () => {
		const hostRootFiber = root.current;
		const lane = requestUpdateLane();
		const update = createUpdate<ReactElementType | null>(element, lane);
		// 接入更新机制
		enqueueUpdate(
			hostRootFiber.updateQueue as UpdateQueue<ReactElementType | null>,
			update,
			hostRootFiber,
			lane
		);
		// 调度更新
		scheduleUpdateOnFiber(hostRootFiber, lane);
	});

	return element;
}
