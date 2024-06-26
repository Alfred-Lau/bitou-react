// dfs 递归中的归阶段

import {
  appendInitialChild,
  Container,
  createInstance,
  createTextInstance,
  Instance,
} from 'hostConfig';

import { FiberNode } from './fiber';
import { popProvider } from './fiberContext';
import {
  NoFlags,
  Ref,
  Update,
  Visibility,
} from './fiberFlags';
import { mergeLanes } from './fiberLanes';
import { popSuspenseHandler } from './SuspenseContext';
import {
  ContextProvider,
  Fragment,
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
  OffscreenComponent,
  SuspenseComponent,
} from './workTags';

// import { updateFiberProps } from 'react-dom/src/SyntheticEvent';

function markUpdate(fiber: FiberNode) {
	fiber.flags |= Update;
}

//
export const completeWork = (wip: FiberNode) => {
	//
	const newProps = wip.pendingProps;
	const current = wip.alternative;

	switch (wip.tag) {
		case HostComponent:
			if (current !== null && wip.stateNode) {
				// update
				// 判断 props 是否变化
				// FIXME: 这里只是简单的判断 props 是否变化，实际上还需要判断 props 的每一个属性是否变化
				markUpdate(wip);

				// 标记 ref
				if (current.ref !== wip.ref) {
					markRef(wip);
				}
				// updateFiberProps(wip.stateNode, newProps);
			} else {
				// 首屏渲染，构建离屏 dom
				// 1. 构建dom ； 2. 将 dom 插入到dom 树中
				const instance = createInstance(wip.type, newProps); // 宿主环境的实例
				appendAllChild(instance, wip);
				wip.stateNode = instance;

				// 标记 ref
				if (wip.ref !== null) {
					markRef(wip);
				}
			}
			bubbleProperties(wip);
			return null;
		case HostText:
			if (current !== null && wip.stateNode) {
				// update
				const oldText = current.memoizedProps.content;
				const newText = newProps.content;
				if (oldText !== newText) {
					//
					markUpdate(wip);
				}
			} else {
				// 首屏渲染，构建离屏 dom
				// 1. 构建dom ； 2. 将 dom 插入到dom 树中
				const instance = createTextInstance(newProps.content); // 宿主环境的实例
				wip.stateNode = instance;
			}
			bubbleProperties(wip);
			return null;
		case HostRoot:
		case Fragment:
		case FunctionComponent:
		case OffscreenComponent:
			bubbleProperties(wip);
			return null;
		case ContextProvider:
			popProvider(wip.type._context);
			bubbleProperties(wip);
			return null;
		case SuspenseComponent:
			// TODO:

			popSuspenseHandler();
			const offscreenFiber = wip.child as FiberNode;
			const isHidden = offscreenFiber.pendingProps!.mode === 'hidden';
			const currentOffscreenFiber = offscreenFiber.alternative;

			if (currentOffscreenFiber !== null) {
				// update
				const wasHidden = currentOffscreenFiber.pendingProps!.mode === 'hidden';
				if (wasHidden !== isHidden) {
					offscreenFiber.flags |= Visibility;
					bubbleProperties;
				}
			} else if (isHidden) {
				offscreenFiber.flags |= Visibility;
				bubbleProperties(offscreenFiber);
			}
			bubbleProperties(wip);
			return null;
		default:
			if (__DEV__) {
				console.warn('completeWork: 未知的 fiber tag', wip);
			}
			break;
	}
};

function appendAllChild(parent: Container | Instance, wip: FiberNode) {
	let node = wip.child;
	while (node !== null) {
		if (node.tag === HostComponent || node.tag === HostText) {
			appendInitialChild(parent, node?.stateNode);
		} else if (node.child !== null) {
			node.child.return = node;
			node = node.child;
			continue;
		}
		if (node === wip) {
			return;
		}

		while (node.sibling === null) {
			// 兄弟节点为空，回溯到父节点
			if (node.return === null || node.return === wip) {
				return;
			}
			// 回溯到父节点
			node = node.return;
		}

		node.sibling.return = node.return;
		node = node.sibling;
	}
}

// 递归向上冒泡 收集子节点和兄弟节点的副作用
function bubbleProperties(wip: FiberNode) {
	let subtreeFlags = NoFlags;
	let child = wip.child;

	let newChildLanes = NoFlags;

	while (child !== null) {
		subtreeFlags |= child.subtreeFlags;
		subtreeFlags |= child.flags;

		newChildLanes = mergeLanes(
			newChildLanes,
			mergeLanes(child.lanes, child.childLanes)
		);

		child.return = wip;
		child = child.sibling;
	}

	wip.subtreeFlags |= subtreeFlags;
	wip.childLanes = newChildLanes;
}

function markRef(fiber: FiberNode) {
	fiber.flags |= Ref;
}
