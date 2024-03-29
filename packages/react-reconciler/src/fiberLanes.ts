import { FiberRootNode } from './fiber';

export type Lane = number;
export type Lanes = number;

export const SyncLane = /*              */ 0b0001;
export const NoLane = /*               */ 0b0000;
export const NoLanes = /*               */ 0b0000;

// 优先级相关的 lane
export function mergeLanes(a: Lane, b: Lane): Lanes {
	return a | b;
}

export function requestUpdateLane(): Lane {
	// 优先级相关的 lane
	return SyncLane;
}

export function getHighestPriorityLane(Lanes: Lanes): Lane {
	// 能够返回最右侧一位的值，也就是最高优先级的 lane【大于0的lane 中，数越小，优先级越高】
	return Lanes & -Lanes;
}

export function markRootFinished(root: FiberRootNode, lane: Lane) {
	root.pendingLanes &= ~lane;
}
