import { select } from 'd3-selection';
import { axisBottom, axisLeft } from 'd3-axis';
import { extent, max, min } from 'd3-array';
import { scaleLinear } from 'd3-scale';
import { area } from 'd3-shape';
import i18next from 'i18next';
import type { ProfileData } from './toolbox/ngm-topo-profile-modal';

const integerFormat = new Intl.NumberFormat('de-CH', {
  maximumFractionDigits: 1,
});

export function plotProfile(
  data: ProfileData[],
  extremePoints: any[],
  parentContainer: HTMLElement,
  distInKM: boolean,
) {
  const style = getComputedStyle(parentContainer);
  const width =
    parentContainer.clientWidth -
    parseInt(style.paddingLeft) -
    parseInt(style.paddingRight);
  const height = width / 6;

  // set the dimensions and margins of the graph
  const margin = { top: 10, right: 0, bottom: 40, left: 60 };
  const w = width - margin.left - margin.right;
  const h = height - margin.top - margin.bottom;

  const elevationModel = 'DTM2';
  const domain = getXYDomains(w, h, elevationModel, data);

  // append the svg object
  const svg = select(parentContainer)
    .append('svg')
    .attr('width', width + 5)
    .attr('height', height);

  const group = svg
    .append('g')
    .attr('transform', `translate(${margin.left}, ${margin.top})`);

  // Add X axis
  group
    .append('g')
    .attr('transform', `translate(0, ${h})`)
    .call(axisBottom(domain.X));

  // Add Y axis
  group.append('g').call(axisLeft(domain.Y));

  // Add X axis label
  group
    .append('text')
    .attr('text-anchor', 'end')
    .attr('x', w / 2 + margin.left)
    .attr('y', h + margin.top + 25)
    .text(`${i18next.t('profile_distance')} [${distInKM ? 'km' : 'm'}]`);

  // Add Y axis label
  group
    .append('text')
    .attr('text-anchor', 'end')
    .attr('transform', 'rotate(-90)')
    .attr('y', -margin.left + 15)
    .attr('x', -margin.top)
    .text(`${i18next.t('profile_elevation')} [m]`);

  extremePoints.forEach((val, indx) => {
    const g = group
      .append('g')
      .attr('transform', `translate(${domain.X(val.dist)}, 0)`);
    g.append('path')
      .attr('d', `M0,0L0,${h}`)
      .attr('stroke', '#000000')
      .attr('stroke-width', 1.5);
    const textE = g
      .append('text')
      .text(`E: ${integerFormat.format(val.position[0])}`);
    const textN = g
      .append('text')
      .text(`N: ${integerFormat.format(val.position[1])}`);
    const isLastPoint = indx === extremePoints.length - 1;
    if (isLastPoint) {
      textE.attr('text-anchor', 'end');
      textN.attr('text-anchor', 'end');
    }
    const textLeftMrg = 2;
    textE.attr(
      'transform',
      `translate(${isLastPoint ? -textLeftMrg : textLeftMrg}, 2)`,
    );
    textN.attr(
      'transform',
      `translate(${isLastPoint ? -textLeftMrg : textLeftMrg}, 17)`,
    );
  });

  // Add the area
  group
    .append('path')
    .datum(data)
    .attr('class', 'ngm-profile-area')
    .attr('fill', '#B9271A')
    .attr('stroke', '#B9271A')
    .attr('stroke-width', 1.5)
    .attr(
      'd',
      area()
        .x((d) => domain.X(d.domainDist))
        .y0(h)
        .y1((d) => domain.Y(d.alts[elevationModel])),
    );

  return { domain, group };
}

export function getXYDomains(width, height, elevationModel, data) {
  const x = scaleLinear().range([0, width]);
  const y = scaleLinear().range([height, 0]);
  x.domain(
    extent(data, (d) => {
      return d.domainDist || 0;
    }),
  );
  let yMin = min(data, (d) => {
    return d.alts[elevationModel];
  });
  const yMax = max(data, (d) => {
    return d.alts[elevationModel];
  });
  const decile = (yMax - yMin) / 10;
  yMin = yMin - decile > 0 ? yMin - decile : 0;
  y.domain([yMin, yMax + decile]);
  return {
    X: x,
    Y: y,
  };
}
