import { Dispatch, Dispatcher } from 'react/src/currentDispatcher';
import { FiberNode } from './fiber';
import internals from 'shared/internals';
import {
	UpdateQueue,
	createUpdate,
	createUpdateQueue,
	enqueueUpdate,
	processUpdateQueue
} from './updateQueue';
import { Action } from 'shared/ReactTypes';
import { scheduleUpdateOnFiber } from './workLoop';
import { Lane, NoLane, requestUpdateLane } from './fiberLanes';
import { Flags, PassiveEffect } from './fiberFlags';
import { HookHasEffect, Passsive } from './hookEffectTags';

let currentlyRenderingFiber: FiberNode | null = null;
let workInProgressHook: Hook | null = null;
let currentHook: Hook | null = null;
// 全局变量
let renderLane: Lane = NoLane;

const { currentDispatcher } = internals;
interface Hook {
	// useState 对应的是 state；useReducer 对应的是 reducer；useEffect 对应的是 effect；useLayoutEffect 对应的是 layoutEffect；useCallback 对应的是 callback；useMemo 对应的是 memo；useRef 对应的是 ref；useImperativeHandle 对应的是 imperativeHandle；useDebugValue 对应的是 debugValue
	memorizedState: any;
	updateQueue: unknown;
	next: Hook | null;
}

export interface Effect {
	tag: Flags;
	create: EffectCallback | void;
	destroy: EffectCallback | void;
	deps: EffectDeps;
	next: Effect | null;
}

export interface FCUpdateQueue<State> extends UpdateQueue<State> {
	lastEffect: Effect | null;
}

type EffectCallback = () => void;
type EffectDeps = any[] | null;

export function renderWithHooks(wip: FiberNode, lane: Lane) {
	// 赋值操作

	currentlyRenderingFiber = wip;
	// 重置hooks操作
	wip.memoizedState = null;
	// 重置Effect链表
	wip.updateQueue = null;
	renderLane = lane;

	const current = wip.alternative;

	if (current !== null) {
		// update:指向update 时候的hooks 实现
		currentDispatcher.current = HooksDispatcherOnUpdate;
	} else {
		// mount :指向mount 时候的hooks 实现
		currentDispatcher.current = HooksDispatcherOnMount;
	}
	const Component = wip.type;
	const props = wip.pendingProps;
	const children = Component(props);

	// 全局变量重置操作
	currentlyRenderingFiber = null;
	workInProgressHook = null;
	currentHook = null;
	renderLane = NoLane;
	return children;
}

const HooksDispatcherOnMount: Dispatcher = {
	useState: mountState,
	useEffect: mountEffect
};

const HooksDispatcherOnUpdate: Dispatcher = {
	useState: updateState,
	useEffect: updateEffect
};

function mountEffect(create: EffectCallback | void, deps: EffectDeps | void) {
	// 1. 找到当前 useEffect 对应的 hook数据
	const hook = mountWorkInProgressHook();
	const nextDeps = deps === undefined ? null : deps;
	(currentlyRenderingFiber as FiberNode).flags |= PassiveEffect;

	// Passsive 和 PasssiveEffect 的区别是：
	hook.memorizedState = pushEffect(
		Passsive | HookHasEffect,
		create,
		undefined,
		nextDeps
	);
}

function updateEffect(create: EffectCallback | void, deps: EffectDeps | void) {
	// 1. 找到当前 useEffect 对应的 hook数据
	const hook = updateWorkInProgressHook();
	const nextDeps = deps === undefined ? null : deps;
	let destory: EffectCallback | void;

	if (currentHook !== null) {
		const prevEffect = currentHook.memorizedState as Effect;
		destory = prevEffect.destroy;

		if (nextDeps !== null) {
			// 浅比较依赖
			const prevDeps = prevEffect.deps;
			if (areHookInputsEqual(nextDeps, prevDeps)) {
				hook.memorizedState = pushEffect(Passsive, create, destory, nextDeps);
				return;
			}
		}

		// 依赖变化，执行销毁操作
		(currentlyRenderingFiber as FiberNode).flags |= PassiveEffect;

		hook.memorizedState = pushEffect(
			Passsive | HookHasEffect,
			create,
			destory,
			nextDeps
		);
	}
}

function areHookInputsEqual(nextDeps: EffectDeps, prevDeps: EffectDeps) {
	if (prevDeps === null || nextDeps === null) {
		return false;
	}
	for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
		if (Object.is(prevDeps[i], nextDeps[i])) {
			continue;
		}

		return false;
	}

	return true;
}

