import * as DialogPrimitive from '@radix-ui/react-dialog'
import type { ComponentPropsWithoutRef } from 'react'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close
export const DialogTitle = DialogPrimitive.Title
export const DialogDescription = DialogPrimitive.Description

export function DialogContent({ className = '', ...props }: ComponentPropsWithoutRef<typeof DialogPrimitive.Content>) {
  return <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="modal-backdrop" />
    <DialogPrimitive.Content className={`modal ${className}`} {...props} />
  </DialogPrimitive.Portal>
}