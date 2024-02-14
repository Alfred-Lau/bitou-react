/* 
react 的合成事件系统
*/

import { Container } from 'hostConfig';
import { Props } from 'shared/ReactTypes';

export const elementPropsKey = '__props';

const validEventTypeList = ['click'];

export interface DOMElement extends Element {
	[elementPropsKey]: Props;
}

type EventCallback = (e: Event) => void;

interface Paths {
	capture: EventCallback[];
	bubble: EventCallback[];
}

interface SyntheticEvent extends Event {
	__stopPropagation: boolean;
}

export function updateFiberProps(node: DOMElement, props: Props) {
	node[elementPropsKey] = props;
}

export function initEvent(container: Container, eventType: string) {
	if (!validEventTypeList.includes(eventType)) {
		console.warn('invalid event type', eventType);
		return;
	}

	if (__DEV__) {
		console.log('initEvent', eventType);
	}

	container.addEventListener(eventType, (e) =>
		dispatchEvent(container, eventType, e)
	);
}

function dispatchEvent(container: Container, eventType: string, e: Event) {
	const targetElement = e.target as DOMElement;

	if (targetElement === null) {
		console.warn('targetElement is null');
		return;
	}
	// 1. 收集沿途 的事件

	const { bubble, capture } = collectPaths(targetElement, container, eventType);
	// 2. 构造合成事件
	const se = createSyntheticEvent(e);

	// 3. 遍历 capture 阶段
	triggerEventFlow(capture, se); // 3. 遍历 capture 阶段

	if (se.__stopPropagation) {
		// 阻止冒泡
		return;
	}
	// 4. 遍历 bubble 阶段
	triggerEventFlow(bubble, se);
}

function triggerEventFlow(paths: EventCallback[], se: SyntheticEvent) {
	for (let i = 0; i < paths.length; i++) {
		const eventCallback = paths[i];
		// eventCallback(se);
		eventCallback.call(null, se);
		if (se.__stopPropagation) {
			// 阻止冒泡
			break;
		}
	}
}

// 构造合成事件
function createSyntheticEvent(e: Event) {
	const syntheticEvent = e as SyntheticEvent;
	syntheticEvent.__stopPropagation = false;
	const originStopPropagation = e.stopPropagation;

	syntheticEvent.stopPropagation = () => {
		syntheticEvent.__stopPropagation = true;
		if (originStopPropagation) {
			originStopPropagation();
		}
	};

	return syntheticEvent;
}

function collectPaths(
	targetElement: DOMElement,
	container: Container,
	eventType: string
) {
	const paths: Paths = {
		capture: [],
		bubble: []
	};

	while (targetElement && targetElement !== container) {
		// 收集的过程
		const elementProps = targetElement[elementPropsKey];
		if (elementProps) {
			// click => onClick, onClickCapture
			const callbackNameList = getEventCallbackNameFromEventType(eventType);
			if (callbackNameList) {
				callbackNameList.forEach((callbackName, i) => {
					const eventCallback = elementProps[callbackName];
					if (eventCallback) {
						if (i === 0) {
							//capture： 反向的插入，模拟事件冒泡
							paths.capture.unshift(eventCallback);
						} else {
							//bubble： 正向插入，模拟事件冒泡
							paths.bubble.push(eventCallback);
						}
					}
				});
			}
		}
		targetElement = targetElement.parentNode as DOMElement;
	}

	return paths;
}

function getEventCallbackNameFromEventType(
	eventType: string
): string[] | undefined {
	return {
		click: ['onClickCapture', 'onClick']
	}[eventType];
}
