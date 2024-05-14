// dfs 递归中的递阶段
import { ReactElementType } from 'shared/ReactTypes';

import { mountChildFibers, reconcilerChildFibers } from './childFiber';
import {
	createFiberFromFragment,
	createFiberFromOffscreen,
	createWorkInProgress,
	FiberNode,
	OffscreenProps
} from './fiber';
import { pushProvider } from './fiberContext';
import {
	ChildDeletion,
	DidCapture,
	NoFlags,
	Placement,
	Ref
} from './fiberFlags';
import { renderWithHooks } from './fiberHooks';
import { Lanes } from './fiberLanes';
import { pushSuspenseHandler } from './SuspenseContext';
import { processUpdateQueue, UpdateQueue } from './updateQueue';
import {
	ContextProvider,
	Fragment,
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText,
	OffscreenComponent,
	SuspenseComponent
} from './workTags';

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
		case ContextProvider:
			return updateContextProvider(fiber, renderLanes);
		case SuspenseComponent:
			return updateSuspenseComponent(fiber, renderLanes);
		case OffscreenComponent:
			return updateOffscreenComponent(fiber, renderLanes);
		default:
			if (__DEV__) {
				console.warn('beginWork: 未知的 fiber tag', fiber.tag);
			}
	}

	return null;
};

function updateSuspenseComponent(wip: FiberNode, renderLanes: Lanes) {
	const current = wip.alternative;
	const nextProps = wip.pendingProps;

	let showFallback = false;

	const didSuspend = (wip.flags & DidCapture) !== NoFlags;

	if (didSuspend) {
		showFallback = true;
		wip.flags &= ~DidCapture;
	}

	const nextPrimaryChildren = nextProps?.children;
	const nextFallbackChildren = nextProps?.fallback;

	pushSuspenseHandler(wip);

	if (current === null) {
		// mount
		if (showFallback) {
			// 挂起
			return mountSuspenseFallbackChildren(
				wip,
				nextPrimaryChildren,
				nextFallbackChildren
			);
		} else {
			// 正常
			return mountSuspensePrimaryChildren(wip, nextPrimaryChildren);
		}
	} else {
		// update
		if (showFallback) {
			// 挂起
			return updateSuspenseFallbackChildren(
				wip,
				nextPrimaryChildren,
				nextFallbackChildren
			);
		} else {
			// 正常
			return updateSuspensePrimaryChildren(wip, nextPrimaryChildren);
		}
	}
}

// visible -> hidden
function mountSuspenseFallbackChildren(
	wip: FiberNode,
	primaryChildren: any,
	fallbackChildren: any
) {
	const primaryChildProps: OffscreenProps = {
		mode: 'hidden',
		children: primaryChildren
	};

	const primaryChildFragment = createFiberFromOffscreen(primaryChildProps);
	const fallbackChildFragment = createFiberFromFragment(
		fallbackChildren,
		null,
		null
	);

	// 需要标记 Placement，因为 SuspenseComponent 的子节点是 OffscreenComponent, 触发 Placement
	fallbackChildFragment.flags |= Placement;

	primaryChildFragment.return = wip;
	fallbackChildFragment.return = wip;
	primaryChildFragment.sibling = fallbackChildFragment;
	wip.child = primaryChildFragment;

	return fallbackChildFragment;
}

function updateSuspensePrimaryChildren(wip: FiberNode, primaryChildren: any) {
	const current = wip.alternative as FiberNode;
	const currentPrimaryChildFragment = current.child as FiberNode;
	const currentFallbackChildFragment: FiberNode | null =
		currentPrimaryChildFragment.sibling;

	const primaryChildProps: OffscreenProps = {
		mode: 'visible',
		children: primaryChildren
	};

	const primaryChildFragment = createWorkInProgress(
		currentPrimaryChildFragment,
		primaryChildProps
	);

	primaryChildFragment.return = wip;
	primaryChildFragment.sibling = null;
	wip.child = primaryChildFragment;

	if (currentFallbackChildFragment !== null) {
		// 删除 fallback
		const deletions = wip.deletions;
		if (deletions === null) {
			wip.deletions = [currentFallbackChildFragment];
			wip.flags |= ChildDeletion;
		} else {
			deletions.push(currentFallbackChildFragment);
		}
	}

	return primaryChildFragment;
}

function updateSuspenseFallbackChildren(
	wip: FiberNode,
	primaryChildren: any,
	fallbackChildren: any
) {
	const current = wip.alternative as FiberNode;
	const currentPrimaryChildFragment = current.child as FiberNode;
	const currentFallbackChildFragment: FiberNode | null =
		currentPrimaryChildFragment.sibling;
	const primaryChildProps: OffscreenProps = {
		mode: 'hidden',
		children: primaryChildren
	};

	const primaryChildFragment = createWorkInProgress(
		currentPrimaryChildFragment,
		primaryChildProps
	);

	let fallbackChildFragment: FiberNode;

	if (currentFallbackChildFragment !== null) {
		fallbackChildFragment = createWorkInProgress(
			currentFallbackChildFragment,
			fallbackChildren
		);
	} else {
		fallbackChildFragment = createFiberFromFragment(
			fallbackChildren,
			null,
			null
		);
		fallbackChildFragment.flags |= Placement;
	}

	fallbackChildFragment.return = wip;
	primaryChildFragment.return = wip;
	primaryChildFragment.sibling = fallbackChildFragment;
	wip.child = primaryChildFragment;

	return fallbackChildFragment;
}

function mountSuspensePrimaryChildren(wip: FiberNode, primaryChildren: any) {
	const primaryChildProps: OffscreenProps = {
		mode: 'visible',
		children: primaryChildren
	};

	const primaryChildFragment = createFiberFromOffscreen(primaryChildProps);
	wip.child = primaryChildFragment;
	primaryChildFragment.return = wip;

	return primaryChildFragment;
}

function updateOffscreenComponent(wip: FiberNode, renderLanes: Lanes) {
	const nextProps = wip.pendingProps;
	const nextChildren = nextProps?.children;

	reconcilerChildren(wip, nextChildren, renderLanes);
	return wip.child;
}

function updateContextProvider(wip: FiberNode, renderLanes: Lanes) {
	const providerType = wip.type;
	const context = providerType._context;

	const nextProps = wip.pendingProps;

	//  更新 context 的 value
	pushProvider(context, nextProps?.value);

	const nextChildren = nextProps?.children;
	reconcilerChildren(wip, nextChildren, renderLanes);
	return wip.child;
}

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

	const current = wip.alternative;
	if (current !== null) {
		current.memoizedState = memoizedState;
	}
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
