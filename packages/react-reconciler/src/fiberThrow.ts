import { Wakeable } from 'shared/ReactTypes';

import { FiberRootNode } from './fiber';
import { ShouldCapture } from './fiberFlags';
import { Lane, markRootPinged } from './fiberLanes';
import { getSuspenseHandler } from './SuspenseContext';
import { ensureRootIsScheduled, markRootUpdated } from './workLoop';

export function throwException(root: FiberRootNode, value: any, lane: Lane) {
	// Error buundary

	// thenable
	if (
		value !== null &&
		typeof value === 'object' &&
		typeof value.then === 'function'
	) {
		const wakeable: Wakeable<any> = value;

		const suspenseBoundry = getSuspenseHandler();
		if (suspenseBoundry) {
			suspenseBoundry.flags |= ShouldCapture;
		}
		attachPingListener(root, wakeable, lane);
	}
}

function attachPingListener(
	root: FiberRootNode,
	wakeable: Wakeable<any>,
	lane: Lane
) {
	// 为 wakeable 添加一个 ping 方法
	// wakeable.then(ping, ping);
	let pingCache = root.pingCache;

	let threadIDs: Set<Lane> | undefined;

	if (pingCache === null) {
		threadIDs = new Set<Lane>();
		pingCache = root.pingCache = new WeakMap<Wakeable<any>, Set<Lane>>();
		pingCache.set(wakeable, threadIDs);
	} else {
		threadIDs = pingCache.get(wakeable);
		if (threadIDs === undefined) {
			threadIDs = new Set<Lane>();
			pingCache.set(wakeable, threadIDs);
		}
	}

	function ping() {
		if (pingCache !== null) {
			pingCache.delete(wakeable);
		}

		markRootPinged(root, lane);
		markRootUpdated(root, lane);
		ensureRootIsScheduled(root);
	}

	if (!threadIDs.has(lane)) {
		threadIDs.add(lane);

		wakeable.then(ping, ping);
	}
}
