import { Props, ReactElementType } from 'shared/ReactTypes';
import {
	FiberNode,
	createFiberFromElement,
	createWorkInProgress
} from './fiber';
import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols';
import { HostText } from './workTags';
import { ChildDeletion, Placement } from './fiberFlags';

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

	// 闭包的作用：1. 保存 shouldTrackEffects 的值；2. 保存 shouldTrackEffects 的值
	return function reconcilerChildFibers(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		newChild?: ReactElementType
	) {
		function reconcileSingleElement(
			returnFiber: FiberNode,
			currentFiber: FiberNode | null,
			element: ReactElementType
		) {
			const key = element.key;
			work: if (currentFiber !== null) {
				// update
				if (currentFiber.key === key) {
					// key 相同
					if (element.$$typeof === REACT_ELEMENT_TYPE) {
						if (currentFiber.type === element.type) {
							// type 相同
							const existing = useFiber(currentFiber, element.props);
							existing.return = returnFiber;
							return existing;
						}
						//key相同， type 不同,删除
						deleteChild(returnFiber, currentFiber);
						break work;
					} else {
						if (__DEV__) {
							console.warn('reconcilerChildFibers: 未知的 child 类型', element);
							break work;
						}
					}
				} else {
					// key 不同,删除
					deleteChild(returnFiber, currentFiber);
				}
			}
			const fiber = createFiberFromElement(element);
			fiber.return = returnFiber;
			return fiber;
		}

		function reconcileSingleTextNode(
			returnFiber: FiberNode,
			currentFiber: FiberNode | null,
			content: string | number
		) {
			if (currentFiber !== null) {
				// update flow
				if (currentFiber.tag === HostText) {
					// 类型没有变，可以复用
					const existing = useFiber(currentFiber, { content });
					existing.return = returnFiber;
					return existing;
				}
				deleteChild(returnFiber, currentFiber);
			}
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

		// 单节点的情况
		if (newChild !== null && typeof newChild === 'object') {
			switch (newChild?.$$typeof) {
				case REACT_ELEMENT_TYPE:
					return placeSingleChild(
						reconcileSingleElement(returnFiber, currentFiber, newChild)
					);

				default:
					if (__DEV__) {
						console.warn('reconcilerChildFibers: 未知的 child 类型', newChild);
					}
					break;
			}
		}
		// 多节点的情况 ul > li*3

		// host text
		if (typeof newChild === 'string' || typeof newChild === 'number') {
			return placeSingleChild(
				reconcileSingleTextNode(returnFiber, currentFiber, newChild)
			);
		}

		if (currentFiber !== null) {
			// 兜底删除
			deleteChild(returnFiber, currentFiber);
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

// 追踪副作用
export const reconcilerChildFibers = ChildReconciler(true);
// 不追踪副作用
export const mountChildFibers = ChildReconciler(false);
