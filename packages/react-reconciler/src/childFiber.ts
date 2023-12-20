import { ReactElementType } from 'shared/ReactTypes';
import { FiberNode, createFiberFromElement } from './fiber';
import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols';
import { HostText } from './workTags';
import { Placement } from './fiberFlags';

function ChildReconciler(shouldTrackEffects: boolean) {
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
			const fiber = createFiberFromElement(element);
			fiber.return = returnFiber;
			return fiber;
		}

		function reconcileSingleTextNode(
			returnFiber: FiberNode,
			currentFiber: FiberNode | null,
			content: string | number
		) {
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

		if (__DEV__) {
			console.warn('reconcilerChildFibers: 未知的 child 类型', newChild);
		}

		return null;
	};
}

// 追踪副作用
export const reconcilerChildFibers = ChildReconciler(true);
// 不追踪副作用
export const mountChildFibers = ChildReconciler(false);
