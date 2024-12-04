import {css, CSSResult} from 'lit';

type Breakpoint =
  | 'xs'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | 'xxl'

const breakpoints: Record<Breakpoint, number> = {
  xs: 0,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
  xxl: 1400,
};

export const upFrom = (breakpoint: Breakpoint): CSSResult => {
  const min = breakpoints[breakpoint];
  if (min === 0) {
    throw new Error(`can't target breakpoint '${breakpoint}' with media query as it starts at zero pixels`);
  }
  return css`@media (min-width: ${min}px)`;
};