function pushEffect(
	hookFlags: Flags,
	create: EffectCallback | void,
	destroy: EffectCallback | void,
	deps: EffectDeps
): Effect {
	const effect: Effect = {
		tag: hookFlags,
		create,
		destroy,
		deps,
		next: null
	};

	const fiber = currentlyRenderingFiber as FiberNode;
	const updateQueue = fiber.updateQueue as FCUpdateQueue<any>;
	if (updateQueue === null) {
		const updateQueue = createFCUpdateQueue();
		fiber.updateQueue = updateQueue;
		effect.next = effect;
		updateQueue.lastEffect = effect;
	} else {
		// 插入 Effect
		const lastEffect = updateQueue.lastEffect;
		if (lastEffect === null) {
			effect.next = effect;
			updateQueue.lastEffect = effect;
		} else {
			// 形成环状链表
			const firstEffect = lastEffect.next;
			lastEffect.next = effect;
			effect.next = firstEffect;
			updateQueue.lastEffect = effect;
		}
	}

	return effect;
}

function createFCUpdateQueue<State>() {
	const updateQueue = createUpdateQueue<State>() as FCUpdateQueue<State>;
	updateQueue.lastEffect = null;

	return updateQueue;
}

function updateState<State>(): [State, Dispatch<State>] {
	// 1. 找到当前 useState 对应的 hook数据
	const hook = updateWorkInProgressHook();

	// 2. 计算新的 state
	const queue = hook.updateQueue as UpdateQueue<State>;
	const pending = queue.shared.pending;
	// fix: update 被叠加的问题
	queue.shared.pending = null;

	if (pending !== null) {
		const { memoizedState } = processUpdateQueue(
			hook.memorizedState,
			pending,
			renderLane
		);
		hook.memorizedState = memoizedState;
	}

	return [hook.memorizedState, queue.dispatch as Dispatch<State>];
}

function mountState<State>(
	initialState: (() => State) | State
): [State, Dispatch<State>] {
	// 1. 找到当前 useState 对应的 hook数据
	const hook = mountWorkInProgressHook();

	let memoizedState = null;

	if (initialState instanceof Function) {
		memoizedState = initialState();
	} else {
		memoizedState = initialState;
	}

	const queue = createUpdateQueue<State>();
	hook.updateQueue = queue;
	// 2. 将当前 useState 对应的 hook数据的 memorizedState 指向 useState 的 initialState
	hook.memorizedState = memoizedState;

	// @ts-ignore
	const dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, queue);
	queue.dispatch = dispatch;
	return [memoizedState, dispatch];
}

function dispatchSetState<State>(
	fiber: FiberNode,
	updateQueue: UpdateQueue<State>,
	action: Action<State>
) {
	// 和 hostroot 首屏渲染流程类似，接入更新队列
	const lane = requestUpdateLane();
	const update = createUpdate(action, lane);
	enqueueUpdate(updateQueue, update);
	scheduleUpdateOnFiber(fiber, lane);
}

function mountWorkInProgressHook(): Hook {
	const hook: Hook = {
		memorizedState: null,
		updateQueue: null,
		next: null
	};

	if (workInProgressHook === null) {
		// mount && 第一个hook
		if (currentlyRenderingFiber === null) {
			// 规避在函数组件外部调用 hook
			throw new Error(
				'Hooks can only be called inside of the body of a function component.'
			);
		} else {
			workInProgressHook = hook;
			// mount de 第一个hook
			currentlyRenderingFiber.memoizedState = workInProgressHook;
		}
	} else {
		// mount && 不是第一个hook
		workInProgressHook.next = hook;
		workInProgressHook = hook;
	}

	return workInProgressHook;
}

function updateWorkInProgressHook(): Hook {
	// 1. 交互阶段触发的更新；2. render 过程中触发的更新
	let nextCurrentHook: Hook | null = null; //保存
	if (currentHook === null) {
		// fc update 的第一个hook
		const current = currentlyRenderingFiber?.alternative;
		if (current !== null) {
			// 1.1 交互阶段触发的更新
			nextCurrentHook = current?.memoizedState;
		} else {
			// 1.2 render 过程中触发的更新
			nextCurrentHook = null;
		}
	} else {
		// fc update 的非第一个hook
		nextCurrentHook = currentHook.next;
	}

	if (nextCurrentHook === null) {
		// 这个地方放置的是hooks 的数量不对应
		throw new Error(
			`组件${currentlyRenderingFiber?.type} Rendered more hooks than during the previous render.`
		);
	}

	currentHook = nextCurrentHook as Hook;

	const newHook: Hook = {
		memorizedState: currentHook.memorizedState,
		updateQueue: currentHook.updateQueue,
		next: null
	};

	if (workInProgressHook === null) {
		// mount && 第一个hook
		if (currentlyRenderingFiber === null) {
			// 规避在函数组件外部调用 hook
			throw new Error(
				'Hooks can only be called inside of the body of a function component.'
			);
		} else {
			workInProgressHook = newHook;
			// mount de 第一个hook
			currentlyRenderingFiber.memoizedState = workInProgressHook;
		}
	} else {
		// mount && 不是第一个hook
		workInProgressHook.next = newHook;
		workInProgressHook = newHook;
	}

	return workInProgressHook;
}
