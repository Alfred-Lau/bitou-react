let syncQueue: ((...args: any) => void)[] | null = null;

let isFlushingSyncQueue = false;

// 调度
export function scheduleSyncCallback(callback: (...args: any) => void) {
	if (syncQueue === null) {
		// 同步调度
		syncQueue = [callback];
	} else {
		syncQueue.push(callback);
	}
}

// 执行
export function flushSyncCallbacks() {
	if (!isFlushingSyncQueue && syncQueue) {
		isFlushingSyncQueue = true;

		try {
			syncQueue.forEach((callback) => {
				callback();
			});
		} catch (error) {
			if (__DEV__) {
				console.error(error);
			}
		} finally {
			isFlushingSyncQueue = false;
		}
	}
}
