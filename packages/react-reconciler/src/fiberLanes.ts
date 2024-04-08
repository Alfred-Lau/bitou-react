import {
	unstable_IdlePriority,
	unstable_ImmediatePriority,
	unstable_NormalPriority,
	unstable_UserBlockingPriority,
	unstable_getCurrentPriorityLevel
} from 'scheduler';
import { FiberRootNode } from './fiber';

export type Lane = number;
export type Lanes = number;

// 非0情况下，数越小，优先级越高
export const SyncLane = /*              */ 0b0001;
export const NoLane = /*               */ 0b0000;
export const NoLanes = /*               */ 0b0000;
export const InputContinuousLane = /*  连续触发的事件 */ 0b0010;
export const DefaultLane = /*           */ 0b0100;
export const IdleLane = /*              */ 0b1000;

// 优先级相关的 lane
export function mergeLanes(a: Lane, b: Lane): Lanes {
	return a | b;
}

export function requestUpdateLane(): Lane {
	// 优先级相关的 lane
	const currentSchedulerPriority = unstable_getCurrentPriorityLevel();
	const lane = schedulerPriorityToLane(currentSchedulerPriority);
	return lane;
}

export function getHighestPriorityLane(Lanes: Lanes): Lane {
	// 能够返回最右侧一位的值，也就是最高优先级的 lane【大于0的lane 中，数越小，优先级越高】
	return Lanes & -Lanes;
}

export function markRootFinished(root: FiberRootNode, lane: Lane) {
	root.pendingLanes &= ~lane;
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
