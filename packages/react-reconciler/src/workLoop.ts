import { scheduleMicroTask } from 'hostConfig';
import {
  unstable_cancelCallback,
  unstable_NormalPriority as NormalPriority,
  unstable_scheduleCallback as scheduleCallback,
  unstable_shouldYield,
} from 'scheduler';

import { beginWork } from './beginWork';
import {
  commitLayoutEffects,
  commitMutationEffects,
} from './commitWork';
import { completeWork } from './completeWork';
import {
  createWorkInProgress,
  FiberNode,
  FiberRootNode,
  PendingPassiveEffects,
} from './fiber';
import {
  Flags,
  MutationMask,
  NoFlags,
  PassiveMask,
} from './fiberFlags';
import {
  Effect,
  resetHooksOnUnwind,
} from './fiberHooks';
import {
  getNextLane,
  Lane,
  lanesToSchedulerPriority,
  markRootFinished,
  markRootSuspended,
  mergeLanes,
  NoLane,
  SyncLane,
} from './fiberLanes';
import { throwException } from './fiberThrow';
import { unwindWork } from './fiberUnwindWork';
import {
  HookHasEffect,
  Passsive,
} from './hookEffectTags';
import {
  flushSyncCallbacks,
  scheduleSyncCallback,
} from './syncTaskQueue';
import {
  getSuspenseThenable,
  SuspenseException,
} from './thenable';
import { HostRoot } from './workTags';

// 全局指针，指向当前正在工作的 FiberNode
let workInProgress: FiberNode | null = null;
// 全局保存
let wipRootRenderLane: Lane = NoLane;
let rootDoesHasPassiveEffects: boolean = false;

type RootExitStatus = number;
// 中断
const RootInComplete = 1;
// 执行结束
const RootCompleted = 2;
//  进程中
const RootInProcess = 0;
// 未完成
const RootDidNotComplete = 3;

let wipRootExitStatus: number = RootInProcess;

type SuspendedReason = typeof NotSuspended | typeof SuspendedOnData;
const NotSuspended = 0;
const SuspendedOnData = 6;

let wipSuspendedReason: SuspendedReason = NotSuspended;
let wipThrownValue: any = null;

function prepareFreshStack(root: FiberRootNode, lane: Lane) {
	root.finishedLane = NoLane;
	root.finishedWork = null;
	workInProgress = createWorkInProgress(root.current, {});
	wipRootRenderLane = lane;
	wipRootExitStatus = RootInProcess;
	wipSuspendedReason = NotSuspended;
	wipThrownValue = null;
}

export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
	// 调度功能
	// 从当前节点开始向上遍历，找到根节点
	const root = markUpdateLaneFromFiberToRoot(fiber);
	markRootUpdated(root, lane);
	// 从根节点开始渲染
	// VIP: 添加调度机制
	ensureRootIsScheduled(root);
}

// 调度的起点
export function ensureRootIsScheduled(root: FiberRootNode) {
	const updateLane = getNextLane(root);
	const existingCallback = root.callbackNode;

	if (updateLane === NoLane) {
		// 没有更新
		if (existingCallback !== null) {
			unstable_cancelCallback(existingCallback);
		}
		root.callbackNode = null;
		root.callbackPripority = NoLane;

		return;
	}

	const curPripority = updateLane;
	const prevPripority = root.callbackPripority;

	if (curPripority === prevPripority) {
		// 同一优先级的更新
		return;
	}

	if (existingCallback !== null) {
		unstable_cancelCallback(existingCallback);
	}

	let newCallbackNode = null;

	if (__DEV__) {
		console.log(
			`在${updateLane === SyncLane ? '微' : '宏'}任务中调度，优先级:`,
			updateLane
		);
	}

	// 不同的更新优先级，使用不同的调度方式【重运行时】
	if (updateLane === SyncLane) {
		// 同步更新,使用微任务进行调度

		// 多次更新，批处理调度的方式
		scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root));
		scheduleMicroTask(flushSyncCallbacks);
	} else {
		// 异步更新
		// 使用宏任务进行调度
		const schedulerPriority = lanesToSchedulerPriority(updateLane);
		newCallbackNode = scheduleCallback(
			schedulerPriority,
			performConcurrentWorkOnRoot.bind(null, root)
		);
	}

	root.callbackNode = newCallbackNode;
	root.callbackPripority = curPripority;
}

