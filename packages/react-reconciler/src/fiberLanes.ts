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
