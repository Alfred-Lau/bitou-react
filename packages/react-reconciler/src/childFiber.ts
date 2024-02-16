import { Key, Props, ReactElementType } from 'shared/ReactTypes';
import {
	FiberNode,
	createFiberFromElement,
	createFiberFromFragment,
	createWorkInProgress
} from './fiber';
import { REACT_ELEMENT_TYPE, REACT_FRAGMENT_TYPE } from 'shared/ReactSymbols';
import { Fragment, HostText } from './workTags';
import { ChildDeletion, Placement } from './fiberFlags';

type ExistingChildren = Map<string | number, FiberNode>;

function ChildReconciler(shouldTrackEffects: boolean) {
	function deleteChild(returnFiber: FiberNode, childToDelete: FiberNode) {
		if (!shouldTrackEffects) {
			// 不追踪副作用
			return;
		}
		// 追踪副作用
		const deletions = returnFiber.deletions;
		if (deletions === null) {
			// 接入第一个要被删除的节点
			returnFiber.deletions = [childToDelete];
			returnFiber.flags |= ChildDeletion;
		} else {
			// 接入要被删除的节点
			deletions.push(childToDelete);
		}
	}

	function deleteRemainingChildren(
		returnFiber: FiberNode,
		currentFirstChild: FiberNode | null
	) {
		if (!shouldTrackEffects) {
			// 不追踪副作用
			return;
		}
		// 追踪副作用
		let childToDelete = currentFirstChild;
		while (childToDelete !== null) {
			deleteChild(returnFiber, childToDelete);
			childToDelete = childToDelete.sibling;
		}
	}

	// 单一元素
	function reconcileSingleElement(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		element: ReactElementType
	) {
		const key = element.key;
		while (currentFiber !== null) {
			// update
			if (currentFiber.key === key) {
				// key 相同
				if (element.$$typeof === REACT_ELEMENT_TYPE) {
					if (currentFiber.type === element.type) {
						let props = element.props;
						if (element.type === REACT_FRAGMENT_TYPE) {
							// 处理 fragment
							props = element.props.children;
						}
						// type 相同
						const existing = useFiber(currentFiber, props);
						existing.return = returnFiber;
						// 当前节点可复用，剩下节点要删除
						deleteRemainingChildren(returnFiber, currentFiber.sibling);
						return existing;
					}
					//key相同， type 不同,删除所有旧的
					deleteRemainingChildren(returnFiber, currentFiber);
					break;
				} else {
					if (__DEV__) {
						console.warn('reconcilerChildFibers: 未知的 child 类型', element);
						break;
					}
				}
			} else {
				// key 不同,删除
				deleteChild(returnFiber, currentFiber);
				currentFiber = currentFiber.sibling;
			}
		}

		let fiber;
		if (element.type === REACT_FRAGMENT_TYPE) {
			fiber = createFiberFromFragment(element.props.children, key);
		} else {
			fiber = createFiberFromElement(element);
		}
		fiber!.return = returnFiber;
		return fiber;
	}

	// 单一节点
	function reconcileSingleTextNode(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		content: string | number
	) {
		while (currentFiber !== null) {
			// update flow
			if (currentFiber.tag === HostText) {
				// 类型没有变，可以复用
				const existing = useFiber(currentFiber, { content });
				existing.return = returnFiber;
				deleteRemainingChildren(returnFiber, currentFiber.sibling);
				return existing;
			}
			deleteChild(returnFiber, currentFiber);
			currentFiber = currentFiber.sibling;
		}
		// 都不能复用，创建新的 fiber
		const fiber = new FiberNode(HostText, { content }, null);
		fiber.return = returnFiber;
		return fiber;
	}

	function placeSingleChild(fiber: FiberNode) {
		if (shouldTrackEffects && fiber.alternative === null) {
			// 首屏渲染并且应该追踪副作用
			fiber.flags |= Placement;
		}

		return fiber;
	}

	// 处理多节点复用
	function reconcilerChildrenArray(
		returnFiber: FiberNode,
		currentFirstChild: FiberNode | null,
		newChild: any[]
	) {
		// 最后一个可复用fiber在current中的index
		let lastPlacedIndex = 0;
		// 创建的最后一个fiber
		let lastNewFiber: FiberNode | null = null;
		// 创建的第一个 fiber
		let firstNewFiber: FiberNode | null = null;

		// 1. 将 current 保存在 map 中
		const existingChildren: ExistingChildren = new Map();
		let current = currentFirstChild;

		// 遍历 current，将节点保存在 map 中
		while (current !== null) {
			const keyToUse = current.key !== null ? current.key : current.index;
			existingChildren.set(keyToUse, current);
			current = current.sibling;
		}

		for (let i = 0; i < newChild.length; i++) {
			// 2. 遍历 newChild，如果在 map 中找到对应的节点，证明可以复用，否则创建新的节点
			const after = newChild[i];
			const newFiber = updateFromMap(returnFiber, existingChildren, i, after);

			// falsy 的情况
			if (newFiber === null) {
				continue;
			}

			// 3. 标记移动还是插入
			newFiber.index = i;
			newFiber.return = returnFiber;

			if (lastNewFiber === null) {
				lastNewFiber = newFiber;
				firstNewFiber = newFiber;
			} else {
				lastNewFiber.sibling = newFiber;
				lastNewFiber = lastNewFiber.sibling;
			}

			if (!shouldTrackEffects) {
				continue;
			}

			const current = newFiber.alternative;
			if (current !== null) {
				const oldIndex = current.index;
				if (oldIndex < lastPlacedIndex) {
					// 移动
					newFiber.flags |= Placement;
					continue;
				} else {
					// 不移动
					lastPlacedIndex = oldIndex;
				}
			} else {
				// mount:插入
				newFiber.flags |= Placement;
			}
		}

		// 4. 标记Map剩余的节点为删除

		existingChildren.forEach((fiber) => {
			deleteChild(returnFiber, fiber);
		});

		// 返回第一个新的fiber
		return firstNewFiber;
	}

	function updateFromMap(
		returnFiber: FiberNode,
		existingChildren: ExistingChildren,
		index: number,
		element: any
	): FiberNode | null {
		const keyToUse = element.key !== null ? element.key : index;
		const before = existingChildren.get(keyToUse);

		// HostText
		if (typeof element === 'string' || typeof element === 'number') {
			if (before) {
				if (before.tag === HostText) {
					// 可以复用
					existingChildren.delete(keyToUse);
					return useFiber(before, { content: element + '' });
				}
			}
			return new FiberNode(HostText, { content: element + '' }, returnFiber);
		}

		// ReactElement
		if (typeof element === 'object' && element !== null) {
			switch (element.$$typeof) {
				case REACT_ELEMENT_TYPE:
					if (element.type === REACT_FRAGMENT_TYPE) {
						return updateFragment(
							returnFiber,
							before,
							element,
							keyToUse,
							existingChildren
						);
					}
					if (before) {
						if (before.type === element.type) {
							existingChildren.delete(keyToUse);
							return useFiber(before, element.props);
						}
					}
					return createFiberFromElement(element);

				default:
					break;
			}
		}

		//  数组类型
		if (Array.isArray(element)) {
			return updateFragment(
				returnFiber,
				before,
				element,
				keyToUse,
				existingChildren
			);
		}

		return null;
	}

	// 闭包的作用：1. 保存 shouldTrackEffects 的值；2. 保存 shouldTrackEffects 的值
	return function reconcilerChildFibers(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		newChild?: any
	) {
		const isUnkeyedTopLevelFragment =
			typeof newChild === 'object' &&
			newChild !== null &&
			newChild.type === REACT_FRAGMENT_TYPE &&
			newChild.key === null;

		if (isUnkeyedTopLevelFragment) {
			// <><div></div><div></div></>
			newChild = newChild?.props.children;
		}
		// 单节点的情况
		if (newChild !== null && typeof newChild === 'object') {
			// 多节点的情况 ul > li*3
			if (Array.isArray(newChild)) {
				return reconcilerChildrenArray(returnFiber, currentFiber, newChild);
			}
			switch (newChild?.$$typeof) {
				case REACT_ELEMENT_TYPE:
					return placeSingleChild(
						reconcileSingleElement(returnFiber, currentFiber, newChild)!
					);

				default:
					if (__DEV__) {
						console.warn('reconcilerChildFibers: 未知的 child 类型', newChild);
					}
					break;
			}
		}

		// host text
		if (typeof newChild === 'string' || typeof newChild === 'number') {
			return placeSingleChild(
				reconcileSingleTextNode(returnFiber, currentFiber, newChild)
			);
		}

		if (currentFiber !== null) {
			// 兜底删除
			deleteRemainingChildren(returnFiber, currentFiber);
		}

		if (__DEV__) {
			console.warn('reconcilerChildFibers: 未知的 child 类型', newChild);
		}

		return null;
	};
}

// 1. 从父节点的 alternate 中复用子节点
function useFiber(fiber: FiberNode, pendingProps: Props): FiberNode {
	const clone = createWorkInProgress(fiber, pendingProps);
	clone.index = 0;
	clone.sibling = null;
	return clone;
}

function updateFragment(
	returnFiber: FiberNode,
	current: FiberNode | undefined,
	elements: any[],
	key: Key,
	existingChildren: ExistingChildren
) {
	let fiber;
	if (!current || current.tag !== Fragment) {
		fiber = createFiberFromFragment(elements, key);
	} else {
		existingChildren.delete(key);
		fiber = useFiber(current, elements);
	}
	fiber!.return = returnFiber;
	return fiber;
}

// 追踪副作用
export const reconcilerChildFibers = ChildReconciler(true);
// 不追踪副作用
export const mountChildFibers = ChildReconciler(false);
