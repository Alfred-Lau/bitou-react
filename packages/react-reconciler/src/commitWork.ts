import { FiberNode } from './fiber';
import { MutationMask, NoFlags, Placement } from './fiberFlags';

let nextEffect: FiberNode | null = null;

export const commitMutationEffects = (finishedWork: FiberNode) => {
	nextEffect = finishedWork;

	while (nextEffect !== null) {
		// 向下遍历
		const child: FiberNode | null = nextEffect.child;
		if (
			(nextEffect.subtreeFlags & MutationMask) !== NoFlags &&
			child !== null
		) {
			// 有副作用
			nextEffect = child;
		} else {
			// 向上遍历 DFS
			up: while (nextEffect !== null) {
				// xxx();
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

const commitMutationEffectsOnFiber = (finishedWork: FiberNode) => {
	const flags = finishedWork.flags;
	if (flags & Placement) {
		commitPlacement(finishedWork);
		// 把 Placement 标记清除
		finishedWork.flags &= ~Placement;
	}
};

function commitPlacement(finishedWork: FiberNode) {
	if (__DEV__) {
		console.log('commitPlacement', finishedWork);
	}
	// parent
	const parentFiber = finishedWork.return;
	const dom = finishedWork.stateNode;
}

function getHostParent(fiber: FiberNode) {
	let parent = fiber.return;

	while (parent) {
		const parentTag = parent.tag;
		if (parentTag) {
		}
	}
}
