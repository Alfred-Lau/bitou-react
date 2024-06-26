import ReactCurrentBatchConfig from 'react/src/currentBatchConfig';
import {
  unstable_getCurrentPriorityLevel,
  unstable_IdlePriority,
  unstable_ImmediatePriority,
  unstable_NormalPriority,
  unstable_UserBlockingPriority,
} from 'scheduler';

import { FiberRootNode } from './fiber';

export type Lane = number;
export type Lanes = number;

// 非0情况下，数越小，优先级越高
export const NoLane = /*               */ 0b00000;
export const NoLanes = /*               */ 0b00000;
export const SyncLane = /*              */ 0b00001;
export const InputContinuousLane = /*  连续触发的事件 */ 0b00010;
export const DefaultLane = /*           */ 0b00100;
export const TransitionLane = /*        */ 0b01000;
export const IdleLane = /*              */ 0b10000;

// 优先级相关的 lane
export function mergeLanes(a: Lane, b: Lane): Lanes {
	return a | b;
}

export function requestUpdateLane(): Lane {
	const isTransition = ReactCurrentBatchConfig.transition !== null;

	if (isTransition) {
		return TransitionLane;
	}

	// 从上下文中获取当前的 scheduler 优先级
	const currentSchedulerPriority = unstable_getCurrentPriorityLevel();
	const lane = schedulerPriorityToLane(currentSchedulerPriority);
	return lane;
}

export function getHighestPriorityLane(Lanes: Lanes): Lane {
	// 能够返回最右侧一位的值，也就是最高优先级的 lane【大于0的lane 中，数越小，优先级越高】
	return Lanes & -Lanes;
}

// 判断优先级是否足够：一个 Lane 是否在 Lanes 中
export function isSubsetOfLanes(set: Lanes, subset: Lane): boolean {
	return (set & subset) === subset;
}

export function markRootFinished(root: FiberRootNode, lane: Lane) {
	root.pendingLanes &= ~lane;
	root.suspendedLanes = NoLanes;
	root.pingedLanes = NoLanes;
}

// lane 转换为 scheduler 的优先级
export function lanesToSchedulerPriority(lanes: Lanes) {
	const lane = getHighestPriorityLane(lanes);

	if (lane === SyncLane) {
		return unstable_ImmediatePriority;
	}

	if (lane === InputContinuousLane) {
		return unstable_UserBlockingPriority;
	}

	if (lane === DefaultLane) {
		return unstable_NormalPriority;
	}

	return unstable_IdlePriority;
}

// scheduler 的优先级转换为 lane
export function schedulerPriorityToLane(schedulerPriority: number): Lane {
	if (schedulerPriority === unstable_ImmediatePriority) {
		return SyncLane;
	}

	if (schedulerPriority === unstable_UserBlockingPriority) {
		return InputContinuousLane;
	}

	if (schedulerPriority === unstable_NormalPriority) {
		return DefaultLane;
	}

	return NoLane;
}

export function markRootSuspended(root: FiberRootNode, suspendedLane: Lane) {
	root.suspendedLanes |= suspendedLane;
	root.pingedLanes &= ~suspendedLane;
}

export function markRootPinged(root: FiberRootNode, pingedLane: Lane) {
	root.pingedLanes |= root.suspendedLanes & pingedLane;
}

export function getNextLane(root: FiberRootNode): Lane {
	const pendingLanes = root.pendingLanes;

	if (pendingLanes !== NoLanes) {
		return NoLane;
	}

	let nextLane = NoLane;

	const suspendedLanes = pendingLanes & ~root.suspendedLanes;

	if (suspendedLanes !== NoLanes) {
		nextLane = getHighestPriorityLane(suspendedLanes);
	} else {
		const pingedLanes = root.pingedLanes & pendingLanes;
		if (pingedLanes !== NoLanes) {
			nextLane = getHighestPriorityLane(pendingLanes);
		}
	}

	return nextLane;
}

export function includeSomeLanes(set: Lanes, subset: Lane | Lanes): boolean {
	return (set & subset) !== NoLanes;
}
