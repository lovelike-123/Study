import type { Unit } from '../hooks/useSetting'

/** 1 千克对应的磅数（精确值） */
export const LB_PER_KG = 0.45359237

export function kgToLb(kg: number): number {
  return kg / LB_PER_KG
}

export function lbToKg(lb: number): number {
  return lb * LB_PER_KG
}

/** 展示用重量：kg 取整；lb 取 0.5 精度并去掉多余的 .0 */
export function displayWeight(kg: number, unit: Unit): string {
  if (unit === 'lb') {
    const lb = Math.round(kgToLb(kg) * 2) / 2
    return Number.isInteger(lb) ? String(lb) : lb.toFixed(1)
  }
  return String(Math.round(kg))
}

export function unitLabel(unit: Unit): string {
  return unit === 'lb' ? 'lb' : 'kg'
}
