import {
	Container,
	Instance,
	appendChildToContainer,
	commitUpdate,
	insertChildToContainer,
	removeChild
} from 'hostConfig';
import { FiberNode, FiberRootNode, PendingPassiveEffects } from './fiber';
import {
	ChildDeletion,
	Flags,
	LayoutMask,
	MutationMask,
	NoFlags,
	PassiveEffect,
	PassiveMask,
	Placement,
	Ref,
	Update
} from './fiberFlags';
import {
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText
} from './workTags';
import { Effect, FCUpdateQueue } from './fiberHooks';

let nextEffect: FiberNode | null = null;

const commitMutationEffectsOnFiber = (
	finishedWork: FiberNode,
	root?: FiberRootNode
) => {
	const { flags, tag } = finishedWork;
	// 处理 placement flag
	if ((flags & Placement) !== NoFlags) {
		commitPlacement(finishedWork);
		// 把 Placement 标记清除
		finishedWork.flags &= ~Placement;
	}

	// 处理 update flag
	if ((flags & Update) !== NoFlags) {
		commitUpdate(finishedWork);
		finishedWork.flags &= ~Update;
	}

	// 处理 deletion flag
	if ((flags & ChildDeletion) !== NoFlags) {
		const deletions = finishedWork.deletions;
		if (deletions !== null) {
			deletions.forEach((childToDelete) => {
				commitDeletion(childToDelete, root);
			});
		}
		finishedWork.flags &= ~ChildDeletion;
	}

	// 处理 passive effect flag
	if ((flags & PassiveEffect) !== NoFlags) {
		// 收集回调
		commitPassiveEffect(finishedWork, root, 'update');
		finishedWork.flags &= ~PassiveEffect;
	}

	// 处理 ref flag
	if ((flags & Ref) !== NoFlags && tag === HostComponent) {
		// 解绑旧的 ref
		safelyDetachRef(finishedWork);
	}
};

function safelyDetachRef(current: FiberNode) {
	const ref = current.ref;
	if (ref !== null) {
		if (typeof ref === 'function') {
			ref(null);
		} else {
			ref.current = null;
		}
	}
}

const commitLayoutEffectsOnFiber = (finishedWork: FiberNode) => {
	const { flags, tag } = finishedWork;
	// 处理 Ref flag
	if ((flags & Ref) !== NoFlags && tag === HostComponent) {
		// 绑定新的 ref
		safelyAttachRef(finishedWork);
		// 把 Ref 标记清除
		finishedWork.flags &= ~Ref;
	}
};

function safelyAttachRef(fiber: FiberNode) {
	const ref = fiber.ref;
	if (ref !== null) {
		const instance = fiber.stateNode;
		if (typeof ref === 'function') {
			// 函数类型的 ref
			ref(instance);
		} else {
			// 对象类型的 ref
			ref.current = instance;
		}
	}
}

function commitPassiveEffect(
	fiber: FiberNode,
	root: FiberRootNode,
	type: keyof PendingPassiveEffects
) {
	// update 或者 unmount
	if (
		fiber.tag !== FunctionComponent ||
		(type === 'update' && (fiber.flags & PassiveEffect) === NoFlags)
	) {
		return;
	}

	const updateQueue = fiber.updateQueue as FCUpdateQueue<any>;
	if (updateQueue !== null) {
		if (updateQueue.lastEffect === null && __DEV__) {
			console.error(
				'当 FC 存在 Passiveffect flag 时，不应该不存在 effect',
				fiber
			);
		}

		root.pendingPassiveEffects[type].push(updateQueue.lastEffect as Effect);
	}
}

function recordHostChildrenToDelete(
	childrenToDelete: FiberNode[],
	unmountFiber: FiberNode
) {
	// 1. 找到第一个 root host 节点
	const lastOne = childrenToDelete[childrenToDelete.length - 1];
	if (!lastOne) {
		childrenToDelete.push(unmountFiber);
	} else {
		let node = lastOne.sibling;
		while (node !== null) {
			{
				if (unmountFiber === node) {
					childrenToDelete.push(unmountFiber);
				}

				node = node.sibling;
			}
		}
	}
	// 2. 每找到一个host 节点，判断下这个节点是不是第一步中找到的那个节点的兄弟节点
}

function commitDeletion(childToDelete: FiberNode, root: FiberRootNode) {
	if (__DEV__) {
		console.log('commitDeletion', childToDelete);
	}

	const rootChildrenToDelete: FiberNode[] = [];

	// 递归子树
	commitNestedComponent(childToDelete, (unmountFiber: FiberNode) => {
		switch (unmountFiber.tag) {
			case HostComponent:
				recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);
				// todo:  解绑 ref
				safelyDetachRef(unmountFiber);
				return;

			case HostText:
				recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);
				// todo:  解绑 ref
				return;

			case FunctionComponent:
				commitPassiveEffect(unmountFiber, root, 'unmount');
				return;
			default:
				if (__DEV__) {
					console.warn('未处理的unmount 类型', unmountFiber);
				}
		}
	});

	// 移除 root hostcomponents的dom
	if (rootChildrenToDelete.length) {
		const hostParent = getHostParent(childToDelete);
		if (hostParent !== null) {
			rootChildrenToDelete.forEach((child) => {
				removeChild(child.stateNode, hostParent);
			});
		}
	}

	// 垃圾回收
	childToDelete.return = null;
	childToDelete.child = null;
}

