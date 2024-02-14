import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

// 热更新
console.log('--', import.meta.hot);

declare global {
	interface Window {
		setNum: React.Dispatch<React.SetStateAction<number>>;
	}
}

function Child() {
	return <span>bitou-react</span>;
}

const App = () => {
	const [num, setNum] = useState(100);
	window.setNum = setNum;
	return num === 3 ? <Child /> : <div>{num}</div>;
};

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
