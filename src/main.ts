import './style.css'
import { mountApp } from './ui/app'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = ''
mountApp(document.querySelector<HTMLDivElement>('#app')!)