/**
 *
 *
 * @param {*} root root fiber
 * @param {*} onCommitUnmount
 */
function commitNestedComponent(
	root: FiberNode,
	onCommitUnmount: (fiber: FiberNode) => void
) {
	let node = root;
	while (true) {
		// 深度优先遍历
		onCommitUnmount(node);
		if (node.child !== null) {
			// 向下遍历
			node.child.return = node;
			node = node.child;
			continue;
		}

		if (node === root) {
			// 终止条件
			return;
		}
		while (node.sibling === null) {
			if (node.return === null || node.return === root) {
				return;
			}
			// 向上遍历
			node = node.return;
		}

		node.sibling.return = node.return;
		node = node.sibling;
	}
}

function commitPlacement(finishedWork: FiberNode) {
	if (__DEV__) {
		console.log('commitPlacement', finishedWork);
	}
	// parent
	const hostParent = getHostParent(finishedWork);

	// host sibling
	const sibling = getHostSibling(finishedWork);

	// append child
	if (hostParent !== null) {
		insertOrAppendPlacementNodeIntoContainer(finishedWork, hostParent, sibling);
	}
}

function getHostSibling(fiber: FiberNode) {
	let node: FiberNode = fiber;

	findSibling: while (true) {
		// 向上遍历
		while (node.sibling === null) {
			const parent = node.return;
			if (
				parent === null ||
				parent.tag === HostComponent ||
				parent.tag === HostText
			) {
				return;
			}
			node = parent;
		}

		node.sibling.return = node.return;
		node = node.sibling;

		while (node.tag !== HostText && node.tag !== HostComponent) {
			// 向下遍历
			if ((node.flags & Placement) !== NoFlags) {
				continue findSibling;
			}

			if (node.child === null) {
				continue findSibling;
			} else {
				node.child.return = node;
				node = node.child;
			}
		}

		if ((node.flags & Placement) === NoFlags) {
			return node.stateNode;
		}
	}
}

function insertOrAppendPlacementNodeIntoContainer(
	finishedWork: FiberNode,
	hostParent: Container,
	before: Instance
) {
	if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
		if (before) {
			insertChildToContainer(finishedWork.stateNode, hostParent, before);
		} else {
			appendChildToContainer(hostParent, finishedWork.stateNode);
		}

		return;
	}

	const child = finishedWork.child;
	if (child !== null) {
		// 先 父 后 子
		insertOrAppendPlacementNodeIntoContainer(child, hostParent, before);
		let sibling = child.sibling;
		// 递归向下
		while (sibling !== null) {
			insertOrAppendPlacementNodeIntoContainer(sibling, hostParent, before);
			sibling = sibling.sibling;
		}
	}
}

// ts 类型检查不报错，不意味着rollup 打包没有问题
function getHostParent(fiber: FiberNode): Container | null {
	let parent = fiber.return;

	while (parent) {
		const parentTag = parent.tag;
		if (parentTag === HostComponent) {
			return parent.stateNode as Container;
		}

		if (parentTag === HostRoot) {
			return (parent.stateNode as FiberRootNode).container;
		}

		parent = parent.return;
	}

	if (__DEV__) {
		console.error('找不到父节点 ', fiber);
	}

	return null;
}

const commitEffects = (
	phrase: 'mutation' | 'layout',
	mask: Flags,
	callback: (fiber: FiberNode, root?: FiberRootNode) => void
) => {
	return (finishedWork: FiberNode, root: FiberRootNode) => {
		nextEffect = finishedWork;

		while (nextEffect !== null) {
			// 向下遍历
			const child: FiberNode | null = nextEffect.child;
			if ((nextEffect.subtreeFlags & mask) !== NoFlags && child !== null) {
				// 有副作用
				nextEffect = child;
			} else {
				// 向上遍历 DFS
				up: while (nextEffect !== null) {
					callback(nextEffect, root);
					const sibling: FiberNode | null = nextEffect.sibling;
					if (sibling !== null) {
						nextEffect = sibling;
						break up;
					}
					// 递归向上
					nextEffect = nextEffect.return;
				}
			}
		}
	};
};

export const commitMutationEffects = commitEffects(
	'mutation',
	MutationMask | PassiveMask,
	commitMutationEffectsOnFiber
);

export const commitLayoutEffects = commitEffects(
	'layout',
	LayoutMask,
	commitLayoutEffectsOnFiber
);
