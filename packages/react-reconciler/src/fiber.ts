import { Key, Props } from 'shared/ReactTypes';
import { WorkTag } from './workTags';
import { FiberFlags, NoFlags } from './FiberFlags';

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
	pendingProps: Props;
	memoizedProps: Props;
	// 用于双缓存机制，current 指向当前 Fiber 节点，alternate 指向 workInProgress，它们通过 effectTag 来标识 Fiber 节点的生命周期
	alternative: FiberNode | null;
	flags: FiberFlags;
	constructor(tag: WorkTag, pendingProps: Props, key: Key) {
		this.tag = tag;
		this.key = key;
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

		// 用于双缓存机制，current 指向当前 Fiber 节点，alternate 指向 workInProgress，它们通过 effectTag 来标识 Fiber 节点的生命周期
		this.alternative = null;
		// 标记 Fiber 节点的生命周期，副作用
		this.flags = NoFlags;
	}
}
