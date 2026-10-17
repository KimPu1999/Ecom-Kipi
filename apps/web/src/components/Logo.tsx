import type { CSSProperties, ImgHTMLAttributes } from 'react'
import logoUrl from '../../../../packages/brand/assets/kipi-logo.png'

export type LogoProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> & {
  alt?: string
  width?: CSSProperties['width']
  height?: CSSProperties['height']
}

export function Logo({ alt = 'THANGPC', width, height, style, ...props }: LogoProps) {
  return <img {...props} src={logoUrl} alt={alt} style={{ width, height, objectFit: 'contain', ...style }} />
}