export function markRootUpdated(root: FiberRootNode, lane: Lane) {
	root.pendingLanes = mergeLanes(root.pendingLanes, lane);
}

function markUpdateLaneFromFiberToRoot(fiber: FiberNode, lane: Lane) {
	let node = fiber;
	let parent = fiber.return;
	while (parent !== null) {
		parent.childLanes = mergeLanes(parent.childLanes, lane);
		const alternative = parent.alternative;
		if (alternative !== null) {
			alternative.childLanes = mergeLanes(alternative.childLanes, lane);
		}
		// 当前节点是一个普通的节点
		node = parent;
		parent = parent.return;
	}

	if (node.tag === HostRoot) {
		return node.stateNode;
	}

	return null;
}

// 渲染根节点: 触发更新的 API 来进行调用
function performSyncWorkOnRoot(root: FiberRootNode) {
	const nextLane = getNextLane(root);
	if (nextLane !== SyncLane) {
		// 其他比syneLane高的优先级
		// 重新调度
		ensureRootIsScheduled(root);
		return;
	}

	const exitStatus = renderRoot(root, nextLane, false);

	switch (exitStatus) {
		case RootCompleted:
			const finishedWork = root.current.alternative;
			root.finishedWork = finishedWork;
			root.finishedLane = nextLane;
			// 本次render结束之后
			wipRootRenderLane = NoLane;

			// 提交阶段：将更新的结果提交到宿主环境
			commitRoot(root);
			break;

		case RootDidNotComplete:
			wipRootRenderLane = NoLane;
			markRootSuspended(root, nextLane);
			ensureRootIsScheduled(root);
			break;

		default:
			if (__DEV__) {
				console.error('performSyncWorkOnRoot: 还未实现同步更新结束状态');
			}
			break;
	}
}

let c = 0;

function renderRoot(root: FiberRootNode, lane: Lane, shouldTimeSlice: boolean) {
	if (__DEV__) {
		console.log(`开始 ${shouldTimeSlice ? '并发' : '同步'}更新`, root);
	}

	if (wipRootRenderLane !== lane) {
		// 初始化
		prepareFreshStack(root, lane);
	}
	do {
		try {
			if (wipSuspendedReason !== NotSuspended && workInProgress !== null) {
				// unwind
				const thrownValue = wipThrownValue;
				wipSuspendedReason = NotSuspended;
				wipThrownValue = null;
				throwAndUnwindWorkLoop(root, workInProgress, thrownValue, lane);
			}

			// 是否需要时间分片
			shouldTimeSlice ? workLoopConcurrent() : workLoopSync();
			break;
		} catch (e) {
			if (__DEV__) {
				console.warn('workLoop 发生错误', e);
			}
			c++;
			if (c > 20) {
				console.error('workLoop 发生错误次数过多');
				break;
			}
			// 捕获
			handleThrow(root, e, lane);
		}
	} while (true);

	if (wipRootExitStatus !== RootInProcess) {
		return wipRootExitStatus;
	}

	// 中断执行 ｜｜render 阶段结束
	if (shouldTimeSlice && workInProgress !== null) {
		return RootInComplete;
	}

	if (!shouldTimeSlice && workInProgress !== null && __DEV__) {
		console.warn('render 阶段结束时wip不应该不是null');
	}
	// TODO： 报错处理
	return RootCompleted;
}

function throwAndUnwindWorkLoop(
	root: FiberRootNode,
	unitOfWork: FiberNode,
	thrownValue: any,
	lane: Lane
) {
	// 重置 FC 全局变量
	resetHooksOnUnwind(unitOfWork);
	// 请求返回后重新触发更新
	throwException(root, thrownValue, lane);
	// unwind
	unwindUnitOfWork(unitOfWork);
}

