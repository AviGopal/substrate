import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
})

const { window } = dom

Object.defineProperty(globalThis, 'window', { value: window, writable: true, configurable: true })
Object.defineProperty(globalThis, 'document', { value: window.document, writable: true, configurable: true })
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, writable: true, configurable: true })
Object.defineProperty(globalThis, 'HTMLElement', { value: window.HTMLElement, writable: true, configurable: true })
Object.defineProperty(globalThis, 'Element', { value: window.Element, writable: true, configurable: true })
Object.defineProperty(globalThis, 'Node', { value: window.Node, writable: true, configurable: true })
Object.defineProperty(globalThis, 'Text', { value: window.Text, writable: true, configurable: true })
Object.defineProperty(globalThis, 'Event', { value: window.Event, writable: true, configurable: true })
Object.defineProperty(globalThis, 'CustomEvent', { value: window.CustomEvent, writable: true, configurable: true })
Object.defineProperty(globalThis, 'MutationObserver', { value: window.MutationObserver, writable: true, configurable: true })
Object.defineProperty(globalThis, 'getComputedStyle', { value: window.getComputedStyle.bind(window), writable: true, configurable: true })
