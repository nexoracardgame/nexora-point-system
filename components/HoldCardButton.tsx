"use client";
import type {ButtonHTMLAttributes} from 'react';
import {useCardGesture} from '@/lib/use-card-gesture';
type Props=Omit<ButtonHTMLAttributes<HTMLButtonElement>,'onClick'> & {onClick?:()=>void;onPreview:()=>void;onPreviewEnd:()=>void};
export default function HoldCardButton({onClick,onPreview,onPreviewEnd,disabled,...props}:Props){const gesture=useCardGesture({onChoose:onClick,onPreview,onPreviewEnd,disabled});return <button {...props} {...gesture} aria-disabled={disabled||props['aria-disabled']} />;}
