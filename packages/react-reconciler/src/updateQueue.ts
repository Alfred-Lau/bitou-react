import { Dispatch } from 'react/src/currentDispatcher';
import { Action } from 'shared/ReactTypes';

import { FiberNode } from './fiber';
import { Update } from './fiberFlags';
import {
  isSubsetOfLanes,
  Lane,
  mergeLanes,
  NoLane,
} from './fiberLanes';

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
	update: Update<State>,
	fiber: FiberNode,
	lane: Lane
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
	fiber.lanes = mergeLanes(fiber.lanes, lane);
	const alternative = fiber.alternative;
	if (alternative !== null) {
		// 为什么要更新 alternative 的 lanes？ 因为在 commit 阶段，会根据 lanes 来判断是否需要执行 effect
		alternative.lanes = mergeLanes(alternative.lanes, lane);
	}
};

export const processUpdateQueue = <State>(
	baseState: State,
	pendingUpdate: Update<State> | null,
	renderLane: Lane,
	onSkipUpdate?: <State>(update: Update<State>) => void
): {
	memoizedState: State;
	baseState: State;
	baseQueue: Update<State> | null;
} => {
	const result: ReturnType<typeof processUpdateQueue<State>> = {
		memoizedState: baseState,
		baseState: baseState,
		baseQueue: null
	};
	if (pendingUpdate !== null) {
		// 第一个 update
		const first = pendingUpdate.next;
		// TODO: pending 和 pendingUpdate 有什么区别？ pending 是一个环状链表，pendingUpdate 是一个链表
		let pending = pendingUpdate.next as Update<any>;

		let newBaseState = baseState;
		let newBaseQueueFirst: Update<State> | null = null;
		let newBaseQueueLast: Update<State> | null = null;
		let newState = baseState;

		do {
			const updateLane = pending.lane;
			if (!isSubsetOfLanes(renderLane, updateLane)) {
				// 优先级不够，跳过更新
				if (__DEV__) {
					console.log(
						'processUpdateQueue: 优先级不够，跳过更新,不应该进入',
						pending
					);
				}

				const clone = createUpdate(pending.action, pending.lane);

				onSkipUpdate?.(clone);
				// 是不是第一个被跳过的 update
				if (newBaseQueueFirst === null) {
					newBaseQueueFirst = clone;
					newBaseQueueLast = clone;
					newBaseState = newState;
					// clone.next = clone;
				} else {
					newBaseQueueLast!.next = clone;
					newBaseQueueLast = clone;
				}
			} else {
				if (newBaseQueueLast !== null) {
					const clone = createUpdate(pending.action, NoLane);
					newBaseQueueLast.next = clone;
					newBaseQueueLast = clone;
				}
				// 如果优先级足够，执行 action
				const action = pending.action;
				// 下面的判断不能使用 typeof action === 'function'，因为 action 可能是一个对象
				if (action instanceof Function) {
					newState = action(baseState);
				} else {
					newState = action;
				}
			}
			// 从环状链表中取出下一个 update 进行遍历
			pending = pending.next as Update<any>;
		} while (pending !== first);

		if (newBaseQueueLast === null) {
			// 表示本次计算没有update被跳过
			newBaseState = newState;
		} else {
			// 表示本次计算有update被跳过,需要将最后一个update的next指向第一个update，形成一个环状链表
			newBaseQueueLast.next = newBaseQueueFirst;
		}

		result.memoizedState = newState;
		result.baseState = newBaseState;
		result.baseQueue = newBaseQueueLast;
	}

	return result;
};
