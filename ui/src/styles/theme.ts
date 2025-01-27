import { css, CSSResult, unsafeCSS } from 'lit';

type Typography =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'title'
  | 'subtitle-1'
  | 'subtitle-2'
  | 'modal-title-1'
  | 'modal-title-2'
  | 'button'
  | 'caption'
  | 'overline'
  | 'table-header'
  | 'footer'
  | 'body-1'
  | 'body-1-bold'
  | 'body-2'
  | 'body-2-bold';

export const applyTypography = (typo: Typography): CSSResult => {
  const v = (suffix: string): CSSResult =>
    unsafeCSS(`var(--typo-${typo}--${suffix})`);
  return css`
    font-family: ${v('family')};
    font-weight: ${v('weight')};
    font-size: ${v('size')};
    line-height: ${v('line-height')};
    letter-spacing: ${v('letter-spacing')};
  `;
};

type Effect = 'focus' | 'overlay-shadow' | 'top-shadow' | 'bottom-shadow';

export const applyEffect = (effect: Effect): CSSResult => css`
  box-shadow: var(--effect-${unsafeCSS(effect)});
`;

type Animation = 'fade';

export const applyTransition = (animation: Animation): CSSResult => css`
  transition-timing-function: var(--animate-${unsafeCSS(animation)}--timing);
  transition-duration: var(--animate-${unsafeCSS(animation)}--duration);
`;

type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

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
    throw new Error(
      `can't target breakpoint '${breakpoint}' with media query as it starts at zero pixels`,
    );
  }
  return css`
    @media (min-width: ${min}px);
  `;
};

export const hostStyles = css`
  :host,
  :host * {
    ${applyTypography('body-1')};
    box-sizing: border-box;
  }
`;
