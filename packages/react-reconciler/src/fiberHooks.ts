import { Dispatch, Dispatcher } from 'react/src/currentDispatcher';
import { FiberNode } from './fiber';
import internals from 'shared/internals';
import {
	UpdateQueue,
	createUpdate,
	createUpdateQueue,
	enqueueUpdate
} from './updateQueue';
import { Action } from 'shared/ReactTypes';
import { scheduleUpdateOnFiber } from './workLoop';

let currentlyRenderingFiber: FiberNode | null = null;
let workInProgressHook: Hook | null = null;

const { currentDispatcher } = internals;
interface Hook {
	// useState 对应的是 state；useReducer 对应的是 reducer；useEffect 对应的是 effect；useLayoutEffect 对应的是 layoutEffect；useCallback 对应的是 callback；useMemo 对应的是 memo；useRef 对应的是 ref；useImperativeHandle 对应的是 imperativeHandle；useDebugValue 对应的是 debugValue
	memorizedState: any;
	updateQueue: unknown;
	next: Hook | null;
}

export function renderWithHooks(wip: FiberNode) {
	// 赋值操作

	currentlyRenderingFiber = wip;
	// 重置操作
	wip.memoizedState = null;

	const current = wip.alternative;

	if (current !== null) {
		// update
	} else {
		// mount :指向mount 时候的hooks 实现
		currentDispatcher.current = HooksDispatcherOnMount;
	}
	const Component = wip.type;
	const props = wip.pendingProps;
	const children = Component(props);

	// 重置操作
	currentlyRenderingFiber = null;
	return children;
}

const HooksDispatcherOnMount: Dispatcher = {
	useState: mountState
};

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
	const update = createUpdate(action);
	enqueueUpdate(updateQueue, update);
	scheduleUpdateOnFiber(fiber);
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
