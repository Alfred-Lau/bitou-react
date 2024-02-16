import { scheduleMicroTask } from 'hostConfig';
import { beginWork } from './beginWork';
import { commitMutationEffects } from './commitWork';
import { completeWork } from './completeWork';
import { FiberNode, FiberRootNode, createWorkInProgress } from './fiber';
import { MutationMask, NoFlags } from './fiberFlags';
import {
	Lane,
	NoLane,
	SyncLane,
	getHighestPriorityLane,
	markRootFinished,
	mergeLanes
} from './fiberLanes';
import { flushSyncCallbacks, scheduleSyncCallback } from './syncTaskQueue';
import { HostRoot } from './workTags';

// 全局指针，指向当前正在工作的 FiberNode
let workInProgress: FiberNode | null = null;
// 全局保存
let wipRootRenderLane: Lane = NoLane;

function prepareFreshStack(fiber: FiberRootNode, lane: Lane) {
	workInProgress = createWorkInProgress(fiber.current, {});
	wipRootRenderLane = lane;
}

export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
	// 调度功能
	// 从当前节点开始向上遍历，找到根节点
	const root = markUpdateFromFiberToRoot(fiber);
	markRootUpdated(root, lane);
	// 从根节点开始渲染
	// renderRoot(root);
	// 添加调度机制
	ensureRootIsScheduled(root);
}

function ensureRootIsScheduled(root: FiberRootNode) {
	const updateLane = getHighestPriorityLane(root.pendingLanes);
	if (updateLane === NoFlags) {
		// 没有更新
		return;
	}

	// 不同的更新优先级，使用不同的调度方式【重运行时】
	if (updateLane === SyncLane) {
		// 同步更新,使用微任务进行调度
		if (__DEV__) {
			console.log('在微任务中调度，优先级', updateLane);
		}

		// 多次更新，批处理调度的方式
		scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root, updateLane));
		scheduleMicroTask(flushSyncCallbacks);
	} else {
		// 异步更新
		// 使用宏任务进行调度
	}
}

function markRootUpdated(root: FiberRootNode, lane: Lane) {
	root.pendingLanes = mergeLanes(root.pendingLanes, lane);
}

function markUpdateFromFiberToRoot(fiber: FiberNode) {
	let node = fiber;
	let parent = fiber.return;
	while (parent !== null) {
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
function performSyncWorkOnRoot(root: FiberRootNode, lane: Lane) {
	const nextLane = getHighestPriorityLane(root.pendingLanes);
	if (nextLane !== SyncLane) {
		// 其他比syneLane高的优先级
		// 重新调度
		ensureRootIsScheduled(root);
		return;
	}

	if (__DEV__) {
		console.log('render 阶段开始:');
	}
	// 初始化
	prepareFreshStack(root, lane);

	do {
		try {
			workLoop();
			break;
		} catch (e) {
			if (__DEV__) {
				console.warn('workLoop 发生错误', e);
			}
			workInProgress = null;
		}
	} while (true);

	const finishedWork = root.current.alternative;
	root.finishedWork = finishedWork;
	root.finishedLane = lane;
	// 本次render结束之后
	wipRootRenderLane = NoLane;

	// 提交阶段：将更新的结果提交到宿主环境
	commitRoot(root);
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

	// 判断是否存在 3个子阶段需要执行的操作

	const subtreeHasEffect =
		(finishedWork.subtreeFlags & MutationMask) !== NoFlags;
	const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags;

	if (subtreeHasEffect || rootHasEffect) {
		// beforeMutation
		// mutation

		// 把生成的fiber 树赋值给 current
		commitMutationEffects(finishedWork);
		root.current = finishedWork;
		// layout
	} else {
		// 没有副作用
		root.current = finishedWork;
	}
}

function workLoop() {
	while (workInProgress !== null) {
		performUnitOfWork(workInProgress);
	}
}

function performUnitOfWork(fiber: FiberNode) {
	// 递阶段 next 是fiber 的第一个子节点
	const next = beginWork(fiber, wipRootRenderLane);
	fiber.memoizedProps = fiber.pendingProps;

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
