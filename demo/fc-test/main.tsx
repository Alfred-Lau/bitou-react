import { useState } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

console.log('🚀 ~ React:', ReactDOM);

// 热更新
console.log('--', import.meta.hot);

const App = () => {
	const [num, setNum] = useState(100);

	// 可以证明fiber 节点的复用
	const arr =
		num % 2
			? [<li key="1">1</li>, <li key="2">2</li>, <li key="3">3</li>]
			: [<li key="3">3</li>, <li key="2">2</li>, <li key="1">1</li>];
	return (
		<ul>
			<li>1</li>
			<li>2</li>
			<>
				<li>3</li>
				<li>4</li>
			</>
		</ul>
	);
	return (
		<div onClick={() => setNum(num + 1)} onClickCapture={() => setNum(num + 1)}>
			{arr}
		</div>
	);
};

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
