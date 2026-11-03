import './styles.css';
import screen from './ui/screen.html?raw';
import { startApp } from './app.ts';
import { element } from './ui/dom.ts';

element('app').innerHTML = screen;
const dispose = startApp();
if (import.meta.hot) import.meta.hot.dispose(dispose);
