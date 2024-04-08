import { Key, Props, ReactElementType } from 'shared/ReactTypes';
import {
	Fragment,
	FunctionComponent,
	HostComponent,
	WorkTag
} from './workTags';
import { FiberFlags, NoFlags } from './fiberFlags';
import { Container } from 'hostConfig';
import { Lane, Lanes, NoLane, NoLanes } from './fiberLanes';
import { Effect } from './fiberHooks';
import { CallbackNode } from 'scheduler';

export interface PendingPassiveEffects {
	unmount: Effect[];
	update: Effect[];
}

export class FiberNode {
	type: any;
	key: Key;
	tag: WorkTag;
	stateNode: any;
	return: FiberNode | null;
	sibling: FiberNode | null;
	child: FiberNode | null;
	index: number;
	ref: any;
	pendingProps: Props | null;
	memoizedProps: Props;
	// 函数式组件中用来链表存储 hook 的数据，类组件中用来存储实例。
	memoizedState: any;
	updateQueue: any;
	deletions: FiberNode[] | null;
	// 用于双缓存机制，current 指向当前 Fiber 节点，alternate 指向 workInProgress，它们通过 effectTag 来标识 Fiber 节点的生命周期
	alternative: FiberNode | null;
	flags: FiberFlags;
	subtreeFlags: FiberFlags;
	constructor(tag: WorkTag, pendingProps: Props, key: Key) {
		this.tag = tag;
		this.key = key || null;
		// div dom
		this.stateNode = null;
		//function component ()=>{}
		this.type = null;
		// 形成树状结构
		//  指向父节点
		this.return = null;
		this.sibling = null;
		this.child = null;
		this.index = 0;

		this.ref = null;

		// 作为工作单元
		// 开始时候的 Props
		this.pendingProps = pendingProps;
		// reconciler 协调 结束时候的 props
		this.memoizedProps = null;
		this.memoizedState = null;
		this.updateQueue = null;
		this.deletions = null;

		// 用于双缓存机制，current 指向当前 Fiber 节点，alternate 指向 workInProgress，它们通过 effectTag 来标识 Fiber 节点的生命周期
		this.alternative = null;
		// 标记 Fiber 节点的生命周期，副作用
		this.flags = NoFlags;
		// 子树包含的副作用
		this.subtreeFlags = NoFlags;
	}
}

export class FiberRootNode {
	container: Container;
	current: FiberNode;
	finishedWork: FiberNode | null;

	pendingLanes: Lanes;
	finishedLane: Lane;

	pendingPassiveEffects: PendingPassiveEffects;

	callbackNode: CallbackNode | null;
	callbackPripority: Lane;
	constructor(container: Container, hostRootFiber: FiberNode) {
		this.container = container;
		this.current = hostRootFiber;
		hostRootFiber.stateNode = this;
		this.finishedWork = null;
		this.pendingLanes = NoLanes;
		this.finishedLane = NoLane;
		this.callbackNode = null;
		this.callbackPripority = NoLane;

		// 收集回调
		this.pendingPassiveEffects = {
			unmount: [],
			update: []
		};
	}
}

export const createWorkInProgress = (
	current: FiberNode,
	pendingProps: Props
): FiberNode => {
	// 返回对应的 workInProgress
	let wip = current.alternative;
	if (wip === null) {
		// 首屏渲染 mount
		wip = new FiberNode(current.tag, pendingProps, current.key);
		wip.stateNode = current.stateNode;
		wip.alternative = current;
		current.alternative = wip;
	} else {
		// update
		wip.pendingProps = pendingProps;

		// 清除副作用和子树副作用
		wip.flags = NoFlags;
		wip.subtreeFlags = NoFlags;
		wip.deletions = null;
	}
	// 复用
	wip.type = current.type;
	wip.updateQueue = current.updateQueue;
	wip.child = current.child;
	wip.memoizedProps = current.memoizedProps;
	wip.memoizedState = current.memoizedState;
	return wip;
};

export function createFiberFromElement(element: ReactElementType) {
	const { type, key, props } = element;
	let fiberTag: WorkTag = FunctionComponent;

	if (typeof type === 'string') {
		// <div /> type:string
		fiberTag = HostComponent;
	} else if (typeof type !== 'function' && __DEV__) {
		console.warn('createFiberFromElement: 未知的类型', element);
	}

	const fiber = new FiberNode(fiberTag, props, key);
	fiber.type = type;
	return fiber;
}

export function createFiberFromFragment(elements: any[], key: Key): FiberNode {
	const fiber = new FiberNode(Fragment, elements, key);
	return fiber;
}
