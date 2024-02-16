// dfs 递归中的递阶段
import { ReactElementType } from 'shared/ReactTypes';
import { FiberNode } from './fiber';
import { UpdateQueue, processUpdateQueue } from './updateQueue';
import {
	Fragment,
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText
} from './workTags';
import { mountChildFibers, reconcilerChildFibers } from './childFiber';
import { renderWithHooks } from './fiberHooks';
import { Lane } from './fiberLanes';

export const beginWork = (fiber: FiberNode, renderLane: Lane) => {
	// 比较，返回子 FiberNode

	switch (fiber.tag) {
		case HostRoot:
			// 1. 计算状态的最新值；2. 返回子节点
			return updateHostRoot(fiber, renderLane);
		case HostComponent:
			return updateHostComponent(fiber);
		case HostText:
			return null;
		case FunctionComponent:
			return updateFunctionComponent(fiber, renderLane);
		case Fragment:
			return updateFragment(fiber);
		default:
			if (__DEV__) {
				console.warn('beginWork: 未知的 fiber tag', fiber.tag);
			}
	}

	return null;
};

function updateFragment(wip: FiberNode) {
	const nextChildren = wip.pendingProps;
	reconcilerChildren(wip, nextChildren);
	return wip.child;
}

function updateFunctionComponent(wip: FiberNode, renderLane: Lane) {
	// 把 函数式组件 的执行结果作为子节点
	const nextChildren = renderWithHooks(wip, renderLane);
	reconcilerChildren(wip, nextChildren);
	return wip.child;
}

function updateHostRoot(wip: FiberNode, renderLane: Lane) {
	const baseState = wip.memoizedState;
	const updateQueue = wip.updateQueue as UpdateQueue<Element>;
	const pending = updateQueue.shared.pending;
	updateQueue.shared.pending = null;
	const { memoizedState } = processUpdateQueue(baseState, pending, renderLane);
	wip.memoizedState = memoizedState;

	const nextChildren = wip.memoizedState;
	reconcilerChildren(wip, nextChildren);
	return wip.child;
}

function updateHostComponent(wip: FiberNode) {
	const nextProps = wip.pendingProps;
	const nextChildren = nextProps.children;
	reconcilerChildren(wip, nextChildren);

	return wip.child;
}

function reconcilerChildren(wip: FiberNode, children: ReactElementType) {
	const current = wip.alternative;
	if (current === null) {
		// mount: 不追踪副作用
		wip.child = mountChildFibers(wip, null, children);
	} else {
		// update
		wip.child = reconcilerChildFibers(wip, current.child, children);
	}
}
