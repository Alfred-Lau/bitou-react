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
import { Lanes } from './fiberLanes';
import { Ref } from './fiberFlags';

export const beginWork = (fiber: FiberNode, renderLanes: Lanes) => {
	// 比较，返回子 FiberNode

	switch (fiber.tag) {
		case HostRoot:
			// 1. 计算状态的最新值；2. 返回子节点
			return updateHostRoot(fiber, renderLanes);
		case HostComponent:
			return updateHostComponent(fiber, renderLanes);
		case HostText:
			return null;
		case FunctionComponent:
			return updateFunctionComponent(fiber, renderLanes);
		case Fragment:
			return updateFragment(fiber, renderLanes);
		default:
			if (__DEV__) {
				console.warn('beginWork: 未知的 fiber tag', fiber.tag);
			}
	}

	return null;
};

function updateFragment(wip: FiberNode, renderLanes: Lanes) {
	const nextChildren = wip.pendingProps;
	reconcilerChildren(wip, nextChildren as any, renderLanes);
	return wip.child;
}

function updateFunctionComponent(wip: FiberNode, renderLanes: Lanes) {
	// 把 函数式组件 的执行结果作为子节点
	const nextChildren = renderWithHooks(wip, renderLanes);
	reconcilerChildren(wip, nextChildren, renderLanes);
	return wip.child;
}

function updateHostRoot(wip: FiberNode, renderLanes: Lanes) {
	const baseState = wip.memoizedState;
	const updateQueue = wip.updateQueue as UpdateQueue<Element>;
	const pending = updateQueue.shared.pending;
	updateQueue.shared.pending = null;
	const { memoizedState } = processUpdateQueue(baseState, pending, renderLanes);
	wip.memoizedState = memoizedState;

	const nextChildren = wip.memoizedState;
	reconcilerChildren(wip, nextChildren, renderLanes);
	return wip.child;
}

function updateHostComponent(wip: FiberNode, renderLanes: Lanes) {
	const nextProps = wip.pendingProps;
	const nextChildren = nextProps?.children;
	// 更新 ref
	markRef(wip.alternative, wip);
	reconcilerChildren(wip, nextChildren, renderLanes);

	return wip.child;
}

function reconcilerChildren(
	wip: FiberNode,
	children: ReactElementType,
	renderLanes: Lanes
) {
	const current = wip.alternative;
	if (current === null) {
		// mount: 不追踪副作用
		wip.child = mountChildFibers(wip, null, children, renderLanes);
	} else {
		// update
		wip.child = reconcilerChildFibers(
			wip,
			current.child,
			children,
			renderLanes
		);
	}
}

function markRef(current: FiberNode | null, wip: FiberNode) {
	const ref = wip.ref;
	if (
		(current === null && ref !== null) ||
		(current !== null && current.ref !== ref)
	) {
		wip.flags |= Ref;
	}
}
