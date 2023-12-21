// dfs 递归中的归阶段

import {
	appendInitialChild,
	createInstance,
	createTextInstance
} from 'hostConfig';
import { FiberNode } from './fiber';
import { HostComponent, HostRoot, HostText } from './workTags';
import { NoFlags } from './fiberFlags';

//
export const completeWork = (wip: FiberNode) => {
	//
	const newProps = wip.pendingProps;
	const current = wip.alternative;

	switch (wip.tag) {
		case HostComponent:
			if (current !== null && wip.stateNode) {
				// update
			} else {
				// 首屏渲染，构建离屏 dom
				// 1. 构建dom ； 2. 将 dom 插入到dom 树中
				const instance = createInstance(wip.type, newProps); // 宿主环境的实例
				appendAllChild(instance, wip);
				wip.stateNode = instance;
			}
			bubbleProperties(wip);
			return null;
		case HostText:
			if (current !== null && wip.stateNode) {
				// update
			} else {
				// 首屏渲染，构建离屏 dom
				// 1. 构建dom ； 2. 将 dom 插入到dom 树中
				const instance = createTextInstance(newProps.content); // 宿主环境的实例
				wip.stateNode = instance;
			}
			bubbleProperties(wip);
			return null;
		case HostRoot:
			bubbleProperties(wip);
			return null;

		default:
			if (__DEV__) {
				console.warn('completeWork: 未知的 fiber tag', wip);
			}
			break;
	}
};

function appendAllChild(parent: FiberNode, wip: FiberNode) {
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

	while (child !== null) {
		subtreeFlags |= child.subtreeFlags;
		subtreeFlags |= child.flags;

		child.return = wip;
		child = child.sibling;
	}

	wip.subtreeFlags |= subtreeFlags;
}