function unwindUnitOfWork(unitOfWork: FiberNode) {
	let incompleteWork: FiberNode | null = unitOfWork;

	do {
		// 递归向上
		const next = unwindWork(incompleteWork);
		if (next !== null) {
			workInProgress = next;
			return;
		}

		const returnFiber = incompleteWork.return as FiberNode;

		if (returnFiber !== null) {
			// 中断
			returnFiber.deletions = null;
		}

		incompleteWork = returnFiber;
	} while (incompleteWork !== null);

	// 使用了 use，抛出了数据，但是没有使用suspense
	// 到了root
	wipRootExitStatus = RootDidNotComplete;
	workInProgress = null;
}

function handleThrow(root: FiberRootNode, thrownValue: any) {
	// error boundary

	//
	if (thrownValue === SuspenseException) {
		// 重新调度
		wipSuspendedReason = SuspendedOnData;
		thrownValue = getSuspenseThenable();
	} else {
		// todo: error boundary
	}

	wipThrownValue = thrownValue;
}

function performConcurrentWorkOnRoot(
	root: FiberRootNode,
	didTimeout: boolean
): any {
	// 保证 useEffect 回调执行
	const curCallback = root.callbackNode;
	const didFlushPassiveEffect = flushPassiveEffects(root.pendingPassiveEffects);
	if (didFlushPassiveEffect) {
		// 执行了副作用
		if (root.callbackNode !== curCallback) {
			// 有一个更高优先级的插入进来了
			return null;
		}
	}

	const lane = getNextLane(root);
	const currentCallbackNode = root.callbackNode;
	if (lane === NoLane) {
		return null;
	}
	const needSync = lane === SyncLane || didTimeout;
	// render 阶段
	const exitStatus = renderRoot(root, lane, !needSync);

	// 重新调度
	ensureRootIsScheduled(root);

	switch (exitStatus) {
		case RootInComplete:
			if (root.callbackNode !== currentCallbackNode) {
				// 有一个更高优先级的插入进来了
				return null;
			}
			// 继续调度
			return performConcurrentWorkOnRoot.bind(null, root);
		case RootCompleted:
			const finishedWork = root.current.alternative;
			root.finishedWork = finishedWork;
			root.finishedLane = lane;
			// 本次render结束之后
			wipRootRenderLane = NoLane;

			// 提交阶段：将更新的结果提交到宿主环境
			commitRoot(root);
			break;
		case RootDidNotComplete:
			wipRootRenderLane = NoLane;
			markRootSuspended(root, lane);
			ensureRootIsScheduled(root);
			break;
		default:
			if (__DEV__) {
				console.error(
					'performConcurrentWorkOnRoot: 未知的退出状态',
					exitStatus
				);
			}
			break;
	}
}

function commitRoot(root: FiberRootNode) {
	const finishedWork = root.finishedWork;
	if (finishedWork === null) {
		return;
	}

	if (__DEV__) {
		console.log('commitRoot 阶段开始:！！', finishedWork);
	}
	const lane = root.finishedLane;
	if (lane === NoLane && __DEV__) {
		console.error('commitRoot: commit 阶段不应该是 Nolane', lane);
	}
	//  重置
	root.finishedWork = null;
	root.finishedLane = NoLane;

	// 移除
	markRootFinished(root, lane);

	if (
		(finishedWork.flags & PassiveMask) !== NoFlags ||
		(finishedWork.subtreeFlags & PassiveMask) !== NoFlags
	) {
		// fiber 树存在 useeffect 需要执行的副作用
		if (!rootDoesHasPassiveEffects) {
			// 防止重复执行
			rootDoesHasPassiveEffects = true;
			// 调度副作用
			scheduleCallback(NormalPriority, () => {
				// 执行副作用
				flushPassiveEffects(root.pendingPassiveEffects);
				return;
			});
		}
	}

	// 判断是否存在 3个子阶段需要执行的操作

	const subtreeHasEffect =
		(finishedWork.subtreeFlags & (MutationMask | PassiveMask)) !== NoFlags;
	const rootHasEffect =
		(finishedWork.flags & (MutationMask | PassiveMask)) !== NoFlags;

	if (subtreeHasEffect || rootHasEffect) {
		//1/3 beforeMutation
		//2/3 mutation
		commitMutationEffects(finishedWork, root);
		// 把生成的fiber 树赋值给 current
		root.current = finishedWork;

		// 3/3 layout
		commitLayoutEffects(finishedWork, root);
		// layout
	} else {
		// 没有副作用
		root.current = finishedWork;
	}

	rootDoesHasPassiveEffects = false;
	// 重新调度 root
	ensureRootIsScheduled(root);
}

