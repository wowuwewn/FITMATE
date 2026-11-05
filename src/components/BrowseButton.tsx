import { useRef } from 'react'
import { motion, type HTMLMotionProps } from 'motion/react'

// A pointer drag inside a button is still a browser click. Do not open a sheet
// or replace a combination when the user is swiping the catalog instead.
export function BrowseButton({ onClick, ...props }: HTMLMotionProps<'button'>) {
  const gesture = useRef({ x: 0, y: 0, moved: false })
  return <motion.button {...props} onPointerDown={event => { gesture.current = { x: event.clientX, y: event.clientY, moved: false } }} onPointerMove={event => {
    if (Math.hypot(event.clientX - gesture.current.x, event.clientY - gesture.current.y) > 8) gesture.current.moved = true
  }} onClick={event => {
    if (event.detail !== 0 && gesture.current.moved) { event.preventDefault(); return }
    onClick?.(event)
  }} />
}
