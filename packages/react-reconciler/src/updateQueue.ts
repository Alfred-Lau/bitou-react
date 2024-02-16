import { Action } from 'shared/ReactTypes';
import { Update } from './fiberFlags';
import { Dispatch } from 'react/src/currentDispatcher';
import { Lane } from './fiberLanes';

export interface Update<State> {
	action: Action<State>;
	lane: Lane;
	next: Update<any> | null;
}

export interface UpdateQueue<State> {
	shared: {
		pending: Update<State> | null;
	};
	dispatch: Dispatch<State> | null;
}

export const createUpdate = <State>(
	action: Action<State>,
	lane: Lane
): Update<State> => {
	return {
		action,
		lane,
		next: null
	};
};

export const createUpdateQueue = <State>() => {
	return {
		shared: {
			pending: null
		},
		dispatch: null
	} as UpdateQueue<State>;
};

export const enqueueUpdate = <State>(
	updateQueue: UpdateQueue<State>,
	update: Update<State>
) => {
	// 调整支持批处理逻辑
	const pending = updateQueue.shared.pending;

	// 每插入一个新的 update，都会将其 next 指向 pending.next，然后将 pending.next 指向 update，这样就形成了一个环状链表，并且 pending.next 指向的是最新的 update
	if (pending === null) {
		update.next = update;
	} else {
		update.next = pending.next;
		pending.next = update;
	}

	updateQueue.shared.pending = update;
};

export const processUpdateQueue = <State>(
	baseState: State,
	pendingUpdate: Update<State> | null,
	renderLane: Lane
): { memoizedState: State } => {
	const result: ReturnType<typeof processUpdateQueue<State>> = {
		memoizedState: baseState
	};
	if (pendingUpdate !== null) {
		// 第一个 update
		const first = pendingUpdate.next;
		// TODO: pending 和 pendingUpdate 有什么区别？ pending 是一个环状链表，pendingUpdate 是一个链表
		let pending = pendingUpdate.next as Update<any>;

		do {
			const updateLane = pending.lane;
			if (updateLane === renderLane) {
				const action = pending.action;
				// 下面的判断不能使用 typeof action === 'function'，因为 action 可能是一个对象
				if (action instanceof Function) {
					baseState = action(baseState);
				} else {
					baseState = action;
				}
			} else {
				if (__DEV__) {
					console.log(
						'processUpdateQueue: 优先级不够，跳过更新,不应该进入',
						pending
					);
				}
			}
			// 从环状链表中取出下一个 update 进行遍历
			pending = pending.next as Update<any>;
		} while (pending !== first);
	}

	result.memoizedState = baseState;
	return result;
};