function flushPassiveEffects(pendingPassiveEffects: PendingPassiveEffects) {
	let didFlushPassiveEffect = false;
	// 执行顺序
	pendingPassiveEffects.unmount.forEach((effect) => {
		didFlushPassiveEffect = true;
		commitHookEffectListUnmount(Passsive, effect);
	});
	pendingPassiveEffects.unmount = [];

	pendingPassiveEffects.update.forEach((effect) => {
		didFlushPassiveEffect = true;
		// 对于所有的副作用，执行create
		commitHookEffectListDestroy(Passsive | HookHasEffect, effect);
	});

	pendingPassiveEffects.update.forEach((effect) => {
		didFlushPassiveEffect = true;
		// 对于所有的副作用，执行create
		commitHookEffectListCreate(Passsive | HookHasEffect, effect);
	});

	pendingPassiveEffects.update = [];

	// 执行微任务
	flushSyncCallbacks();

	return didFlushPassiveEffect;
}

function commitHookEffectList(
	flags: Flags,
	lastEffect: Effect,
	callback: (effect: Effect) => void
) {
	let effect = lastEffect.next as Effect;
	do {
		if ((effect.tag & flags) === flags) {
			// 执行副作用
			callback(effect);
		}
		effect = effect.next as Effect;
	} while (effect !== lastEffect.next);
}

function commitHookEffectListUnmount(flags: Flags, lastEffect: Effect) {
	commitHookEffectList(flags, lastEffect, (effect) => {
		const destroy = effect.destroy;
		if (typeof destroy === 'function') {
			destroy();
		}
		// 清除标记create
		effect.tag &= ~HookHasEffect;
	});
}

function commitHookEffectListDestroy(flags: Flags, lastEffect: Effect) {
	commitHookEffectList(flags, lastEffect, (effect) => {
		const destroy = effect.destroy;
		if (typeof destroy === 'function') {
			destroy();
		}
	});
}

function commitHookEffectListCreate(flags: Flags, lastEffect: Effect) {
	commitHookEffectList(flags, lastEffect, (effect) => {
		const create = effect.create;
		if (typeof create === 'function') {
			effect.destroy = create();
		}
	});
}

function workLoopSync() {
	while (workInProgress !== null) {
		performUnitOfWork(workInProgress);
	}
}

function workLoopConcurrent() {
	while (workInProgress !== null && !unstable_shouldYield()) {
		performUnitOfWork(workInProgress);
	}
}

function performUnitOfWork(fiber: FiberNode) {
	// 递阶段 next 是fiber 的第一个子节点
	const next = beginWork(fiber, wipRootRenderLane);
	fiber.memoizedProps = fiber.pendingProps!;

	if (next === null) {
		// 归阶段
		completeUnitOfWork(fiber);
	} else {
		// 递归
		workInProgress = next;
	}
}

function completeUnitOfWork(fiber: FiberNode) {
	let node: FiberNode | null = fiber;
	do {
		completeWork(node);
		const sibling = node.sibling;
		if (sibling !== null) {
			workInProgress = sibling;
			return;
		}

		node = node.return;
		workInProgress = node;
	} while (node !== null);
}
