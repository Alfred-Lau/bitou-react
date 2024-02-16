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

export function renderWithHooks(wip: FiberNode, lane: Lane) {
	// 赋值操作

	currentlyRenderingFiber = wip;
	// 重置操作
	wip.memoizedState = null;
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
	useState: mountState
};

const HooksDispatcherOnUpdate: Dispatcher = {
	useState: updateState
};

function updateState<State>(): [State, Dispatch<State>] {
	// 1. 找到当前 useState 对应的 hook数据
	const hook = updateWorkInProgressHook();

	// 2. 计算新的 state
	const queue = hook.updateQueue as UpdateQueue<State>;
	const pending = queue.shared.pending;

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
